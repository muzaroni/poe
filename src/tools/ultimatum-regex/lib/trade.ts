import { modifiers } from "../data/modifiers";
import { customConditions, type Settings } from "./storage";

export const challengeOptions: Record<string, string> = {
  "Defeat Waves of Enemies": "Exterminate",
  Survive: "Survival",
  "Protect the Altar": "Defense",
  "Stand in the Stone Circles": "Conquer",
};
interface StatGroup {
  type: "not" | "and" | "count";
  filters: { id: string }[];
  value?: { min: number };
}
export interface TradeQuery {
  status: { option: string };
  type: string;
  stats: StatGroup[];
  filters: Record<
    string,
    { filters: Record<string, { option?: string; min?: number; max?: number }> }
  >;
}
export interface TradeLink {
  label: string;
  url: string;
}

export function buildTradeQueries(s: Settings) {
  const errors: string[] = [];
  const notices: string[] = [];
  if (!s.tradeLeague.trim())
    errors.push("Enter a league for the trade search.");
  if (customConditions(s).some(c => c.text.trim()))
    errors.push(
      "Clear Custom text/regex to get a trade link. PoE Trade cannot apply custom conditions.",
    );
  if (s.wanted.some((id) => s.unwanted.includes(id)))
    errors.push("A tier is both wanted and unwanted.");
  const resolve = (ids: string[]) =>
    [...new Set(ids)].map((id) => {
      const m = modifiers.find((m) => m.id === id);
      if (!m?.tradeIds.length)
        errors.push(`No trade filter is available for ${m?.name ?? id}. Remove this selection to get a trade link.`);
      return [...new Set(m?.tradeIds ?? [])];
    });
  const unwanted = resolve(s.unwanted);
  const wanted = resolve(s.wanted);
  const stats: StatGroup[] = [];
  const filtersFor = (ids: string[]) => [...new Set(ids)].map((id) => ({ id }));
  if (unwanted.length)
    stats.push({ type: "not", filters: filtersFor(unwanted.flat()) });
  if (wanted.length && s.match === "any")
    stats.push({
      type: "count",
      value: { min: 1 },
      filters: filtersFor(wanted.flat()),
    });
  if (s.match === "all") {
    const single = wanted.filter((ids) => ids.length === 1).flat();
    if (single.length) stats.push({ type: "and", filters: filtersFor(single) });
    // Duplicate trade IDs describe alternate implementations of the same label.
    // Require at least one alternate for each tier, not every alternate at once.
    wanted
      .filter((ids) => ids.length > 1)
      .forEach((ids) =>
        stats.push({
          type: "count",
          value: { min: 1 },
          filters: filtersFor(ids),
        }),
      );
  }
  const price: { option?: string; min?: number; max?: number } = {};
  for (const [name, value] of [
    ["min", s.tradeMinPrice],
    ["max", s.tradeMaxPrice],
  ] as const) {
    if (value.trim()) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0)
        errors.push(`Invalid ${name === "min" ? "minimum" : "maximum"} price.`);
      else price[name] = number;
    }
  }
  if (
    price.min !== undefined &&
    price.max !== undefined &&
    price.min > price.max
  )
    errors.push("Minimum price exceeds maximum price.");
  if (Object.keys(price).length) price.option = s.tradePriceCurrency;
  const ultimatum: TradeQuery["filters"][string]["filters"] = {};
  if (s.requiredItem.trim())
    ultimatum.ultimatum_input = { option: s.requiredItem.trim() };
  if (s.tradeReward) ultimatum.ultimatum_reward = { option: s.tradeReward };
  if (
    s.requiredItem.trim() &&
    !["Divine Orb", "Chaos Orb"].includes(s.requiredItem.trim())
  )
    notices.push(
      "Typed items must use an exact item name accepted by PoE Trade.",
    );
  if (s.challenge && s.challengeNot)
    errors.push(`Turn off “Not ${s.challenge}” to get a trade link. PoE Trade cannot exclude a challenge type.`);
  const variants = [s.challenge];
  const queries = variants.map((challenge) => {
    const filters: TradeQuery["filters"] = {
      ultimatum_filters: { filters: { ...ultimatum } },
    };
    if (challenge)
      filters.ultimatum_filters.filters.ultimatum_challenge = {
        option: challengeOptions[challenge],
      };
    if (Object.keys(price).length)
      filters.trade_filters = { filters: { price } };
    return {
      label: challenge || "All challenges",
      query: {
        status: { option: s.tradeStatus },
        type: "Inscribed Ultimatum",
        stats,
        filters,
      } satisfies TradeQuery,
    };
  });
  return {
    queries: errors.length ? [] : queries,
    errors: [...new Set(errors)],
    notices,
  };
}

// The user's working URL encodes the query itself as gzip + URL-safe base64.
// Use browser-native compression; no search requests, backend, or credentials.
export async function encodeTradeLink(
  league: string,
  query: TradeQuery,
): Promise<string> {
  if (typeof CompressionStream === "undefined")
    throw new Error(
      "This browser cannot compress trade links. Use an up-to-date browser.",
    );
  const bytes = new TextEncoder().encode(JSON.stringify(query));
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  const encoded = btoa(
    Array.from(compressed, (byte) => String.fromCharCode(byte)).join(""),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league.trim())}/${encoded}`;
}
export async function generateTradeLinks(
  s: Settings,
): Promise<{ links: TradeLink[]; errors: string[]; notices: string[] }> {
  const result = buildTradeQueries(s);
  try {
    const links = await Promise.all(
      result.queries.map(async ({ label, query }) => ({
        label,
        url: await encodeTradeLink(s.tradeLeague, query),
      })),
    );
    return { links, errors: result.errors, notices: result.notices };
  } catch (error) {
    return {
      links: [],
      errors: [
        ...result.errors,
        error instanceof Error
          ? error.message
          : "Could not generate trade link.",
      ],
      notices: result.notices,
    };
  }
}

import { describe, it, expect, vi } from "vitest";
import { modifiers } from "../data/modifiers";
import { defaults, initial, persist, restore } from "./storage";
import { buildTradeQueries, generateTradeLinks } from "./trade";
const id = (name: string) => modifiers.find((m) => m.name === name)!.id;
const empty = () => ({ ...defaults(), wanted: [], unwanted: [] });
async function decode(url: string) {
  const payload = new URL(url).pathname.split("/").pop()!;
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(
    atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)),
    (c) => c.charCodeAt(0),
  );
  return new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).json();
}
describe("trade query generation", () => {
  it("reproduces the active filters in the user-supplied compressed search", () => {
    const s = {
      ...defaults(),
      requiredItem: "Divine Orb",
      tradeReward: "DoubleCurrency" as const,
      tradeMinPrice: "3",
    };
    const result = buildTradeQueries(s);
    expect(result.errors).toEqual([]);
    expect(result.queries).toHaveLength(1);
    expect(result.queries[0].query).toEqual({
      status: { option: "securable" },
      type: "Inscribed Ultimatum",
      stats: [
        {
          type: "not",
          filters: [
            7958, 32061, 47172, 49847, 24728, 35694, 60794, 37639, 15668,
          ].map((id) => ({ id: `ultimatum.umod_${id}` })),
        },
      ],
      filters: {
        ultimatum_filters: {
          filters: {
            ultimatum_input: { option: "Divine Orb" },
            ultimatum_reward: { option: "DoubleCurrency" },
          },
        },
        trade_filters: { filters: { price: { min: 3, option: "divine" } } },
      },
    });
  });
  it("does not inherit example price or reward restrictions by default", () => {
    const q = buildTradeQueries(defaults()).queries[0].query;
    expect(q.filters.trade_filters).toBeUndefined();
    expect(
      q.filters.ultimatum_filters.filters.ultimatum_reward,
    ).toBeUndefined();
  });
  it("uses a count group for wanted Any and separate AND logic for All", () => {
    const s = { ...empty(), wanted: [id("Drought"), id("Ruin II")] };
    expect(buildTradeQueries(s).queries[0].query.stats).toEqual([
      {
        type: "count",
        value: { min: 1 },
        filters: [{ id: id("Drought") }, { id: id("Ruin II") }],
      },
    ]);
    expect(
      buildTradeQueries({ ...s, match: "all" }).queries[0].query.stats[0].type,
    ).toBe("and");
  });
  it("uses all alternate trade IDs without requiring every alternate in All mode", () => {
    const m = modifiers.find((m) => m.tradeIds.length > 1)!;
    const q = buildTradeQueries({ ...empty(), wanted: [m.id], match: "all" })
      .queries[0].query;
    expect(q.stats).toEqual([
      {
        type: "count",
        value: { min: 1 },
        filters: m.tradeIds.map((id) => ({ id })),
      },
    ]);
    const unwanted = buildTradeQueries({ ...empty(), unwanted: [m.id, m.id] })
      .queries[0].query.stats[0];
    expect(unwanted.type).toBe("not");
    expect(unwanted.filters).toHaveLength(m.tradeIds.length);
  });
  it("maps each challenge to its trade option", () => {
    for (const [challenge, option] of [
      ["Defeat Waves of Enemies", "Exterminate"],
      ["Survive", "Survival"],
      ["Protect the Altar", "Defense"],
      ["Stand in the Stone Circles", "Conquer"],
    ] as const) {
      expect(
        buildTradeQueries({ ...empty(), challenge }).queries[0].query.filters
          .ultimatum_filters.filters.ultimatum_challenge,
      ).toEqual({ option });
    }
  });
  it("blocks Not challenges with an actionable reason", async () => {
    const settings = { ...empty(), challenge: "Stand in the Stone Circles" as const, challengeNot: true };
    const result = buildTradeQueries(settings);
    expect(result.queries).toEqual([]);
    expect(result.errors.join()).toContain("Turn off “Not Stand in the Stone Circles”");
    expect((await generateTradeLinks(settings)).links).toEqual([]);
    expect(buildTradeQueries({ ...settings, challengeNot: false }).queries).toHaveLength(1);
    expect(buildTradeQueries({ ...empty(), challengeNot: true }).queries).toHaveLength(1);
  });
  it("blocks custom conditions instead of silently dropping them", () => {
    const result = buildTradeQueries({ ...empty(), custom: "sacrifice" });
    expect(result.queries).toEqual([]);
    expect(result.errors.join()).toContain("Custom text/regex");
  });
  it("blocks unavailable modifier IDs and conflicting selections", () => {
    expect(
      buildTradeQueries({ ...empty(), wanted: ["wiki.ruin-1"] }).errors.join(),
    ).toContain("No trade filter");
    expect(
      buildTradeQueries({ ...empty(), unwanted: ["unknown"] }).queries,
    ).toEqual([]);
    expect(
      buildTradeQueries({
        ...empty(),
        wanted: [id("Drought")],
        unwanted: [id("Drought")],
      }).queries,
    ).toEqual([]);
  });
  it("passes typed item names as option text and warns about exact names", () => {
    const result = buildTradeQueries({ ...empty(), requiredItem: "My Item" });
    expect(
      result.queries[0].query.filters.ultimatum_filters.filters.ultimatum_input
        .option,
    ).toBe("My Item");
    expect(result.notices).toHaveLength(1);
  });
  it("validates league and price fields", () => {
    expect(buildTradeQueries({ ...empty(), tradeLeague: " " }).queries).toEqual(
      [],
    );
    for (const price of ["-1", "Infinity", "NaN"])
      expect(
        buildTradeQueries({ ...empty(), tradeMinPrice: price }).queries,
      ).toEqual([]);
    expect(
      buildTradeQueries({ ...empty(), tradeMinPrice: "4", tradeMaxPrice: "3" })
        .queries,
    ).toEqual([]);
    expect(
      buildTradeQueries({
        ...empty(),
        tradeMinPrice: "0",
        tradeMaxPrice: "2.5",
        tradePriceCurrency: "chaos",
      }).queries[0].query.filters.trade_filters.filters.price,
    ).toEqual({ min: 0, max: 2.5, option: "chaos" });
  });
});
describe("trade link encoding and persistence", () => {
  it("round trips the actual URL through gzip and URL-safe base64", async () => {
    const s = {
      ...defaults(),
      requiredItem: "Divine Orb",
      tradeLeague: "Hardcore Covens",
    };
    const result = await generateTradeLinks(s);
    expect(result.errors).toEqual([]);
    expect(result.links[0].url).toMatch(
      /^https:\/\/www\.pathofexile\.com\/trade\/search\/Hardcore%20Covens\/[A-Za-z0-9_-]+$/,
    );
    expect(await decode(result.links[0].url)).toEqual(
      buildTradeQueries(s).queries[0].query,
    );
  });
  it("lists every blocker without producing partial trade links", async () => {
    const result = await generateTradeLinks({ ...empty(), challenge: "Survive", challengeNot: true, custom: "test", wanted: ["unknown"] });
    expect(result.links).toEqual([]);
    expect(result.errors.join()).toContain("Not Survive");
    expect(result.errors.join()).toContain("Custom text/regex");
    expect(result.errors.join()).toContain("Remove this selection");
  });
  it("reports unavailable compression without producing a broken link", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    try {
      const result = await generateTradeLinks(empty());
      expect(result.links).toEqual([]);
      expect(result.errors.join()).toContain("cannot compress");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("restores independent trade settings and migrates old presets", () => {
    const state = initial();
    state.presets.push({
      id: "second",
      name: "Second",
      settings: {
        ...empty(),
        tradeLeague: "Standard",
        tradeStatus: "any",
        tradeReward: "DoubleCurrency",
        tradeMinPrice: "3",
        tradeMaxPrice: "8",
        tradePriceCurrency: "chaos",
      },
    });
    state.current = "second";
    let value = "";
    const storage = {
      getItem: () => value,
      setItem: (_key: string, v: string) => {
        value = v;
      },
    };
    persist(storage, state);
    expect(restore(storage)).toEqual(state);
    const old = JSON.parse(value);
    for (const key of Object.keys(old.presets[0].settings))
      if (key.startsWith("trade")) delete old.presets[0].settings[key];
    value = JSON.stringify(old);
    expect(restore(storage).presets[0].settings.tradeLeague).toBe("Covens");
    expect(restore(storage).presets[1].settings.tradeMinPrice).toBe("3");
  });
});

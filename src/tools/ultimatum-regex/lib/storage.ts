import { modifiers } from "../data/modifiers";
import { challenges, type Challenge } from "../data/filters";
export interface Settings {
  unwanted: string[];
  wanted: string[];
  match: "any" | "all";
  custom: string;
  customCondition: "include" | "exclude";
  customMode: "literal" | "regex";
  limit: number;
  requiredItem: string;
  challenge: Challenge;
  challengeNot: boolean;
  tradeLeague: string;
  tradeStatus: "securable" | "online" | "any";
  tradeReward:
    "" | "DoubleCurrency" | "DoubleDivCards" | "MirrorRare" | "ExchangeUnique";
  tradeMinPrice: string;
  tradeMaxPrice: string;
  tradePriceCurrency: "divine" | "chaos";
}
export interface Preset {
  id: string;
  name: string;
  settings: Settings;
}
export interface State {
  version: 1;
  current: string;
  presets: Preset[];
}
export const KEY = "ultimatum-picker:v1";
export function defaults(): Settings {
  return {
    unwanted: modifiers
      .filter(
        (m) =>
          m.family === "Stalking Ruin" ||
          (m.family === "Ruin" && (m.tier ?? 0) > 1) ||
          (m.family === "Reduced Recovery" && m.tier === 2) ||
          m.family === "Drought",
      )
      .map((m) => m.id),
    wanted: [],
    match: "any",
    custom: "",
    customCondition: "include",
    customMode: "literal",
    limit: 250,
    requiredItem: "",
    challenge: "",
    challengeNot: false,
    tradeLeague: "Covens",
    tradeStatus: "securable",
    tradeReward: "",
    tradeMinPrice: "",
    tradeMaxPrice: "",
    tradePriceCurrency: "divine",
  };
}
export function initial(): State {
  return {
    version: 1,
    current: "default",
    presets: [{ id: "default", name: "Default", settings: defaults() }],
  };
}
export function toggle(
  s: Settings,
  side: "wanted" | "unwanted",
  ids: string[],
): Settings {
  const other = side === "wanted" ? "unwanted" : "wanted";
  const remove = ids.every((id) => s[side].includes(id));
  return {
    ...s,
    [side]: remove
      ? s[side].filter((id) => !ids.includes(id))
      : [...new Set([...s[side], ...ids])],
    [other]: remove ? s[other] : s[other].filter((id) => !ids.includes(id)),
  };
}
export function restore(storage: Pick<Storage, "getItem">): State {
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? "null") as State;
    if (
      raw?.version !== 1 ||
      !Array.isArray(raw.presets) ||
      !raw.presets.length
    )
      return initial();
    const ids = new Set(modifiers.map((m) => m.id));
    const seen = new Set<string>();
    const presets = raw.presets.map((p) => {
      if (
        !p ||
        typeof p.id !== "string" ||
        seen.has(p.id) ||
        typeof p.name !== "string" ||
        !p.name.trim()
      )
        throw Error();
      seen.add(p.id);
      const s = p.settings;
      if (!s || !Array.isArray(s.wanted) || !Array.isArray(s.unwanted))
        throw Error();
      const wanted = [...new Set(s.wanted.filter((id) => ids.has(id)))];
      return {
        id: p.id,
        name: p.name,
        settings: {
          ...defaults(),
          ...s,
          wanted,
          unwanted: [
            ...new Set(
              s.unwanted.filter((id) => ids.has(id) && !wanted.includes(id)),
            ),
          ],
          custom: typeof s.custom === "string" ? s.custom : "",
          requiredItem:
            typeof s.requiredItem === "string" ? s.requiredItem : "",
          challenge: challenges.includes(
            s.challenge as (typeof challenges)[number],
          )
            ? s.challenge
            : "",
          challengeNot: s.challengeNot === true,
          tradeLeague:
            typeof s.tradeLeague === "string" ? s.tradeLeague : "Covens",
          tradeStatus: ["securable", "online", "any"].includes(s.tradeStatus)
            ? s.tradeStatus
            : "securable",
          tradeReward: [
            "",
            "DoubleCurrency",
            "DoubleDivCards",
            "MirrorRare",
            "ExchangeUnique",
          ].includes(s.tradeReward)
            ? s.tradeReward
            : "",
          tradeMinPrice:
            typeof s.tradeMinPrice === "string" ? s.tradeMinPrice : "",
          tradeMaxPrice:
            typeof s.tradeMaxPrice === "string" ? s.tradeMaxPrice : "",
          tradePriceCurrency:
            s.tradePriceCurrency === "chaos" ? "chaos" : "divine",
          match: s.match === "all" ? "all" : "any",
          customMode: s.customMode === "regex" ? "regex" : "literal",
          customCondition:
            s.customCondition === "exclude" ? "exclude" : "include",
          limit: Number.isInteger(s.limit) && s.limit > 0 ? s.limit : 250,
        } as Settings,
      };
    });
    return {
      version: 1,
      presets,
      current: presets.some((p) => p.id === raw.current)
        ? raw.current
        : presets[0].id,
    };
  } catch {
    return initial();
  }
}
export function persist(
  storage: Pick<Storage, "setItem">,
  state: State,
): boolean {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

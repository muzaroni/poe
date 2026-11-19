import { modifiers } from "../data/modifiers";
import { customConditions, type Settings } from "./storage";
import { modifierFragments, challengeFragments, familyFragments } from "../data/searchFragments";
export interface Condition {
  label: string;
  pattern: string;
  negative: boolean;
  group: "wanted" | "unwanted" | "custom" | "filter";
}
export const escapeRegex = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Factor literal alternatives only: typed text stays literal, including punctuation.
export function compactLiterals(values: string[]): string {
  const words = [...new Set(values)].filter(word => !values.some(other => other !== word && word.includes(other)));
  const factor = (parts: string[]): string => {
    if (parts.length === 1) return escapeRegex(parts[0]);
    let length = 0;
    while (parts.every(part => part[length] !== undefined && part[length] === parts[0][length])) length++;
    if (length) {
      const rest = factor(parts.map(part => part.slice(length)));
      return escapeRegex(parts[0].slice(0, length)) + (rest.includes("|") ? `(${rest})` : rest);
    }
    if (parts.every(part => part.length === 1))
      return `[${parts.map(part => escapeRegex(part).replace(/-/g, "\\-")).join("")}]`;
    const groups = new Map<string, string[]>();
    for (const part of parts) groups.set(part[0], [...(groups.get(part[0]) ?? []), part]);
    return [...groups.values()].map(group => group.length > 1 ? factor(group) : escapeRegex(group[0])).join("|");
  };
  if (!words.length) return "";
  const original = words.map(escapeRegex).join("|");
  const compact = factor(words);
  return compact.length < original.length ? compact : original;
}

// Only factor exact, known tier-label patterns. Future tooltip-based patterns
// stay untouched. Whole-family prefixes cover all known tiers; subsets keep
// boundaries needed to distinguish the unselected tiers and similar families.
export function compactPatterns(cs: Condition[]): string[] {
  if (cs.some(c => c.group !== "wanted" && c.group !== "unwanted"))
    return [...new Set(cs.map(c => c.pattern))];
  const groups = new Map<string, Condition[]>();
  for (const c of cs) {
    const m = modifiers.find((m) => m.pattern === c.pattern && m.tier !== null);
    const key =
      m && c.pattern === `^${escapeRegex(m.name)}$` ? m.family : c.pattern;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()].flatMap(([family, entries]) => {
    const originals = [...new Set(entries.map((c) => c.pattern))];
    if (
      family === "Stalking Ruin" &&
      originals.length === 4 &&
      [
        "^Stalking Ruin$",
        "^Stalking Ruin II$",
        "^Stalking Ruin III$",
        "^Stalking Ruin IV$",
      ].every((p) => originals.includes(p))
    )
      return ["^stalking"];
    if (
      family === "Ruin" &&
      originals.length === 3 &&
      ["^Ruin II$", "^Ruin III$", "^Ruin IV$"].every((p) =>
        originals.includes(p),
      )
    )
      return ["^ruin i[iv]"];
    if (
      originals.length < 2 ||
      !entries.every((c) =>
        modifiers.some((m) => m.family === family && m.pattern === c.pattern),
      )
    )
      return originals;
    const base = escapeRegex(family);
    const hasFirst = originals.includes(`^${base}$`);
    const suffixes = originals
      .filter((p) => p !== `^${base}$`)
      .map((p) => p.slice(base.length + 1, -1))
      .sort();
    const alternatives = suffixes.join("|").replace(" II| III", " III?");
    const suffix = alternatives.includes("|")
      ? `(${alternatives})`
      : alternatives;
    const factored = hasFirst
      ? `^${base}(${alternatives})?$`
      : `^${base}${suffix}$`;
    return factored.length < originals.join("|").length
      ? [factored]
      : originals;
  }).map((pattern) => {
    const modifier = modifiers.find(m => m.pattern === pattern && m.tier === null);
    if (modifier && pattern === `^${escapeRegex(modifier.name)}$`) {
      const prefix = `^${escapeRegex(modifier.name.split(" ")[0].toLowerCase())}`;
      // A whole first word is shorter without resorting to opaque fragments.
      if (prefix.length < pattern.length &&
          modifiers.filter(m => new RegExp(prefix, "i").test(m.name)).length === 1)
        return prefix;
    }
    for (const [family, fragment] of Object.entries(familyFragments)) {
      const prefix = `^${escapeRegex(family)}`;
      if (pattern.startsWith(prefix)) {
        // Only rewrite exact catalog labels or the tier groups factored above.
        const suffix = pattern.slice(prefix.length);
        if (suffix === "$" || suffix.startsWith(" ") || suffix.startsWith("("))
          return fragment + suffix;
      }
    }
    return pattern;
  });
}
export function validatePattern(pattern: string): string | null {
  if (/["\r\n]/.test(pattern))
    return "Quotes and line breaks cannot be embedded in a search term.";
  if (/\(\?/.test(pattern) || /\\[1-9]/.test(pattern))
    return "Lookarounds, special groups and backreferences are unsupported.";
  if (/\\[bB]/.test(pattern))
    return "Word-boundary escapes are not supported by this conservative PoE subset.";
  try {
    new RegExp(pattern, "i");
  } catch {
    return "Invalid regular expression.";
  }
  return null;
}
export function generate(s: Settings) {
  const warnings: string[] = [];
  const conditions: Condition[] = [];
  for (const [side, negative] of [
    ["unwanted", true],
    ["wanted", false],
  ] as const)
    for (const id of [...new Set(s[side])]) {
      const m = modifiers.find((m) => m.id === id);
      if (!m) {
        warnings.push(`Unknown modifier: ${id}`);
        continue;
      }
      conditions.push({
        label: m.name + (m.tier === 1 ? " I" : ""),
        pattern: modifierFragments[m.pattern] ?? m.pattern,
        negative,
        group: side,
      });
    }
  if (s.wanted.some((id) => s.unwanted.includes(id)))
    warnings.push(
      "Conflicting selections: the same tier is wanted and unwanted.",
    );
  customConditions(s).forEach((custom, index) => {
    if (!custom.text.trim()) return;
    conditions.push({
      label: `Custom condition ${index + 1}`,
      pattern: custom.mode === "literal" ? escapeRegex(custom.text) : custom.text,
      negative: custom.condition === "exclude",
      group: "custom",
    });
  });
  if (s.requiredItem.trim())
    conditions.push({
      label: `Required Item: ${s.requiredItem.trim()}`,
      // Keep the sacrifice-label suffix: an item name alone also matches rewards.
      pattern: `ce: ${escapeRegex(({ "Divine Orb": "divine", "Chaos Orb": "chaos" } as Record<string, string>)[s.requiredItem.trim()] ?? s.requiredItem.trim())}`,
      negative: false,
      group: "filter",
    });
  if (s.challenge)
    conditions.push({
      label: `Challenge: ${s.challenge}`,
      pattern: challengeFragments[s.challenge] ?? escapeRegex(s.challenge),
      negative: s.challengeNot,
      group: "filter",
    });
  for (const c of conditions) {
    const error = validatePattern(c.pattern);
    if (error) warnings.push(`${c.label}: ${error}`);
  }
  const experimental = conditions.some((c) => c.group !== "custom");
  if (experimental)
    warnings.push("Unverified: confirm against actual item text in-game.");
  const terms: string[] = [];
  const searchTerms: { pattern: string; negative: boolean }[] = [];
  const pack = (cs: Condition[], negative: boolean, patterns = compactPatterns(cs)) => {
    if (patterns.length) {
      const pattern = patterns
        .map((p) => p.replace(/^!/, "[!]"))
        .join("|");
      searchTerms.push({ pattern, negative });
      terms.push(`"${negative ? "!" : ""}${pattern}"`);
    }
  };
  const literalExclusions = customConditions(s).filter(c => c.text.trim() && c.condition === "exclude" && c.mode === "literal");
  const merged = new Set<Condition>();
  const unwanted = conditions.filter(c => c.group === "unwanted");
  if (literalExclusions.length > 1) {
    const literals = new Set(literalExclusions.map(c => escapeRegex(c.text)));
    const extra = conditions.filter(c => c.negative && (c.group === "filter" || (c.group === "custom" && literals.has(c.pattern))));
    extra.forEach(c => merged.add(c));
    pack(unwanted, true, [...compactPatterns(unwanted), compactLiterals(literalExclusions.map(c => c.text)), ...extra.filter(c => c.group === "filter").map(c => c.pattern)]);
  } else pack(unwanted, true);
  const wanted = conditions.filter((c) => c.group === "wanted");
  if (s.match === "any") pack(wanted, false);
  else wanted.forEach((c) => pack([c], false));
  conditions
    .filter((c) => (c.group === "custom" || c.group === "filter") && !merged.has(c))
    .forEach((c) => pack([c], c.negative));
  const invalid = warnings.some((w) => !w.startsWith("Unverified:"));
  const query = invalid ? "" : terms.join(" ");
  if (query.length > s.limit)
    warnings.push(
      `Character limit exceeded by ${query.length - s.limit}. Query has not been truncated.`,
    );
  return { query, conditions, searchTerms, warnings, invalid, experimental };
}
// Interpret the PoE query terms (AND between terms, OR inside terms), never the whole query as JS regex.
export function simulate(s: Settings, text: string) {
  const result = generate(s);
  if (result.invalid) return { highlight: null, matches: [] };
  const matches = result.conditions.map((c) => ({
    ...c,
    matched: new RegExp(c.pattern, "im").test(text.replace(/\r\n/g, "\n")),
  }));
  return {
    highlight: result.searchTerms.every((term) => {
      const matched = new RegExp(term.pattern, "im").test(
        text.replace(/\r\n/g, "\n"),
      );
      return term.negative ? !matched : matched;
    }),
    matches,
  };
}

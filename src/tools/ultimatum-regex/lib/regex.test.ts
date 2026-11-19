import { describe, it, expect } from "vitest";
import { modifiers } from "../data/modifiers";
import { defaults, initial, toggle, persist, restore, KEY } from "./storage";
import { generate, simulate, escapeRegex } from "./regex";
import screenshotFixture from "../data/fixtures/divine-altar-screenshot.json";
const id = (name: string) => modifiers.find((m) => m.name === name)!.id;
const empty = () => ({ ...defaults(), wanted: [], unwanted: [] });
describe("query engine (synthetic label fixtures, NOT verified item text)", () => {
  it("generates the requested compact Divine / no stone circles query", () => {
    const s = {
      ...defaults(),
      requiredItem: "Divine Orb",
      challenge: "Stand in the Stone Circles" as const,
      challengeNot: true,
    };
    expect(generate(s).query).toBe(
      '"!^stalking|^ruin i[iv]|recovery ii$|drought" "ce: divine" "!circles"',
    );
    expect(generate(s).query.length).toBeLessThan(100);
    expect(
      simulate(
        s,
        "Requires Sacrifice: Divine Orb x1\nChallenge: Protect the Altar\nRuin",
      ).highlight,
    ).toBe(true);
    expect(
      simulate(
        s,
        "Requires Sacrifice: Divine Orb x1\nChallenge: Stand in the Stone Circles",
      ).highlight,
    ).toBe(false);
  });
  it("preserves exact tier matching when only a subset of Stalking Ruin is selected", () => {
    const s = { ...empty(), unwanted: [id("Stalking Ruin II")] };
    expect(simulate(s, "Stalking Ruin III").highlight).toBe(true);
    expect(simulate(s, "Stalking Ruin II").highlight).toBe(false);
  });
  it("evaluates the actual optimized query terms in the simulator", () => {
    const s = {
      ...empty(),
      unwanted: modifiers
        .filter((m) => m.family === "Stalking Ruin")
        .map((m) => m.id),
    };
    expect(simulate(s, "Stalking Ruin IV (tooltip suffix)").highlight).toBe(
      false,
    );
    expect(
      simulate(
        { ...empty(), unwanted: [id("Reduced Recovery II")] },
        "Reduced Recovery III",
      ).highlight,
    ).toBe(true);
  });
  it("matches the screenshot's sacrifice and challenge labels, without matching rewards", () => {
    const settings = {
      ...empty(),
      requiredItem: "Divine Orb",
      challenge: "Protect the Altar" as const,
    };
    expect(simulate(settings, screenshotFixture.text).highlight).toBe(true);
    expect(
      simulate(
        { ...settings, requiredItem: "Chaos Orb" },
        screenshotFixture.text,
      ).highlight,
    ).toBe(false);
    expect(
      simulate({ ...settings, challengeNot: true }, screenshotFixture.text)
        .highlight,
    ).toBe(false);
    expect(
      simulate(
        settings,
        screenshotFixture.text
          .replace(
            "Requires Sacrifice: Divine Orb x1",
            "Requires Sacrifice: Chaos Orb x1",
          )
          .replace("Doubles sacrificed Currency", "Divine Orb"),
      ).highlight,
    ).toBe(false);
    expect(generate(settings).experimental).toBe(true);
  });
  it("compacts all four Stalking Ruin tiers without broadening the match", () => {
    const ids = modifiers
      .filter((m) => m.family === "Stalking Ruin")
      .map((m) => m.id);
    const r = generate({ ...empty(), unwanted: ids });
    expect(r.query).toBe('"!^stalking"');
    expect(r.query.length).toBeLessThan(35);
  });
  it("preserves every tier subset when compacting positive and negative terms", () => {
    for (const family of ["Ruin", "Stalking Ruin", "Reduced Recovery"]) {
      const entries = modifiers.filter((m) => m.family === family);
      for (let bits = 1; bits < 1 << entries.length; bits++) {
        const selected = entries.filter((_, i) => bits & (1 << i));
        for (const side of ["wanted", "unwanted"] as const) {
          const r = generate({ ...empty(), [side]: selected.map((m) => m.id) });
          const raw = r.query.slice(1, -1);
          const pattern = new RegExp(
            side === "unwanted" ? raw.slice(1) : raw,
            "i",
          );
          for (const text of [
            ...entries.map((m) => m.name),
            "Stalking Ruin II",
            "Ruin II",
            "Other " + family,
          ]) {
            expect(pattern.test(text)).toBe(
              selected.some((m) => new RegExp(m.pattern, "i").test(text)),
            );
          }
        }
      }
    }
  });
  it("keeps All matching as separate required terms", () => {
    const ids = modifiers
      .filter((m) => m.family === "Stalking Ruin")
      .map((m) => m.id);
    expect(
      generate({ ...empty(), wanted: ids, match: "all" }).query.match(/" "/g),
    ).toHaveLength(3);
  });
  it("adds a literal Required Item condition and checks the required-item line", () => {
    const settings = { ...empty(), requiredItem: "Divine Orb" };
    expect(generate(settings).query).toBe('"ce: divine"');
    expect(
      simulate(settings, "Requires Sacrifice: Divine Orb x1").highlight,
    ).toBe(true);
    expect(
      simulate(settings, "Requires Sacrifice: Chaos Orb x1\nReward: Divine Orb")
        .highlight,
    ).toBe(false);
    expect(
      generate({ ...empty(), requiredItem: "Orb (test)" }).query,
    ).toContain("Orb \\(test\\)");
  });
  it("supports challenge selection, Any, and Not without a Have operator", () => {
    const settings = { ...empty(), challenge: "Survive" as const };
    expect(generate(settings).query).toBe('"survive"');
    expect(simulate(settings, "Challenge: Survive").highlight).toBe(true);
    expect(generate({ ...settings, challengeNot: true }).query).toBe(
      '"!survive"',
    );
    expect(
      simulate({ ...settings, challengeNot: true }, "Challenge: Survive")
        .highlight,
    ).toBe(false);
    expect(
      generate({ ...settings, challenge: "", challengeNot: true }).query,
    ).toBe("");
  });
  it("keeps literal leading exclamation marks separate from query negation", () => {
    expect(generate({ ...empty(), custom: "!foo" }).query).toBe('"[!]foo"');
    expect(
      generate({ ...empty(), custom: "!foo", customCondition: "exclude" })
        .query,
    ).toBe('"![!]foo"');
    expect(simulate({ ...empty(), custom: "!foo" }, "!foo").highlight).toBe(
      true,
    );
  });
  it("initial defaults include exact requested tiers", () => {
    expect(
      defaults()
        .unwanted.map((i) => modifiers.find((m) => m.id === i)!.name)
        .sort(),
    ).toEqual(
      [
        "Stalking Ruin",
        "Stalking Ruin II",
        "Stalking Ruin III",
        "Stalking Ruin IV",
        "Ruin II",
        "Ruin III",
        "Ruin IV",
        "Reduced Recovery II",
        "Drought",
      ].sort(),
    );
  });
  it("single selection uses a negative PoE term", () =>
    expect(generate({ ...empty(), unwanted: [id("Drought")] }).query).toBe(
      '"!drought"',
    ));
  it("merges and deduplicates exclusions", () =>
    expect(
      generate({
        ...empty(),
        unwanted: [id("Drought"), id("Ruin II"), id("Drought")],
      }).query,
    ).toBe('"!drought|^Ruin II$"'));
  it("distinguishes II from III and similar family names", () => {
    const s = { ...empty(), unwanted: [id("Ruin II")] };
    expect(simulate(s, "Ruin II").highlight).toBe(false);
    expect(simulate(s, "Ruin III").highlight).toBe(true);
    expect(simulate(s, "Stalking Ruin II").highlight).toBe(true);
  });
  it("distinguishes reduced recovery tiers", () => {
    const s = { ...empty(), wanted: [id("Reduced Recovery II")] };
    expect(simulate(s, "Reduced Recovery").highlight).toBe(false);
    expect(simulate(s, "Reduced Recovery II").highlight).toBe(true);
  });
  it("combines wants and exclusions", () => {
    const s = {
      ...empty(),
      wanted: [id("Ruin III")],
      unwanted: [id("Drought")],
    };
    expect(simulate(s, "Ruin III\r\nDrought").highlight).toBe(false);
    expect(simulate(s, "Ruin III").highlight).toBe(true);
    expect(generate(s).query).toBe('"!drought" "^Ruin III$"');
  });
  it("any and all evaluate different AND/OR semantics", () => {
    const s = { ...empty(), wanted: [id("Ruin II"), id("Drought")] };
    expect(simulate(s, "Drought").highlight).toBe(true);
    expect(simulate({ ...s, match: "all" }, "Drought").highlight).toBe(false);
    expect(simulate({ ...s, match: "all" }, "Drought\nRuin II").highlight).toBe(
      true,
    );
  });
  it("does not truncate long queries", () => {
    const r = generate({ ...empty(), custom: "x".repeat(300) });
    expect(r.query.length).toBe(302);
    expect(r.warnings.join()).toContain("exceeded");
  });
  it("literal custom text escapes operators", () => {
    expect(escapeRegex("a+b.(x)")).toBe("a\\+b\\.\\(x\\)");
    expect(
      simulate({ ...empty(), custom: "a+b.(x)" }, "a+b.(x)").highlight,
    ).toBe(true);
  });
  it("custom advanced negative condition", () =>
    expect(
      simulate(
        {
          ...empty(),
          custom: "foo|bar",
          customMode: "regex",
          customCondition: "exclude",
        },
        "bar",
      ).highlight,
    ).toBe(false));
  it.each(["(?=foo)", "(?<=foo)", "[", 'foo"bar', "foo\nbar", "\\bfoo"])(
    "blocks unsafe or unsupported custom pattern %s",
    (custom) =>
      expect(
        generate({ ...empty(), custom, customMode: "regex" }).invalid,
      ).toBe(true),
  );
  it("flags conflicts and leaves no misleading query", () =>
    expect(
      generate({
        ...empty(),
        wanted: [id("Drought")],
        unwanted: [id("Drought")],
      }).query,
    ).toBe(""));
  it("empty selections match all", () => {
    expect(generate(empty()).query).toBe("");
    expect(simulate(empty(), "any item").highlight).toBe(true);
  });
  it("never treats label tests as in-game verification", () => {
    expect(generate(defaults()).experimental).toBe(true);
    expect(modifiers.every((m) => m.validation === "unverified")).toBe(true);
  });
});
describe("selections and browser storage", () => {
  it("tiers toggle independently and transfer between sides", () => {
    let s = toggle(empty(), "unwanted", [id("Ruin II")]);
    s = toggle(s, "wanted", [id("Ruin II")]);
    expect(s.unwanted).toEqual([]);
    expect(s.wanted).toEqual([id("Ruin II")]);
    s = toggle(s, "wanted", [id("Ruin III")]);
    expect(s.wanted).toHaveLength(2);
  });
  it("family toggle selects all then clears all", () => {
    const ids = modifiers
      .filter((m) => m.family === "Stalking Ruin")
      .map((m) => m.id);
    const s = toggle(empty(), "wanted", ids);
    expect(s.wanted).toHaveLength(4);
    expect(toggle(s, "wanted", ids).wanted).toEqual([]);
  });
  it("round trips independent presets and every setting", () => {
    const state = initial();
    state.presets.push({
      id: "second",
      name: "Second",
      settings: {
        ...empty(),
        custom: "test",
        match: "all",
        customMode: "regex",
        customCondition: "exclude",
        limit: 50,
        requiredItem: "Chaos Orb",
        challenge: "Protect the Altar",
        challengeNot: true,
      },
    });
    state.current = "second";
    let value = "";
    const storage = {
      setItem: (_k: string, v: string) => {
        value = v;
      },
      getItem: () => value,
    };
    expect(persist(storage, state)).toBe(true);
    expect(restore(storage)).toEqual(state);
    expect(restore(storage).presets[0].settings.custom).toBe("");
  });
  it("recovers invalid storage and handles unavailable storage", () => {
    expect(restore({ getItem: () => "{" })).toEqual(initial());
    expect(
      persist(
        {
          setItem: () => {
            throw Error();
          },
        },
        initial(),
      ),
    ).toBe(false);
  });
  it("repairs stale ids and conflicting storage", () => {
    const state = initial();
    state.presets[0].settings = {
      ...empty(),
      wanted: [id("Drought")],
      unwanted: [id("Drought"), "stale"],
    };
    expect(
      restore({ getItem: (k) => (k === KEY ? JSON.stringify(state) : null) })
        .presets[0].settings.unwanted,
    ).toEqual([]);
  });
  it("migrates old saved presets without losing their selections", () => {
    const state = initial();
    const raw = JSON.parse(JSON.stringify(state));
    delete raw.presets[0].settings.requiredItem;
    delete raw.presets[0].settings.challenge;
    delete raw.presets[0].settings.challengeNot;
    expect(restore({ getItem: () => JSON.stringify(raw) })).toEqual(state);
  });
});

// Every selected tier must remain distinct from every other catalog entry.
describe("compact fragment coverage", () => {
  it("preserves all family subsets across the complete catalog", () => {
    for (const family of new Set(modifiers.map(m => m.family))) {
      const entries = modifiers.filter(m => m.family === family);
      for (let mask = 1; mask < 1 << entries.length; mask++) {
        const selected = entries.filter((_, i) => mask & (1 << i));
        for (const side of ["wanted", "unwanted"] as const) {
          const settings = { ...empty(), [side]: selected.map(m => m.id) };
          for (const candidate of modifiers) {
            expect(simulate(settings, candidate.name).highlight,
              `${family} subset ${mask} ${side}: ${candidate.name}`,
            ).toBe(side === "wanted" ? selected.includes(candidate) : !selected.includes(candidate));
          }
        }
      }
    }
  });
  it("shortens defaults and long labels without altering custom regex", () => {
    expect(generate(defaults()).query.length).toBeLessThan(52);
    const selected = modifiers.find(m => m.family === "Lightning Damage from Mana Costs")!;
    expect(generate({ ...empty(), wanted: [selected.id] }).query).toBe('"^lightning"');
    expect(generate({ ...empty(), custom: "^Choking Miasma$", customMode: "regex" }).query).toBe('"^Choking Miasma$"');
  });
});

describe("compact item and challenge filters", () => {
  it("keeps sacrifice currency distinct from rewards, other currencies and similar item names", () => {
    for (const [requiredItem, expected] of [["Divine Orb", '"ce: divine"'], ["Chaos Orb", '"ce: chaos"']]) {
      const settings = { ...empty(), requiredItem };
      expect(generate(settings).query).toBe(expected);
      expect(simulate(settings, `Requires Sacrifice: ${requiredItem} x1`).highlight).toBe(true);
      for (const other of ["Exalted Orb", "Divination Distillate", requiredItem === "Divine Orb" ? "Chaos Orb" : "Divine Orb"])
        expect(simulate(settings, `Requires Sacrifice: ${other} x1\nReward: ${requiredItem}`).highlight).toBe(false);
      expect(simulate(settings, `Reward: ${requiredItem}`).highlight).toBe(false);
    }
  });
  it("preserves literal custom required-item names", () => {
    const settings = { ...empty(), requiredItem: "Orb (test)" };
    expect(simulate(settings, "Requires Sacrifice: Orb (test) x1").highlight).toBe(true);
    expect(simulate(settings, "Requires Sacrifice: Chaos Orb x1\nReward: Orb (test)").highlight).toBe(false);
  });
  it("distinguishes every challenge in positive and negative filters", () => {
    const challenges = ["Defeat Waves of Enemies", "Survive", "Protect the Altar", "Stand in the Stone Circles"] as const;
    for (const challenge of challenges)
      for (const challengeNot of [false, true])
        for (const candidate of challenges) {
          const settings = { ...empty(), challenge, challengeNot };
          expect(simulate(settings, `Challenge: ${candidate}\nRequires Sacrifice: Divine Orb x1\n${modifiers.map(m => m.name).join("\n")}`).highlight).toBe(challengeNot ? candidate !== challenge : candidate === challenge);
        }
  });
});

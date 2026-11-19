// Candidate fragments for English item text. Still require in-game confirmation.
// Match exact source patterns so later tooltip-pattern edits are not overwritten.
export const modifierFragments: Record<string, string> = {
  "^Drought$": "drought",
  "^Reduced Recovery II$": "recovery ii$",
};
export const challengeFragments: Record<string, string> = {
  "Defeat Waves of Enemies": "waves",
  Survive: "survive",
  "Protect the Altar": "altar",
  "Stand in the Stone Circles": "circles",
};

// Distinctive suffixes of known English labels. Keep the end anchor for exact
// tier selection; never apply these substitutions to user-provided regexes.
export const familyFragments: Record<string, string> = {
  "Choking Miasma": "miasma",
  "Stormcaller Runes": "runes",
  "Raging Dead": "ging dead",
  "Blistering Cold": "cold",
  "Restless Ground": "ground",
  "Razor Dance": "dance",
};

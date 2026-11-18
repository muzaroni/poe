// Labels from the official trade filters snapshot; tooltip matching is unverified.
export const challenges = [
  "Defeat Waves of Enemies",
  "Survive",
  "Protect the Altar",
  "Stand in the Stone Circles",
] as const;
export type Challenge = "" | (typeof challenges)[number];

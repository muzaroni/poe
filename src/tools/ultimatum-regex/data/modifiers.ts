import data from "./modifiers.json";
export interface Modifier {
  id: string;
  name: string;
  family: string;
  tier: number | null;
  pattern: string;
  actualText: string | null;
  validation: string;
  source: string;
  tradeIds: string[];
}
export const modifiers: Modifier[] = data;
export const families = [...new Set(modifiers.map((m) => m.family))].sort(
  (a, b) => a.localeCompare(b),
);
export const roman = ["", "I", "II", "III", "IV"];

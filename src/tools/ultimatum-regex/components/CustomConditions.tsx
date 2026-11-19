import { customConditions, type CustomCondition, type Settings } from "../lib/storage";
import { SectionHeading } from "./SectionHeading";

export function CustomConditions({ settings, onChange }: {
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
}) {
  const rows = customConditions(settings);
  function save(next: CustomCondition[]) {
    const [first, ...rest] = next.length ? next : [{ text: "", condition: "include" as const, mode: "literal" as const }];
    onChange({ custom: first.text, customCondition: first.condition, customMode: first.mode, customConditions: rest });
  }
  function update(index: number, change: Partial<CustomCondition>) {
    save(rows.map((row, i) => i === index ? { ...row, ...change } : row));
  }
  return <section className="custom-panel">
    <SectionHeading icon="✦" tone="violet">Custom conditions</SectionHeading>
    <p className="custom-help">All conditions apply. Plain-text exclusions are combined and shortened automatically.</p>
    {rows.map((row, index) => <div className="custom-controls custom-condition-row" key={index}>
      <select aria-label={`Custom condition ${index + 1}`} value={row.condition} onChange={e => update(index, { condition: e.target.value as CustomCondition["condition"] })}>
        <option value="include">Must contain</option><option value="exclude">Must not contain</option>
      </select>
      <input aria-label={`Custom text or regex ${index + 1}`} placeholder={row.mode === "literal" ? "Add text to match…" : "Enter a regex pattern…"} value={row.text} onChange={e => update(index, { text: e.target.value })} />
      <div className="segmented">
        {(["literal", "regex"] as const).map(mode => <button key={mode} className={row.mode === mode ? "chosen" : ""} aria-pressed={row.mode === mode} onClick={() => update(index, { mode })}>{mode === "literal" ? "Literal text" : "Advanced regex"}</button>)}
      </div>
      <button className="remove-condition" aria-label={`Remove custom condition ${index + 1}`} onClick={() => save(rows.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <button className="add-condition" onClick={() => save([...rows, { text: "", condition: "exclude", mode: "literal" }])}>+ Add condition</button>
  </section>;
}

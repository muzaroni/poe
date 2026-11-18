import { useState } from "react";
import { families, modifiers, roman } from "../data/modifiers";
import type { Settings } from "../lib/storage";
export function ModifierColumn({
  side,
  settings,
  onToggle,
  onClear,
  onMatch,
}: {
  side: "wanted" | "unwanted";
  settings: Settings;
  onToggle: (ids: string[]) => void;
  onClear: () => void;
  onMatch: () => void;
}) {
  const [search, setSearch] = useState("");
  const selected = settings[side];
  const visible = families.filter((f) =>
    f.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className={`modifier-panel ${side}`}>
      <div className="panel-heading">
        <div>
          <span className="square">{side === "unwanted" ? "−" : "+"}</span>
          <h2>{side === "unwanted" ? "Don't Want" : "Want"}</h2>
          <span className="count">{selected.length}</span>
        </div>
        <button className="text-button" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="panel-tools">
        <input
          aria-label={`Search ${side} modifiers`}
          placeholder="Search modifiers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {side === "wanted" && (
          <button
            className="match-toggle"
            onClick={onMatch}
            title="Toggle wanted matching"
          >
            Match <strong>{settings.match === "any" ? "Any" : "All"}</strong> ⇄
          </button>
        )}
      </div>
      <div className="list-label">
        <span>MODIFIER</span>
        <span>TIERS</span>
      </div>
      <div className="modifier-list">
        {visible.map((f) => {
          const entries = modifiers
            .filter((m) => m.family === f)
            .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
          const active = entries.some((m) => selected.includes(m.id));
          return (
            <div className={`modifier-row ${active ? "active" : ""}`} key={f}>
              <button
                className="family-name"
                onClick={() => onToggle(entries.map((m) => m.id))}
                title={`${f} — toggle all tiers; patterns unverified`}
              >
                <span className="family-label">{f}</span>
                <span
                  className="unverified-dot"
                  aria-label="Unverified pattern"
                />
              </button>
              <div className="tiers">
                {entries.map((m) => (
                  <button
                    key={m.id}
                    aria-label={`${side}: ${f} ${m.tier ? roman[m.tier] : "single"}`}
                    aria-pressed={selected.includes(m.id)}
                    className={selected.includes(m.id) ? "selected" : ""}
                    onClick={() => onToggle([m.id])}
                  >
                    {m.tier ? roman[m.tier] : "✓"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!visible.length && <p className="empty">No modifiers found.</p>}
      </div>
    </section>
  );
}

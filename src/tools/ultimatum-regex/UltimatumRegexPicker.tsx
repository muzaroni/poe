import { useEffect, useState } from "react";
import { ModifierColumn } from "./components/ModifierColumn";
import { TradeLinks } from "./components/TradeLinks";
import { SectionHeading } from "./components/SectionHeading";
import { defaults, initial, persist, restore, toggle } from "./lib/storage";
import type { Settings, State } from "./lib/storage";
import { generate, simulate } from "./lib/regex";
import { modifiers } from "./data/modifiers";
import { challenges } from "./data/filters";
import { modifierFragments } from "./data/searchFragments";
import "./style.css";
function load() {
  try {
    return restore(localStorage);
  } catch {
    return initial();
  }
}
export default function UltimatumRegexPicker() {
  const [state, setState] = useState<State>(load);
  const [saveError, setSaveError] = useState(false);
  const [copy, setCopy] = useState("");
  const [presetMenu, setPresetMenu] = useState(false);
  const [item, setItem] = useState("");
  const [name, setName] = useState("");
  const [presetAction, setPresetAction] = useState<"create" | "rename" | null>(
    null,
  );
  const current = state.presets.find((p) => p.id === state.current)!;
  const s = current.settings;
  const result = generate(s);
  const test = simulate(s, item);
  useEffect(() => {
    try {
      setSaveError(!persist(localStorage, state));
    } catch {
      setSaveError(true);
    }
  }, [state]);
  useEffect(() => {
    setCopy("");
  }, [result.query]);
  function update(change: Partial<Settings>) {
    setState((prev) => ({
      ...prev,
      presets: prev.presets.map((p) =>
        p.id === prev.current
          ? { ...p, settings: { ...p.settings, ...change } }
          : p,
      ),
    }));
  }
  function savePreset() {
    if (!name.trim()) return;
    if (presetAction === "rename")
      setState((prev) => ({
        ...prev,
        presets: prev.presets.map((p) =>
          p.id === prev.current ? { ...p, name: name.trim() } : p,
        ),
      }));
    else {
      const id = crypto.randomUUID();
      setState((prev) => ({
        ...prev,
        current: id,
        presets: [
          ...prev.presets,
          { id, name: name.trim(), settings: structuredClone(s) },
        ],
      }));
    }
    setPresetAction(null);
    setName("");
  }
  async function copyRegex() {
    try {
      await navigator.clipboard.writeText(result.query);
      setCopy("Copied!");
    } catch {
      setCopy("Clipboard unavailable. Select and copy the output manually.");
    }
  }
  return (
    <main className="ultimatum-picker">
      <header>
        <h1>
          Ultimatum <span>Regex Picker</span>
        </h1>
        <div className="preset-bar">
          <label htmlFor="preset">PRESET</label>
          <select
            id="preset"
            value={state.current}
            onChange={(e) => setState({ ...state, current: e.target.value })}
          >
            {state.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="preset-manager">
            <button
              className="preset-more"
              aria-label="Preset actions"
              aria-expanded={presetMenu}
              onClick={() => setPresetMenu(!presetMenu)}
            >
              ⋯
            </button>
            {presetMenu && (
              <div className="preset-menu" onClick={() => setPresetMenu(false)}>
                <button
                  onClick={() => {
                    setPresetAction("create");
                    setName("");
                  }}
                >
                  + New preset
                </button>
                <button
                  onClick={() => {
                    setPresetAction("rename");
                    setName(current.name);
                  }}
                >
                  Rename
                </button>
                <button
                  disabled={state.presets.length === 1}
                  onClick={() => {
                    const remaining = state.presets.filter(
                      (p) => p.id !== state.current,
                    );
                    setState({
                      ...state,
                      current: remaining[0].id,
                      presets: remaining,
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <section className="output-panel">
        <div className="section-title">
          <SectionHeading icon="⌁" tone="blue">
            Generated regex
          </SectionHeading>
          {result.invalid && <span className="danger">Invalid condition</span>}
        </div>
        <textarea
          aria-label="Generated regex"
          className="regex-output"
          readOnly
          value={result.query}
          placeholder="No conditions — all items will match."
          rows={2}
        />
        <div className="output-actions">
          <div
            className={`char-count ${result.query.length > s.limit ? "danger" : ""}`}
          >
            <strong>{result.query.length}</strong> /{" "}
            <input
              aria-label="Character limit"
              type="number"
              min="1"
              max="99999"
              value={s.limit}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isInteger(value) && value > 0)
                  update({ limit: value });
              }}
            />{" "}
            characters
          </div>
          <button onClick={() => update(defaults())}>Reset</button>
          <button
            className="primary"
            disabled={!result.query || result.invalid}
            onClick={copyRegex}
          >
            ⧉ {copy === "Copied!" ? "Copied!" : "Copy Regex"}
          </button>
        </div>
        <div aria-live="polite">
          {copy && copy !== "Copied!" && (
            <p className="copy-feedback">{copy}</p>
          )}
          {result.warnings
            .filter((w) => !w.startsWith("Unverified:"))
            .map((w) => (
              <p className="warning" key={w}>
                ⚠ {w}
              </p>
            ))}
        </div>
      </section>
      <TradeLinks settings={s} onChange={update} />
      {presetAction && (
        <form
          className="preset-form"
          onSubmit={(e) => {
            e.preventDefault();
            savePreset();
          }}
        >
          <input
            autoFocus
            aria-label="Preset name"
            placeholder="Preset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
          <button className="primary">
            {presetAction === "create" ? "Create from current" : "Save name"}
          </button>
          <button type="button" onClick={() => setPresetAction(null)}>
            Cancel
          </button>
        </form>
      )}
      {saveError && (
        <p role="alert" className="warning">
          Browser storage is unavailable. Changes cannot be saved.
        </p>
      )}
      <section className="item-filters">
        <SectionHeading icon="◇" tone="brass">
          Item filters
        </SectionHeading>
        <label className="filter-field">
          Required Item
          <input
            aria-label="Required Item"
            list="required-items"
            placeholder="Any / type an item…"
            value={s.requiredItem}
            onChange={(e) => update({ requiredItem: e.target.value })}
          />
          <datalist id="required-items">
            <option value="Divine Orb" />
            <option value="Chaos Orb" />
          </datalist>
        </label>
        <div className="filter-field">
          <label htmlFor="challenge">Challenge Type</label>
          <div className="challenge-controls">
            <select
              id="challenge"
              value={s.challenge}
              onChange={(e) =>
                update({ challenge: e.target.value as Settings["challenge"] })
              }
            >
              <option value="">Any</option>
              {challenges.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label
              className={`not-toggle ${s.challengeNot && s.challenge ? "enabled" : ""}`}
            >
              <input
                type="checkbox"
                aria-label="Not challenge type"
                checked={s.challengeNot}
                disabled={!s.challenge}
                onChange={(e) => update({ challengeNot: e.target.checked })}
              />
              Not
            </label>
          </div>
        </div>
      </section>
      <SectionHeading icon="≡" tone="brass">
        Modifier tiers
      </SectionHeading>
      <div className="columns">
        {(["unwanted", "wanted"] as const).map((side) => (
          <ModifierColumn
            key={side}
            side={side}
            settings={s}
            onToggle={(ids) => update(toggle(s, side, ids))}
            onClear={() => update({ [side]: [] })}
            onMatch={() => update({ match: s.match === "any" ? "all" : "any" })}
          />
        ))}
      </div>
      <section className="custom-panel">
        <div className="section-title">
          <SectionHeading icon="✦" tone="violet">
            Custom condition
          </SectionHeading>
        </div>
        <div className="custom-controls">
          <select
            aria-label="Custom condition"
            value={s.customCondition}
            onChange={(e) =>
              update({
                customCondition: e.target.value as Settings["customCondition"],
              })
            }
          >
            <option value="include">Must contain</option>
            <option value="exclude">Must not contain</option>
          </select>
          <input
            aria-label="Custom text or regex"
            placeholder={
              s.customMode === "literal"
                ? "Add text to match…"
                : "Enter a regex pattern…"
            }
            value={s.custom}
            onChange={(e) => update({ custom: e.target.value })}
          />
          <div className="segmented">
            {(["literal", "regex"] as const).map((mode) => (
              <button
                key={mode}
                className={s.customMode === mode ? "chosen" : ""}
                aria-pressed={s.customMode === mode}
                onClick={() => update({ customMode: mode })}
              >
                {mode === "literal" ? "Literal text" : "Advanced regex"}
              </button>
            ))}
          </div>
        </div>
      </section>
      <details className="testing-panel">
        <summary>
          <span>⌁ Test item text</span>
          <span>APPROXIMATE SIMULATOR</span>
        </summary>

        <textarea
          aria-label="Copied item text"
          placeholder="Paste actual Inscribed Ultimatum item text here…"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          rows={7}
        />
        {item && (
          <div className="test-results">
            <strong className={test.highlight ? "success" : "danger"}>
              {test.highlight === null
                ? "Cannot evaluate invalid conditions"
                : test.highlight
                  ? "Should highlight (approximate)"
                  : "Should not highlight (approximate)"}
            </strong>
            {test.matches.map((m, i) => (
              <div key={i}>
                <span>{m.matched ? "Matched" : "Not matched"}</span>
                <span>
                  {m.group} · {m.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </details>
      <details className="testing-panel">
        <summary>
          <span>Pattern reference & sources</span>
          <span>{modifiers.length} ENTRIES · UNVERIFIED</span>
        </summary>
        <p>
          Trade-label patterns. Tooltip text and filter matches are unverified.
        </p>
        <p>
          <a
            href="https://www.poewiki.net/wiki/Ultimatum"
            target="_blank"
            rel="noreferrer"
          >
            PoE Wiki ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://www.pathofexile.com/api/trade/data/stats"
            target="_blank"
            rel="noreferrer"
          >
            Official trade modifiers ↗
          </a>
        </p>

        <div className="pattern-table">
          {modifiers.map((m) => (
            <div key={m.id}>
              <span>
                {m.name}
                <small>{m.id}</small>
              </span>
              <code>{modifierFragments[m.pattern] ?? m.pattern}</code>
              <span className="amber">Unverified</span>
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}

import { useEffect, useState } from "react";
import type { Settings } from "../lib/storage";
import { generateTradeLinks, type TradeLink } from "../lib/trade";
import { SectionHeading } from "./SectionHeading";

export function TradeLinks({
  settings: s,
  onChange,
}: {
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
}) {
  const [result, setResult] = useState<{
    settings: Settings;
    links: TradeLink[];
    errors: string[];
    notices: string[];
  } | null>(null);
  const [copy, setCopy] = useState("");
  useEffect(() => {
    let active = true;
    setCopy("");
    generateTradeLinks(s).then((value) => {
      if (active) setResult({ settings: s, ...value });
    });
    return () => {
      active = false;
    };
  }, [s]);
  const current = result?.settings === s ? result : null;
  const links = current?.links ?? [];
  async function copyLinks() {
    try {
      await navigator.clipboard.writeText(links.map((l) => l.url).join("\n"));
      setCopy("Copied!");
    } catch {
      setCopy("Select and copy the links below.");
    }
  }
  return (
    <section className="trade-panel" aria-label="Trade search">
      <SectionHeading icon="↗" tone="blue">
        PoE Trade
      </SectionHeading>
      <div className="trade-toolbar">
        <input
          aria-label="Trade league"
          list="trade-leagues"
          placeholder="League"
          value={s.tradeLeague}
          onChange={(e) => onChange({ tradeLeague: e.target.value })}
        />
        <datalist id="trade-leagues">
          <option value="Covens" />
          <option value="Standard" />
          <option value="Hardcore" />
        </datalist>
        <select
          aria-label="Trade availability"
          value={s.tradeStatus}
          onChange={(e) =>
            onChange({ tradeStatus: e.target.value as Settings["tradeStatus"] })
          }
        >
          <option value="securable">Instant Buyout</option>
          <option value="online">Online</option>
          <option value="any">Any availability</option>
        </select>
        <div className="trade-buttons">
          <button disabled={!links.length} onClick={copyLinks}>
            {copy === "Copied!"
              ? "Copied!"
              : links.length > 1
                ? "Copy Trade Links"
                : "Copy Trade Link"}
          </button>
          {links.length === 1 && (
            <a
              className="primary trade-open"
              href={links[0].url}
              target="_blank"
              rel="noreferrer"
            >
              Open Trade ↗
            </a>
          )}
          {!current && (
            <span className="trade-note" role="status">
              Generating…
            </span>
          )}
        </div>
      </div>
      <details className="trade-options">
        <summary>Trade options</summary>
        <div className="trade-option-fields">
          <label>
            Reward
            <select
              aria-label="Trade reward type"
              value={s.tradeReward}
              onChange={(e) =>
                onChange({
                  tradeReward: e.target.value as Settings["tradeReward"],
                })
              }
            >
              <option value="">Any</option>
              <option value="DoubleCurrency">Currency</option>
              <option value="DoubleDivCards">Divination Cards</option>
              <option value="MirrorRare">Mirrored Rare Item</option>
              <option value="ExchangeUnique">Unique Item</option>
            </select>
          </label>
          <label>
            Min price
            <input
              aria-label="Trade minimum price"
              type="number"
              min="0"
              step="any"
              placeholder="Any"
              value={s.tradeMinPrice}
              onChange={(e) => onChange({ tradeMinPrice: e.target.value })}
            />
          </label>
          <label>
            Max price
            <input
              aria-label="Trade maximum price"
              type="number"
              min="0"
              step="any"
              placeholder="Any"
              value={s.tradeMaxPrice}
              onChange={(e) => onChange({ tradeMaxPrice: e.target.value })}
            />
          </label>
          <label>
            Currency
            <select
              aria-label="Trade price currency"
              value={s.tradePriceCurrency}
              onChange={(e) =>
                onChange({
                  tradePriceCurrency: e.target
                    .value as Settings["tradePriceCurrency"],
                })
              }
            >
              <option value="divine">Divine Orb</option>
              <option value="chaos">Chaos Orb</option>
            </select>
          </label>
        </div>
      </details>
      <div aria-live="polite">
        {current?.errors.map((error) => (
          <p className="trade-error" key={error}>
            {error}
          </p>
        ))}
        {current?.notices.map((notice) => (
          <p className="trade-note" key={notice}>
            {notice}
          </p>
        ))}
        {links.length > 1 && (
          <div className="trade-variants">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        )}
        {copy && copy !== "Copied!" && (
          <>
            <p className="trade-note">{copy}</p>
            <textarea
              aria-label="Trade links to copy"
              readOnly
              rows={3}
              value={links.map((l) => l.url).join("\n")}
            />
          </>
        )}
      </div>
    </section>
  );
}

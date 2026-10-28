import { useEffect, useRef, useState } from 'react';
import { campaignActFromLog } from '../lib/client-log';

type LogHandle = { name: string; getFile: () => Promise<File> };
type PickerWindow = Window & { showOpenFilePicker?: (options: unknown) => Promise<LogHandle[]> };

export default function CampaignLogFollow({ onAct, following, onFollowing }: {
  onAct: (act: number) => void; following: boolean; onFollowing: (value: boolean) => void;
}) {
  const [handle, setHandle] = useState<LogHandle | null>(null);
  const [status, setStatus] = useState('Choose Path of Exile’s Client.txt. File contents stay on this computer.');
  const [supported, setSupported] = useState(false);
  const [picking, setPicking] = useState(false);
  const latest = useRef({ onAct, following });
  latest.current = { onAct, following };
  const detected = useRef<number | null>(null);
  useEffect(() => { setSupported(typeof (window as PickerWindow).showOpenFilePicker === 'function'); }, []);
  useEffect(() => {
    if (following && detected.current !== null) onAct(detected.current);
  }, [following]);
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let offset = -1;
    let modified = -1;
    let pending = '';
    let decoder = new TextDecoder();
    async function poll() {
      try {
        const file = await handle!.getFile();
        if (cancelled) return;
        if (offset < 0 || file.size < offset || (file.size === offset && file.lastModified !== modified)) {
          offset = Math.max(0, file.size - 262144);
          pending = '';
          decoder = new TextDecoder();
          detected.current = null;
        }
        if (file.size > offset) {
          const start = offset;
          // Bound each read even when resuming after a long background interval.
          const end = Math.min(file.size, start + 262144);
          const bytes = await file.slice(start, end).arrayBuffer();
          if (cancelled) return;
          let text = pending + decoder.decode(bytes, { stream: true });
          if (start > 0 && modified === -1) text = text.slice(text.indexOf('\n') + 1);
          const lines = text.split('\n');
          pending = lines.pop()!.slice(-8192);
          for (const line of lines) {
            const act = campaignActFromLog(line);
            if (act !== null) detected.current = act;
          }
          offset = end;
          if (detected.current !== null && latest.current.following) latest.current.onAct(detected.current);
        }
        modified = file.lastModified;
        setStatus(`${handle!.name} · ${detected.current === null ? 'Waiting for a campaign area (English client log).' : `Detected Act ${detected.current}`}`);
        timer = setTimeout(poll, offset < file.size ? 0 : 1000);
      } catch {
        if (!cancelled) {
          setStatus('Cannot read the log. Reconnect it to grant access again.');
          setHandle(null);
        }
      }
    }
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [handle]);
  async function connect() {
    setPicking(true);
    try {
      const [file] = await (window as PickerWindow).showOpenFilePicker!({ multiple: false, types: [{ description: 'Path of Exile client log', accept: { 'text/plain': ['.txt'] } }] });
      if (file) { detected.current = null; setHandle(file); onFollowing(true); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('Could not open the log. Try connecting again.');
    } finally { setPicking(false); }
  }
  return <div className="campaign-log-follow">
    {supported ? <>
      <button type="button" disabled={picking} onClick={() => void connect()}>{picking ? 'Choosing log…' : handle ? 'Change game log' : 'Connect game log'}</button>
      <label><input type="checkbox" checked={following} disabled={!handle} onChange={event => onFollowing(event.target.checked)} /> Auto-follow act</label>
      {handle && <button type="button" onClick={() => { setHandle(null); detected.current = null; onFollowing(false); setStatus('Log disconnected.'); }}>Disconnect</button>}
      <span role="status">{status}</span>
      <details className="campaign-log-notice"><summary>About log access and account risk</summary><p>Reads your selected Client.txt locally; nothing is uploaded. This optional feature is not GGG-approved, and we cannot guarantee it will avoid account restrictions. <a href="https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy" target="_blank" rel="noreferrer">GGG Terms of Use</a> · <a href="https://www.pathofexile.com/forum/view-thread/3491960/filter-account-type/staff" target="_blank" rel="noreferrer">Third-party tool guidance</a></p></details>
    </> : <span className="campaign-log-unsupported">Auto-follow is unavailable in this browser. It only works in desktop Google Chrome, Microsoft Edge, and Opera. Choose acts using the tabs below or the left and right arrow keys.</span>}
  </div>;
}

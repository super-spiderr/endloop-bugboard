import { useEffect, useRef, useState } from "react";
import { IMG } from "../lib/images";
import { Brand } from "./bits";

/** Passcode screen. Calls onUnlock(code, name), which resolves to an error message or null. */
export default function Gate({ configured, message, defaultName, onUnlock }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName || "");
  const [error, setError] = useState(message || "");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => setError(message || ""), [message]);
  useEffect(() => {
    if (configured) codeRef.current?.focus();
  }, [configured]);

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the passcode.");
      return;
    }
    setBusy(true);
    setError("");
    const err = await onUnlock(code.trim(), name.trim());
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
      codeRef.current?.focus();
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <Brand />
        <img className="loop" src={IMG.binoc} alt="" />
        <h1>{configured ? "Endloop test board" : "Board not set up yet"}</h1>
        <p>
          {configured
            ? "Enter the passcode you were given to see bugs, suggestions and roast lines."
            : "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README.md), then rebuild."}
        </p>
        {configured && (
          <form onSubmit={submit} noValidate>
            <label>
              Passcode
              <input id="gCode" ref={codeRef} type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label>
              <span>
                Your name <span style={{ fontWeight: 400, color: "var(--faint)" }}>shown on what you report</span>
              </span>
              <input id="gName" autoComplete="name" placeholder="e.g. Divya" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="gate-err" role="alert">{error}</div>
            <button className="btn primary" type="submit" id="gateBtn" disabled={busy}>
              {busy ? "Opening…" : "Open the board"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

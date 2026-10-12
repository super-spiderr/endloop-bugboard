import { useEffect, useRef, useState } from "react";
import {
  CAT_LABEL, INTENSITY, KINDS, LANGS, NATIVE_CATEGORIES, NATIVE_PLACEHOLDERS, PLACEHOLDERS,
  REVIEW, ROASTER, SCREENS, SEV, SSTATUS, STATUS,
} from "../lib/constants";
import { catLbl, codeOf, fmtDate, fmtDateTime, isOpen, lbl, reviewOf, sActive, screenLbl, sid, strip } from "../lib/format";
import Attachments from "./Attachments";
import Icon from "./Icon";
import { Line, Select } from "./bits";

const screenOpts = SCREENS.map((s) => [s[0], screenLbl(s[0])]);
const catOpts = Object.keys(CAT_LABEL).map((c) => [c, catLbl(c)]);

/* ---------- initial values ---------- */

function initialValues(type, item, prefill, myName, isAdmin) {
  if (type === "bug") {
    const b = item || {};
    return {
      title: b.title || "", screen: b.screen || "S07", severity: b.severity || "minor", status: b.status || "new",
      roaster: b.roaster || "", device: b.device || "", build: b.build || "",
      reporter: item ? b.reporter || "" : myName, steps: b.steps || "", expected: b.expected || "", notes: b.notes || "",
    };
  }
  if (type === "sugg") {
    const s = item || prefill || {};
    return {
      kind: s.kind || "roast", title: s.title || "", roastLine: s.roastLine || "", intensity: s.intensity || "",
      roaster: s.roaster || "", screen: s.screen || "", status: s.status || "new",
      suggestedBy: item ? s.suggestedBy || "" : myName, details: s.details || "", notes: s.notes || "",
    };
  }
  // roast
  if (item && item.source !== "new") {
    return { review: reviewOf(item), proposed: item.proposed || item.text || "", reviewedBy: item.reviewedBy || myName, notes: item.notes || "" };
  }
  const r = item || {};
  return {
    lang: r.lang || "en", category: r.category || "limit_hit", intensity: r.intensity || "", roaster: r.roaster || "",
    proposed: r.proposed || "", reviewedBy: r.reviewedBy || myName, notes: r.notes || "",
  };
}

/* ---------- payload ---------- */

/** Returns { data } to save, or { error, field } when something is missing. */
export function buildPayload(type, item, v, roasts) {
  const now = new Date().toISOString();
  if (type === "roast") {
    if (item && item.source !== "new") {
      if (v.review === "change" && (!v.proposed.trim() || v.proposed.trim() === item.text))
        return { error: "Write the new version, or pick Keep.", field: "f_proposed" };
      const data = {
        ...strip(item), review: v.review, proposed: v.review === "change" ? v.proposed.trim() : "",
        reviewedBy: v.reviewedBy.trim(), notes: v.notes.trim(), updatedAt: now,
      };
      if (v.review !== "unreviewed") data.reviewedAt = now;
      return { id: item.id, data };
    }
    if (!v.proposed.trim()) return { error: "Write the roast line.", field: "f_proposed" };
    const base = {
      lang: v.lang, category: v.category, intensity: v.intensity || null, roaster: v.roaster || null, kinds: null,
      proposed: v.proposed.trim(), reviewedBy: v.reviewedBy.trim(), notes: v.notes.trim(),
      review: "new", source: "new", text: "", updatedAt: now,
    };
    if (item) return { id: item.id, data: { ...strip(item), ...base } };
    const pre = (v.lang === "en" ? "en" : "ta") + "_new_";
    const n = roasts.filter((r) => r.id.startsWith(pre)).reduce((m, r) => Math.max(m, parseInt(r.id.slice(pre.length)) || 0), 0) + 1;
    return { id: pre + String(n).padStart(3, "0"), data: { ...base, createdAt: now } };
  }

  const data = {};
  for (const [k, val] of Object.entries(v)) data[k] = typeof val === "string" ? val.trim() : val;
  if (type === "sugg" && data.kind !== "roast") {
    data.roastLine = "";
    data.intensity = "";
  }
  if (!data.title && !(type === "sugg" && data.roastLine))
    return { error: type === "bug" ? "Give the bug a title." : "Add a title or a roast line.", field: "f_title" };

  const closed = type === "bug" ? (s) => !isOpen(s) : (s) => !sActive(s);
  if (item) {
    const merged = { ...strip(item), ...data, updatedAt: now };
    if (!closed(item.status) && closed(data.status)) merged.closedAt = now;
    if (closed(item.status) && !closed(data.status)) merged.closedAt = null;
    return { data: merged };
  }
  data.createdAt = data.updatedAt = now;
  if (closed(data.status)) data.closedAt = now;
  return { data };
}

/* ---------- small field helpers ---------- */

export const Field = ({ label, hint, full, hidden, children }) =>
  hidden ? null : (
    <label className={full ? "full" : undefined}>
      <span>
        {label} {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
    </label>
  );

export function Seg({ name, value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <label key={v}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span>
            {v === "roast" && <Icon name="flame" />}
            {l}
          </span>
        </label>
      ))}
    </div>
  );
}

function Stamps({ item }) {
  if (!item || !item.createdAt) return null;
  return (
    <div className="stamps">
      <span>Added {fmtDateTime(item.createdAt)}</span>
      {item.updatedAt && item.updatedAt !== item.createdAt && <span>Updated {fmtDateTime(item.updatedAt)}</span>}
      {item.closedAt && <span>Closed {fmtDate(item.closedAt)}</span>}
    </div>
  );
}

/** Roast-line textarea with placeholder buttons and warnings. */
export function RoastLineInput({ id, value, onChange, category, placeholder }) {
  const ref = useRef(null);
  const insert = (p) => {
    const ta = ref.current;
    const start = ta.selectionStart ?? value.length, end = ta.selectionEnd ?? start;
    const next = value.slice(0, start) + `{${p}}` + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + p.length + 2;
    });
  };
  const used = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = used.filter((k) => !PLACEHOLDERS.includes(k));
  const nativeBad = NATIVE_CATEGORIES.includes(category) && used.some((k) => !NATIVE_PLACEHOLDERS.includes(k));
  const warn = unknown.length
    ? `Unknown placeholder: {${unknown.join("}, {")}}. The app will show it as typed.`
    : nativeBad ? `Native notifications (heads up, last call, limit hit) can only fill ${NATIVE_PLACEHOLDERS.join(", ")}.` : "";
  return (
    <>
      <textarea id={id} ref={ref} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="phbar">
          Insert:
          {PLACEHOLDERS.map((p) => (
            <button key={p} type="button" onClick={() => insert(p)}>
              <span className="ph">{p}</span>
            </button>
          ))}
        </div>
        {warn && <span className="warn">{warn}</span>}
      </div>
    </>
  );
}

function Related({ roastId, suggs }) {
  const rel = suggs.filter((s) => s.roastId === roastId);
  if (!rel.length) return null;
  return (
    <div className="full related">
      <span style={{ fontSize: ".82rem", fontWeight: 700 }}>Tester suggestions for this line ({rel.length})</span>
      {rel.map((s) => (
        <div key={s.id} className="quote">
          <Line text={s.roastLine || s.title} />
          <small>
            {sid(s.num)}
            {s.suggestedBy && ` · ${s.suggestedBy}`}
            {s.details && ` · ${s.details}`}
          </small>
        </div>
      ))}
    </div>
  );
}

function RoastMeta({ r }) {
  return (
    <div className="meta">
      <span className="kind" style={{ color: "var(--red)" }}><Icon name="flame" />{catLbl(r.category)}</span>
      <span>{r.intensity ? lbl(INTENSITY, r.intensity) : "Any level"}</span>
      <span>{lbl(LANGS, r.lang)}</span>
      {r.roaster && <span>{lbl(ROASTER, r.roaster)} only</span>}
      {r.kinds && <span>for {r.kinds.join(", ")}</span>}
      {r.minMinutes && <span>from {r.minMinutes} min</span>}
    </div>
  );
}

/* ---------- forms ---------- */

function BugForm({ v, set, item, isAdmin }) {
  const newTester = !item && !isAdmin;
  return (
    <div className="form">
      <Field label="Title" full><input id="f_title" maxLength={140} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Roast screen opens twice after snooze" /></Field>
      <Field label="Screen"><Select id="f_screen" value={v.screen} onChange={(x) => set("screen", x)} options={screenOpts} /></Field>
      <Field label="Severity"><Select id="f_severity" value={v.severity} onChange={(x) => set("severity", x)} options={SEV} /></Field>
      <Field label="Status" hidden={newTester}><Select id="f_status" value={v.status} onChange={(x) => set("status", x)} options={STATUS} /></Field>
      <Field label="Roaster"><Select id="f_roaster" value={v.roaster} onChange={(x) => set("roaster", x)} options={ROASTER} /></Field>
      <Field label="Device and Android"><input id="f_device" value={v.device} onChange={(e) => set("device", e.target.value)} placeholder="Pixel 7, Android 14" /></Field>
      <Field label="Build"><input id="f_build" value={v.build} onChange={(e) => set("build", e.target.value)} placeholder="1.0.0 (3)" /></Field>
      <Field label="Reported by" full><input id="f_reporter" value={v.reporter} onChange={(e) => set("reporter", e.target.value)} placeholder="Tester name" /></Field>
      <Field label="Steps to reproduce" full><textarea id="f_steps" value={v.steps} onChange={(e) => set("steps", e.target.value)} placeholder={"1. Set an Instagram limit of 15 min\n2. Open Instagram and wait for the roast"} /></Field>
      <Field label="Expected vs actual" full><textarea id="f_expected" value={v.expected} onChange={(e) => set("expected", e.target.value)} placeholder="Expected: … Actual: …" /></Field>
      <Field label="Fix notes" hint="cause, commit, what changed" full hidden={newTester}><textarea id="f_notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <Stamps item={item} />
    </div>
  );
}

function SuggForm({ v, set, item, isAdmin }) {
  const newTester = !item && !isAdmin;
  const roast = v.kind === "roast";
  return (
    <div className="form">
      <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: ".82rem", fontWeight: 700 }}>Type</span>
        <Seg name="f_kind" label="Suggestion type" value={v.kind} onChange={(x) => set("kind", x)} options={KINDS} />
      </div>
      <Field label="Title" full>
        <input id="f_title" maxLength={140} value={v.title} onChange={(e) => set("title", e.target.value)}
          placeholder={roast ? "e.g. Roast for opening Reels at 2am" : "e.g. Make the limit slider snap to 5 minutes"} />
      </Field>
      {roast && (
        <Field label="Suggested roast line" hint="exactly as the tester wrote it" full>
          <textarea id="f_roastLine" value={v.roastLine} onChange={(e) => set("roastLine", e.target.value)}
            placeholder="You've watched more Reels tonight than you've read books this year." />
        </Field>
      )}
      {roast && <Field label="Intensity"><Select id="f_intensity" value={v.intensity} onChange={(x) => set("intensity", x)} options={INTENSITY} /></Field>}
      <Field label="Roaster"><Select id="f_roaster" value={v.roaster} onChange={(x) => set("roaster", x)} options={ROASTER} /></Field>
      <Field label="Screen"><Select id="f_screen" value={v.screen} onChange={(x) => set("screen", x)} options={[["", "Not specific"], ...screenOpts]} /></Field>
      <Field label="Status" hidden={newTester}><Select id="f_status" value={v.status} onChange={(x) => set("status", x)} options={SSTATUS} /></Field>
      <Field label="Suggested by" full><input id="f_suggestedBy" value={v.suggestedBy} onChange={(e) => set("suggestedBy", e.target.value)} placeholder="Tester name" /></Field>
      <Field label="Details" full><textarea id="f_details" value={v.details} onChange={(e) => set("details", e.target.value)} placeholder="What they said, and why" /></Field>
      <Field label="Your notes" hint="decision, where it went, build" full hidden={newTester}><textarea id="f_notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <Stamps item={item} />
    </div>
  );
}

function RoastReview({ v, set, item, suggs }) {
  return (
    <div className="form">
      <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: ".82rem", fontWeight: 700 }}>Current line in the app</span>
        <div className="current"><Line text={item.text} /></div>
        <RoastMeta r={item} />
      </div>
      <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: ".82rem", fontWeight: 700 }}>Decision</span>
        <Seg name="f_review" label="Decision" value={v.review} onChange={(x) => set("review", x)} options={REVIEW.slice(0, 4)} />
      </div>
      <Related roastId={item.id} suggs={suggs} />
      {v.review === "change" && (
        <label className="full">
          <span>Your version <span className="hint">what the line should say instead</span></span>
          <RoastLineInput id="f_proposed" value={v.proposed} onChange={(x) => set("proposed", x)} category={item.category} />
        </label>
      )}
      <Field label="Reviewed by" full><input id="f_reviewedBy" value={v.reviewedBy} onChange={(e) => set("reviewedBy", e.target.value)} placeholder="You or a tester" /></Field>
      <Field label="Notes and suggestions" full><textarea id="f_notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Why change it, tester feedback, alternatives" /></Field>
      <div className="stamps">
        <span>ID {item.id}</span>
        {item.reviewedAt && <span>Reviewed {fmtDateTime(item.reviewedAt)}</span>}
      </div>
    </div>
  );
}

function RoastNew({ v, set, item }) {
  return (
    <div className="form">
      <Field label="Language"><Select id="f_lang" value={v.lang} onChange={(x) => set("lang", x)} options={LANGS} /></Field>
      <Field label="Moment"><Select id="f_category" value={v.category} onChange={(x) => set("category", x)} options={catOpts} /></Field>
      <Field label="Intensity"><Select id="f_intensity" value={v.intensity} onChange={(x) => set("intensity", x)} options={INTENSITY} /></Field>
      <Field label="Roaster"><Select id="f_roaster" value={v.roaster} onChange={(x) => set("roaster", x)} options={ROASTER} /></Field>
      <label className="full">
        <span>New roast line</span>
        <RoastLineInput id="f_proposed" value={v.proposed} onChange={(x) => set("proposed", x)} category={v.category}
          placeholder="{app} again? Your thumb deserves a pension." />
      </label>
      <Field label="Suggested by" full><input id="f_reviewedBy" value={v.reviewedBy} onChange={(e) => set("reviewedBy", e.target.value)} placeholder="You or a tester" /></Field>
      <Field label="Notes" full><textarea id="f_notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Where it fits, why it's funny" /></Field>
      <Stamps item={item} />
    </div>
  );
}

function RoastReadOnly({ item, suggs }) {
  const v = reviewOf(item);
  return (
    <div className="form">
      <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: ".82rem", fontWeight: 700 }}>{item.source === "new" ? "New line, not in the app yet" : "Current line in the app"}</span>
        <div className="current"><Line text={item.text || item.proposed} /></div>
        <RoastMeta r={item} />
      </div>
      {v === "change" && item.proposed && (
        <div className="full" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: ".82rem", fontWeight: 700 }}>Planned new version</span>
          <div className="current" style={{ background: "var(--chill-tint)", borderColor: "#BFE3D2" }}><Line text={item.proposed} /></div>
        </div>
      )}
      {v !== "unreviewed" && <div className="full ro-note">Decision so far: <b>{lbl(REVIEW, v)}</b></div>}
      <Related roastId={item.id} suggs={suggs} />
      <p className="full ro-note" style={{ margin: 0 }}>Think it could be funnier, or it doesn't fit? Suggest a change and it goes to review.</p>
    </div>
  );
}

/* ---------- the sheet ---------- */

export default function ItemSheet({ sheet, item, api, isAdmin, myName, suggs, roasts, onClose, onSave, onDelete, onSuggestChange, onFilesChanged }) {
  const { type, prefill } = sheet;
  const [v, setV] = useState(() => initialValues(type, item, prefill, myName, isAdmin));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, setPending] = useState([]);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const formRef = useRef(null);

  const readOnly = item && !isAdmin;
  const roastReview = type === "roast" && item && item.source !== "new";

  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const f = formRef.current;
      if (!f) return;
      const target = item ? f.querySelector("[data-close]") : prefill && prefill.roastId ? f.querySelector("#f_roastLine") : f.querySelector("#f_title, #f_proposed");
      if (target) {
        target.focus();
        if (target.tagName === "TEXTAREA") target.setSelectionRange(target.value.length, target.value.length);
      }
    }, 30);
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      try { prev && prev.focus(); } catch { /* gone */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const code = item && type !== "roast" ? codeOf(type, item) : "";
  const title = type === "bug" ? (item ? "Edit bug" : "Report a bug")
    : type === "roast" ? (roastReview ? "Review roast line" : item ? "Edit new roast line" : "Add a roast line")
    : item ? "Edit suggestion" : "Add a suggestion";

  async function submit(e) {
    e.preventDefault();
    if (readOnly || busy) return;
    const p = buildPayload(type, item, v, roasts);
    if (p.error) {
      setError(p.error);
      const el = formRef.current && formRef.current.querySelector("#" + p.field);
      if (el) el.focus();
      return;
    }
    if (type === "sugg" && !item && prefill && prefill.roastId && p.data.kind === "roast") p.data.roastId = prefill.roastId;
    setBusy(true);
    setError("");
    const ok = await onSave(type, item, p, pending);
    if (!ok) setBusy(false);
  }

  let body;
  if (type === "bug") body = <BugForm v={v} set={set} item={item} isAdmin={isAdmin} />;
  else if (type === "sugg") body = <SuggForm v={v} set={set} item={item} isAdmin={isAdmin} />;
  else if (!isAdmin) body = <RoastReadOnly item={item} suggs={suggs} />;
  else if (roastReview) body = <RoastReview v={v} set={set} item={item} suggs={suggs} />;
  else body = <RoastNew v={v} set={set} item={item} />;

  const addLabel = { bug: "Add bug", roast: "Add roast line" }[type] || "Add suggestion";
  let footer;
  if (readOnly) {
    footer = (
      <div className="right">
        <button className="btn" type="button" data-close onClick={onClose}>Close</button>
        {type === "roast" && (
          <button className="btn primary" type="button" data-suggest onClick={() => onSuggestChange(item)}>
            <Icon name="bulb" />Suggest a change
          </button>
        )}
      </div>
    );
  } else if (!item) {
    footer = (
      <div className="right">
        <button className="btn" type="button" data-close onClick={onClose}>Cancel</button>
        <button className="btn primary" type="submit" disabled={busy}><Icon name="plus" />{addLabel}</button>
      </div>
    );
  } else {
    footer = (
      <>
        <div>
          {!roastReview && (confirmDel ? (
            <>
              <button className="btn danger" type="button" data-del onClick={() => onDelete(type, item)}>Delete {codeOf(type, item)}</button>
              <button className="btn ghost" type="button" data-keep onClick={() => setConfirmDel(false)}>Keep</button>
            </>
          ) : (
            <button className="btn ghost danger" type="button" data-askdel onClick={() => setConfirmDel(true)}>Delete</button>
          ))}
        </div>
        <div className="right">
          <button className="btn" type="button" data-close onClick={onClose}>Close</button>
          <button className="btn primary" type="submit" disabled={busy}>{roastReview ? "Save review" : "Save"}</button>
        </div>
      </>
    );
  }

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form ref={formRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" noValidate onSubmit={submit}>
        <div className="sheet-hd">
          <h2 id="sheetTitle">{code && <span className="id">{code}</span>}{title}</h2>
          <button className="btn icon ghost" type="button" data-close aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="sheet-bd">
          {error && <div className="form-err" role="alert">{error}</div>}
          <fieldset className="bare" disabled={readOnly}>{body}</fieldset>
          {type !== "roast" && (
            <Attachments api={api} type={type} item={item} isAdmin={isAdmin} myName={myName}
              pending={pending} setPending={setPending} onChanged={onFilesChanged} />
          )}
        </div>
        <div className="sheet-ft">{footer}</div>
      </form>
    </div>
  );
}

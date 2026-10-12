import { useEffect, useMemo, useRef, useState } from "react";
import { CAT_LABEL, INTENSITY, LANGS, ROASTER } from "../lib/constants";
import { catLbl, fmtDateTime } from "../lib/format";
import {
  APP_KEYS, APP_KIND_LIST, LANG_CODES, LANG_SHORT, LINE_STATUS, fillSample, lineIssues,
  nextOrder, nextSlotId, rowsForSlot, slotIssues, statusOf,
} from "../lib/roastlib";
import Icon from "./Icon";
import { Line, Select } from "./bits";
import { Field, RoastLineInput, Seg } from "./ItemSheet";

const catOpts = Object.keys(CAT_LABEL).map((c) => [c, catLbl(c)]);
const LANG_NAME = Object.fromEntries(LANGS);

/** Toggle chips for a multi-choice list. Empty = any. */
function Multi({ value, options, onChange, anyLabel }) {
  const set = new Set(value || []);
  return (
    <div className="chips wrapchips" role="group">
      <button type="button" className="chip" aria-pressed={!set.size} onClick={() => onChange([])}>{anyLabel}</button>
      {options.map(([v, l]) => (
        <button key={v} type="button" className="chip" aria-pressed={set.has(v)}
          onClick={() => {
            const n = new Set(set);
            n.has(v) ? n.delete(v) : n.add(v);
            onChange([...n]);
          }}>
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * Edit one roast slot: where it shows (moment, level, apps, dates) and its line in each language.
 * group: existing slot from groupSlots(), or null for a new one. prefill: a tester's proposed line.
 */
export default function SlotSheet({ group, prefill, slots, rows, onClose, onSave, onDelete }) {
  const isNew = !group;
  const start = group ? group.meta : {
    category: (prefill && prefill.category) || "limit_hit", intensity: (prefill && prefill.intensity) || "honest",
    kinds: null, apps: null, roaster: (prefill && prefill.roaster) || null, order: nextOrder(slots),
    minMinutes: null, minStreak: null, fact: null, from: null, to: null,
  };
  const [meta, setMeta] = useState({ ...start });
  const [slot, setSlot] = useState(group ? group.slot : nextSlotId(start.category, start.intensity, slots));
  const [slotTouched, setSlotTouched] = useState(false);
  const [texts, setTexts] = useState(() => {
    const t = {};
    for (const l of LANG_CODES) t[l] = group && group.rows[l] ? group.rows[l].text || "" : "";
    if (prefill) t[prefill.lang || "en"] = prefill.proposed || "";
    return t;
  });
  const [statuses, setStatuses] = useState(() => {
    const s = {};
    for (const l of LANG_CODES) s[l] = group && group.rows[l] ? statusOf(group.rows[l]) : "draft";
    return s;
  });
  const [applied, setApplied] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const formRef = useRef(null);
  const m = (k, v) => setMeta((o) => ({ ...o, [k]: v }));

  // New slot: keep the suggested id in step with the moment and level until the admin edits it.
  useEffect(() => {
    if (isNew && !slotTouched) setSlot(nextSlotId(meta.category, meta.intensity, slots));
  }, [meta.category, meta.intensity]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      try { prev && prev.focus(); } catch { /* gone */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sameLang = useMemo(() => {
    const out = {};
    for (const l of LANG_CODES) out[l] = rows.filter((r) => r.lang === l && r.text && !(group && r.id === (group.rows[l] || {}).id)).map((r) => r.text);
    return out;
  }, [rows, group]);

  async function save(e) {
    e.preventDefault();
    if (busy) return;
    const errs = slotIssues(slot, meta, slots, isNew);
    for (const l of LANG_CODES) {
      if (!texts[l].trim()) continue;
      const li = lineIssues(texts[l], meta.category, l);
      errs.push(...li.errors.map((x) => `${LANG_NAME[l]}: ${x}`));
    }
    if (!LANG_CODES.some((l) => texts[l].trim())) errs.push("Write the line in at least one language.");
    if (errs.length) {
      setError(errs.join(" "));
      formRef.current && formRef.current.querySelector(".sheet-bd").scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const extra = {};
    for (const l of LANG_CODES) if (applied[l]) extra[l] = { review: "keep", proposed: "", appliedAt: new Date().toISOString() };
    const { save: rowsToSave, remove } = rowsForSlot(slot, meta, texts, statuses, group ? group.rows : {}, extra);
    if (prefill && prefill.id) remove.push(prefill.id);
    setBusy(true);
    setError("");
    const ok = await onSave(rowsToSave, remove, `${isNew ? "Added" : "Saved"} ${slot}`);
    if (!ok) setBusy(false);
  }

  const showMin = meta.category === "comparison";
  const showStreak = meta.category === "win_streak";
  const showFact = meta.category === "late_night";

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form ref={formRef} className="sheet wide" role="dialog" aria-modal="true" aria-labelledby="slotTitle" noValidate onSubmit={save}>
        <div className="sheet-hd">
          <h2 id="slotTitle">{!isNew && <span className="id">{slot}</span>}{isNew ? (prefill ? "Add tester's line as a slot" : "New roast slot") : "Edit roast slot"}</h2>
          <button className="btn icon ghost" type="button" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="sheet-bd">
          {error && <div className="form-err" role="alert">{error}</div>}

          <h3 className="subhd">Where it shows</h3>
          <div className="form">
            <Field label="Moment"><Select value={meta.category} onChange={(v) => m("category", v)} options={catOpts} /></Field>
            <Field label="Level"><Select value={meta.intensity || ""} onChange={(v) => m("intensity", v || null)} options={INTENSITY} /></Field>
            <Field label="Roaster"><Select value={meta.roaster || ""} onChange={(v) => m("roaster", v || null)} options={ROASTER.filter((r) => r[0] !== "both")} /></Field>
            <Field label="Slot id" hint={isNew ? "auto, you can change it" : "fixed"}>
              <input value={slot} disabled={!isNew} onChange={(e) => { setSlotTouched(true); setSlot(e.target.value.trim()); }} />
            </Field>
            <label className="full">
              <span>Kinds of app <span className="hint">none picked = every app</span></span>
              <Multi value={meta.kinds} anyLabel="Any app" onChange={(v) => m("kinds", v)} options={APP_KIND_LIST.map((k) => [k, k])} />
            </label>
            <label className="full">
              <span>Only these apps <span className="hint">rarely needed; for lines that name the app</span></span>
              <Multi value={meta.apps} anyLabel="No" onChange={(v) => m("apps", v)} options={Object.keys(APP_KEYS).map((k) => [k, k])} />
            </label>
            <Field label="Show from" hint="optional, for festivals">
              <input type="date" value={meta.from || ""} onChange={(e) => m("from", e.target.value || null)} />
            </Field>
            <Field label="Show until" hint="optional">
              <input type="date" value={meta.to || ""} onChange={(e) => m("to", e.target.value || null)} />
            </Field>
            {showMin && (
              <Field label="Only when usage is at least" hint="minutes">
                <input type="number" min="1" value={meta.minMinutes ?? ""} onChange={(e) => m("minMinutes", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            )}
            {showStreak && (
              <Field label="Only from streak day" hint="optional">
                <input type="number" min="1" value={meta.minStreak ?? ""} onChange={(e) => m("minStreak", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            )}
            {showFact && (
              <label className="checkline">
                <input type="checkbox" checked={Boolean(meta.fact)} onChange={(e) => m("fact", e.target.checked || null)} />
                <span>States a research fact</span>
              </label>
            )}
            <Field label="Order" hint="lower shows first in files">
              <input type="number" value={meta.order ?? ""} onChange={(e) => m("order", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
          </div>

          {LANG_CODES.map((l) => {
            const row = group && group.rows[l];
            const li = texts[l].trim() ? lineIssues(texts[l], meta.category, l, [...sameLang[l], texts[l]]) : { errors: [], warnings: [] };
            const pending = row && !applied[l] && row.review === "change" && row.proposed;
            return (
              <div key={l} className="langblock">
                <div className="langhd">
                  <h3 className="subhd">{LANG_NAME[l]}</h3>
                  <Seg name={`st_${l}`} label={`${LANG_NAME[l]} status`} value={statuses[l]} onChange={(v) => setStatuses((o) => ({ ...o, [l]: v }))}
                    options={LINE_STATUS.map((s) => [s[0], s[1]])} />
                </div>
                {pending && (
                  <div className="review-note">
                    <b>Review says change it{row.reviewedBy ? ` (${row.reviewedBy})` : ""}:</b>
                    <div><Line text={row.proposed} /></div>
                    {row.notes && <small>{row.notes}</small>}
                    <button type="button" className="btn sm" onClick={() => { setTexts((o) => ({ ...o, [l]: row.proposed })); setApplied((o) => ({ ...o, [l]: true })); }}>
                      <Icon name="check" />Use this version
                    </button>
                  </div>
                )}
                {row && row.review === "remove" && (
                  <div className="review-note warnbox"><b>Review says remove this line.</b> Set it to Off to stop it shipping.{row.notes && <small>{row.notes}</small>}</div>
                )}
                <div className="form one">
                  <label className="full">
                    <span>Line <span className="hint">{texts[l].length} characters{!texts[l] ? " · leave empty for no " + LANG_SHORT[l] + " line" : ""}</span></span>
                    <RoastLineInput id={`f_${l}`} value={texts[l]} onChange={(v) => setTexts((o) => ({ ...o, [l]: v }))} category={meta.category}
                      placeholder={l === "en" ? "{time} on {app}. Your thumb deserves a pension." : "{time} {app}-la. Unga thumb-ku pension kudukkanum."} />
                  </label>
                </div>
                {texts[l].trim() && (
                  <div className="preview">
                    <small>Preview</small>
                    <p>{fillSample(texts[l])}</p>
                  </div>
                )}
                {[...li.errors.map((x) => ["err", x]), ...li.warnings.map((x) => ["warn", x])].map(([k, x], i) => (
                  <div key={i} className={k === "err" ? "issue err" : "issue"}>{x}</div>
                ))}
                {row && row.updatedAt && <div className="stamps"><span>{row.id}</span><span>Updated {fmtDateTime(row.updatedAt)}</span></div>}
              </div>
            );
          })}
        </div>
        <div className="sheet-ft">
          <div>
            {!isNew && (confirmDel ? (
              <>
                <button className="btn danger" type="button" onClick={() => onDelete(group)}>Delete {slot} in both languages</button>
                <button className="btn ghost" type="button" onClick={() => setConfirmDel(false)}>Keep</button>
              </>
            ) : (
              <button className="btn ghost danger" type="button" onClick={() => setConfirmDel(true)}><Icon name="trash" />Delete slot</button>
            ))}
          </div>
          <div className="right">
            <button className="btn" type="button" onClick={onClose}>Close</button>
            <button className="btn primary" type="submit" disabled={busy}>{isNew ? <><Icon name="plus" />Add slot</> : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}


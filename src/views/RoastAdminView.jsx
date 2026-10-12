import { useEffect, useMemo, useRef, useState } from "react";
import { CAT_LABEL, INTENSITY, ROASTER } from "../lib/constants";
import { catLbl, fmtDateTime, lbl, today } from "../lib/format";
import { IMG } from "../lib/images";
import { useLocalState } from "../lib/useLocalState";
import { isMissingFn, publicRoastUrls } from "../lib/api";
import {
  APP_KIND_LIST, LANG_CODES, LANG_SHORT, LINE_STATUS, TEMPLATE_CSV, buildPacks, cleanMeta, coverage, diffPacks,
  download, groupSlots, isProposal, lineIssues, manifestFor, parseImport, planImport, slotsToCsv, statusOf,
} from "../lib/roastlib";
import Icon from "../components/Icon";
import SlotSheet from "../components/SlotSheet";
import { Chips, Empty, Line, Select } from "../components/bits";

const PAGE = 80;
const SUBS = [["lines", "Lines", "edit"], ["import", "Import", "upload"], ["publish", "Publish", "send"]];
const catOpts = Object.keys(CAT_LABEL).map((c) => [c, catLbl(c)]);

/** Admin-only roast manager: edit one slot or many, import files, publish versions for the app. */
export default function RoastAdminView({ rows, loaded, api, myName, refresh, setToast, onError, sheetOpenRef, newSlotSignal }) {
  const [sub, setSub] = useLocalState("elb.admin.sub", "lines");
  const [sheet, setSheet] = useState(null); // { group } | { group: null, prefill }
  const slots = useMemo(() => groupSlots(rows), [rows]);
  const proposals = useMemo(() => rows.filter(isProposal), [rows]);
  if (sheetOpenRef) sheetOpenRef.current = Boolean(sheet);

  useEffect(() => {
    if (newSlotSignal) setSheet({ group: null, prefill: null, key: newSlotSignal });
  }, [newSlotSignal]);

  /** Save rows and delete ids in chunks; returns true when everything saved. */
  async function saveRows(save, remove, label) {
    try {
      for (let i = 0; i < Math.max(save.length, 1); i += 400) {
        await api.saveRoasts(save.slice(i, i + 400), i === 0 ? remove : []);
      }
      setToast(label);
      setSheet(null);
      await refresh();
      return true;
    } catch (err) {
      onError(err);
      return false;
    }
  }

  async function deleteSlot(group) {
    const ids = Object.values(group.rows).map((r) => r.id);
    await saveRows([], ids, `Deleted ${group.slot}`);
  }

  return (
    <section className="view" role="tabpanel" aria-label="Roast admin">
      <div className="subtabs" role="tablist" aria-label="Roast admin">
        {SUBS.map(([k, l, icon]) => (
          <button key={k} type="button" role="tab" className="chip" aria-selected={sub === k} aria-pressed={sub === k} onClick={() => setSub(k)}>
            <Icon name={icon} />{l}
          </button>
        ))}
      </div>

      {sub === "lines" && (
        <LinesPanel slots={slots} rows={rows} proposals={proposals} loaded={loaded} onOpen={(g) => setSheet({ group: g, key: Date.now() })}
          onPromote={(p) => setSheet({ group: null, prefill: p, key: Date.now() })} saveRows={saveRows} setToast={setToast} />
      )}
      {sub === "import" && <ImportPanel slots={slots} saveRows={saveRows} setToast={setToast} />}
      {sub === "publish" && <PublishPanel rows={rows} slots={slots} api={api} myName={myName} setToast={setToast} onError={onError} />}

      {sheet && (
        <SlotSheet key={sheet.key} group={sheet.group} prefill={sheet.prefill} slots={slots} rows={rows}
          onClose={() => setSheet(null)} onSave={saveRows} onDelete={deleteSlot} />
      )}
    </section>
  );
}

/* ================= Lines ================= */

function LinesPanel({ slots, rows, proposals, loaded, onOpen, onPromote, saveRows, setToast }) {
  const [q, setQ] = useLocalState("elb.admin.q", "");
  const [cat, setCat] = useLocalState("elb.admin.cat", "");
  const [level, setLevel] = useLocalState("elb.admin.level", "");
  const [kind, setKind] = useLocalState("elb.admin.kind", "");
  const [show, setShow] = useLocalState("elb.admin.show", "");
  const [sel, setSel] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE);
  const [openProps, setOpenProps] = useState(false);
  useEffect(() => setLimit(PAGE), [q, cat, level, kind, show]);

  const query = q.trim().toLowerCase();
  const states = (g) => LANG_CODES.map((l) => g.rows[l] && statusOf(g.rows[l]));
  const SHOW = {
    "": () => true,
    "no-ta": (g) => !g.rows["ta-Latn"],
    "no-en": (g) => !g.rows.en,
    "not-live": (g) => states(g).some((s) => s && s !== "live"),
    draft: (g) => states(g).includes("draft"),
    off: (g) => states(g).includes("off"),
    review: (g) => Object.values(g.rows).some((r) => ["change", "remove"].includes(r.review)),
    problems: (g) => Object.values(g.rows).some((r) => lineIssues(r.text, g.meta.category, r.lang).errors.length),
    dated: (g) => g.meta.from || g.meta.to,
  };
  const list = slots.filter((g) =>
    (!cat || g.meta.category === cat) &&
    (!level || (level === "any" ? !g.meta.intensity : g.meta.intensity === level)) &&
    (!kind || (kind === "any" ? !g.meta.kinds : (g.meta.kinds || []).includes(kind))) &&
    (SHOW[show] || SHOW[""])(g) &&
    (!query || [g.slot, ...Object.values(g.rows).map((r) => `${r.text} ${r.proposed || ""} ${r.notes || ""}`)].join(" ").toLowerCase().includes(query)));

  const count = (k) => slots.filter(SHOW[k]).length;
  const allSel = list.length > 0 && list.every((g) => sel.has(g.slot));
  const toggle = (s) => setSel((o) => { const n = new Set(o); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleAll = () => setSel((o) => { const n = new Set(o); list.forEach((g) => (allSel ? n.delete(g.slot) : n.add(g.slot))); return n; });
  const chosen = slots.filter((g) => sel.has(g.slot));

  let body;
  if (!loaded) body = <Empty title="Loading roasts…" />;
  else if (!slots.length) body = <Empty img={IMG.binoc} title="No roast lines yet">Run supabase/seed.sql, then supabase/roast-slots-migration.sql.</Empty>;
  else if (!list.length) body = <Empty img={IMG.chill} title="Nothing matches">Clear a filter or the search.</Empty>;
  else body = (
    <>
      {list.slice(0, limit).map((g) => <SlotRow key={g.slot} g={g} selected={sel.has(g.slot)} onToggle={() => toggle(g.slot)} onOpen={() => onOpen(g)} />)}
      {list.length > limit && (
        <div className="more"><button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more of {list.length - limit}</button></div>
      )}
    </>
  );

  return (
    <>
      {proposals.length > 0 && (
        <div className="card props">
          <button type="button" className="hd linkbtn" onClick={() => setOpenProps(!openProps)} aria-expanded={openProps}>
            <span><Icon name="bulb" /> {proposals.length} new {proposals.length === 1 ? "line" : "lines"} suggested by testers</span>
            <small>{openProps ? "Hide" : "Show"}</small>
          </button>
          {openProps && proposals.map((p) => (
            <div key={p.id} className="prop">
              <div className="t">
                <Line text={p.proposed} />
                <div className="meta"><span>{LANG_SHORT[p.lang] || p.lang}</span><span>{catLbl(p.category)}</span>{p.intensity && <span>{p.intensity}</span>}{p.reviewedBy && <span>by {p.reviewedBy}</span>}</div>
              </div>
              <button type="button" className="btn sm" onClick={() => onPromote(p)}><Icon name="plus" />Add as slot</button>
            </div>
          ))}
        </div>
      )}

      <div className="filters">
        <div className="field search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lines, slot ids, notes" aria-label="Search" />
        </div>
        <div className="field"><Select value={cat} onChange={setCat} aria-label="Moment" options={[["", "All moments"], ...catOpts]} /></div>
        <div className="field"><Select value={level} onChange={setLevel} aria-label="Level" options={[["", "All levels"], ...INTENSITY.slice(1), ["any", "Any-level lines"]]} /></div>
        <div className="field"><Select value={kind} onChange={setKind} aria-label="Kind of app" options={[["", "All app kinds"], ["any", "Lines for any app"], ...APP_KIND_LIST.map((k) => [k, k])]} /></div>
      </div>
      <div className="filterbar">
        <Chips label="Show" value={show} onChange={setShow} options={[
          ["", "All", slots.length], ["no-ta", "No Tanglish", count("no-ta")], ["no-en", "No English", count("no-en")],
          ["review", "Review waiting", count("review")], ["not-live", "Not live", count("not-live")],
          ["problems", "Problems", count("problems")], ["dated", "Dated", count("dated")],
        ]} />
        <small className="muted">{loaded ? `${list.length} ${list.length === 1 ? "slot" : "slots"}` : ""}</small>
      </div>

      <div className="slothead">
        <label className="checkline"><input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="Select all shown" /><span>Select all shown</span></label>
        <span className="cols2"><span>English</span><span>Tanglish</span></span>
      </div>
      <div className="list">{body}</div>

      {chosen.length > 0 && <BulkBar chosen={chosen} onClear={() => setSel(new Set())} saveRows={saveRows} setToast={setToast}
        onDone={() => setSel(new Set())} />}
    </>
  );
}

function SlotRow({ g, selected, onToggle, onOpen }) {
  const m = g.meta;
  const review = Object.values(g.rows).some((r) => ["change", "remove"].includes(r.review));
  const open = (e) => { if (!e.target.closest("input")) onOpen(); };
  return (
    <div className={`row slotrow${selected ? " sel" : ""}`} tabIndex={0} role="button" aria-label={`Edit ${g.slot}`}
      onClick={open} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.target.closest("input")) { e.preventDefault(); onOpen(); } }}>
      <span className="pick" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${g.slot}`} />
      </span>
      <div className="slotmeta">
        <span className="id">{g.slot}</span>
        <span className="kind" style={{ color: "var(--red)" }}><Icon name="flame" />{catLbl(m.category)}</span>
        <span>{m.intensity ? lbl(INTENSITY, m.intensity) : "Any level"}</span>
        {m.kinds && <span><Icon name="phone" />{m.kinds.join(", ")}</span>}
        {m.apps && <span>{m.apps.join(", ")} only</span>}
        {m.roaster && <span><Icon name="mask" />{lbl(ROASTER, m.roaster)}</span>}
        {(m.from || m.to) && <span className="dated">{m.from || "…"} → {m.to || "…"}</span>}
        {review && <span className="rvdot">Review waiting</span>}
      </div>
      {LANG_CODES.map((l) => <LangCell key={l} r={g.rows[l]} lang={l} category={m.category} />)}
    </div>
  );
}

function LangCell({ r, lang, category }) {
  if (!r) return <div className="lc missing"><small>{LANG_SHORT[lang]}</small><span>No line</span></div>;
  const st = statusOf(r);
  const bad = lineIssues(r.text, category, lang).errors.length > 0;
  return (
    <div className={`lc st-${st}${bad ? " bad" : ""}`}>
      <small>{LANG_SHORT[lang]}{st !== "live" && <b className={`stag ${st}`}>{lbl(LINE_STATUS, st)}</b>}{bad && <b className="stag bad">Problem</b>}</small>
      <Line text={r.text} />
    </div>
  );
}

/* ---------- bulk ---------- */

const ACTIONS = [
  ["status", "Set status"], ["level", "Set level"], ["kinds", "Set kinds of app"], ["roaster", "Set roaster"],
  ["dates", "Set show dates"], ["reviews", "Apply review decisions"], ["csv", "Download as CSV"], ["delete", "Delete"],
];

function BulkBar({ chosen, onClear, saveRows, setToast, onDone }) {
  const [action, setAction] = useState("status");
  const [status, setStatus] = useState("live");
  const [scope, setScope] = useState("both");
  const [level, setLevel] = useState("honest");
  const [kinds, setKinds] = useState([]);
  const [roaster, setRoaster] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setConfirm(false), [action, status, scope, level, kinds, roaster, from, to, chosen.length]);

  const langs = scope === "both" ? LANG_CODES : [scope];
  const n = chosen.length;
  const now = () => new Date().toISOString();

  /** Rows to save / ids to delete for the chosen action. */
  function plan() {
    const save = [], remove = [];
    let skipped = 0;
    const withMeta = (g, patch) => {
      const meta = { ...g.meta, ...patch };
      for (const r of Object.values(g.rows)) {
        const d = { ...r, ...cleanMeta(meta), slot: g.slot, updatedAt: now() };
        delete d.id;
        save.push({ id: r.id, data: d });
      }
    };
    for (const g of chosen) {
      if (action === "status") {
        for (const l of langs) {
          const r = g.rows[l];
          if (!r) continue;
          const d = { ...r, status, updatedAt: now() };
          delete d.id;
          save.push({ id: r.id, data: d });
        }
      } else if (action === "level") withMeta(g, { intensity: level === "any" ? null : level });
      else if (action === "kinds") withMeta(g, { kinds: kinds.length ? kinds : null });
      else if (action === "roaster") withMeta(g, { roaster: roaster || null });
      else if (action === "dates") withMeta(g, { from: from || null, to: to || null });
      else if (action === "reviews") {
        for (const r of Object.values(g.rows)) {
          const d = { ...r };
          delete d.id;
          if (r.review === "change" && r.proposed) {
            if (lineIssues(r.proposed, g.meta.category, r.lang).errors.length) { skipped++; continue; }
            Object.assign(d, { text: r.proposed, proposed: "", review: "keep", appliedAt: now(), updatedAt: now() });
          } else if (r.review === "remove" && statusOf(r) !== "off") {
            Object.assign(d, { status: "off", updatedAt: now() });
          } else continue;
          save.push({ id: r.id, data: d });
        }
      } else if (action === "delete") remove.push(...Object.values(g.rows).map((r) => r.id));
    }
    return { save, remove, skipped };
  }

  const summary = () => {
    const p = plan();
    const slotsWord = `${n} ${n === 1 ? "slot" : "slots"}`;
    switch (action) {
      case "status": return `Set ${scope === "both" ? "both languages" : LANG_SHORT[scope]} to ${status} on ${slotsWord} (${p.save.length} lines).`;
      case "level": return `Set level to ${level === "any" ? "any level" : level} on ${slotsWord}.`;
      case "kinds": return `Set kinds of app to ${kinds.length ? kinds.join(", ") : "any app"} on ${slotsWord}.`;
      case "roaster": return `Set roaster to ${roaster || "both"} on ${slotsWord}.`;
      case "dates": return from || to ? `Show ${slotsWord} only from ${from || "now"} to ${to || "no end"}.` : `Clear show dates on ${slotsWord}.`;
      case "reviews": return p.save.length
        ? `Apply ${p.save.length} review decisions (changes become the line, removals go Off)${p.skipped ? `; ${p.skipped} skipped because the new version has a problem` : ""}.`
        : "No review decisions waiting on these slots.";
      case "delete": return `Delete ${slotsWord} (${p.remove.length} lines) in every language. This can't be undone.`;
      default: return "";
    }
  };

  async function run() {
    if (action === "csv") {
      download(`endloop-roasts-selected-${today()}.csv`, slotsToCsv(chosen), "text/csv");
      setToast(`Downloaded ${n} slots`);
      return;
    }
    if (!confirm) { setConfirm(true); return; }
    const p = plan();
    if (!p.save.length && !p.remove.length) { setToast("Nothing to change"); setConfirm(false); return; }
    setBusy(true);
    const ok = await saveRows(p.save, p.remove, action === "delete" ? `Deleted ${n} slots` : `Updated ${p.save.length} ${p.save.length === 1 ? "line" : "lines"}`);
    setBusy(false);
    setConfirm(false);
    if (ok) onDone();
  }

  return (
    <div className="bulkbar" role="region" aria-label="Bulk edit">
      <div className="bb-row">
        <b>{n} selected</b>
        <Select value={action} onChange={setAction} aria-label="Bulk action" options={ACTIONS} />
        {action === "status" && (
          <>
            <Select value={status} onChange={setStatus} aria-label="Status" options={LINE_STATUS.map((s) => [s[0], s[1]])} />
            <Select value={scope} onChange={setScope} aria-label="Language" options={[["both", "Both languages"], ["en", "English only"], ["ta-Latn", "Tanglish only"]]} />
          </>
        )}
        {action === "level" && <Select value={level} onChange={setLevel} aria-label="Level" options={[...INTENSITY.slice(1), ["any", "Any level"]]} />}
        {action === "roaster" && <Select value={roaster} onChange={setRoaster} aria-label="Roaster" options={[["", "Both"], ["loop", "Loop"], ["lupe", "Lupe"]]} />}
        {action === "dates" && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Show from" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Show until" />
          </>
        )}
        <span className="grow" />
        <button type="button" className="btn ghost" onClick={onClear}>Clear</button>
        <button type="button" className={`btn ${action === "delete" ? "danger" : "primary"}`} disabled={busy} onClick={run}>
          {action === "csv" ? <><Icon name="download" />Download</> : confirm ? "Confirm" : "Apply"}
        </button>
      </div>
      {action === "kinds" && (
        <div className="chips wrapchips">
          <button type="button" className="chip" aria-pressed={!kinds.length} onClick={() => setKinds([])}>Any app</button>
          {APP_KIND_LIST.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kinds.includes(k)}
              onClick={() => setKinds((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]))}>{k}</button>
          ))}
        </div>
      )}
      {action !== "csv" && <div className={`bb-sum${confirm ? " on" : ""}`}>{confirm ? "Check and confirm: " : ""}{summary()}</div>}
    </div>
  );
}

/* ================= Import ================= */

function ImportPanel({ slots, saveRows, setToast }) {
  const [files, setFiles] = useState([]);
  const [paste, setPaste] = useState("");
  const [asDraft, setAsDraft] = useLocalState("elb.admin.importDraft", true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const sources = [...files, ...(paste.trim() ? [{ name: "pasted.csv", text: paste }] : [])];
  const parsed = useMemo(() => parseImport(sources), [files, paste]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => {
    const recs = parsed.records.map((r) => {
      if (!asDraft) return r;
      const exists = slots.some((s) => s.slot === r.slot);
      if (exists) return r;
      const st = { ...r.statuses };
      for (const l of LANG_CODES) if (r.texts[l] && !st[l]) st[l] = "draft";
      return { ...r, statuses: st };
    });
    return planImport(recs, slots);
  }, [parsed, slots, asDraft]);

  const by = (k) => plan.filter((p) => p.kind === k);
  const todo = plan.filter((p) => p.kind === "new" || p.kind === "change");

  async function readFiles(list) {
    const out = [];
    for (const f of list) {
      if (!/\.(csv|json|txt)$/i.test(f.name)) continue;
      out.push({ name: f.name, text: await f.text() });
    }
    setFiles((o) => [...o.filter((x) => !out.some((y) => y.name === x.name)), ...out]);
  }

  async function apply() {
    const save = todo.flatMap((p) => p.save);
    const remove = todo.flatMap((p) => p.remove);
    setBusy(true);
    const ok = await saveRows(save, remove, `Imported ${by("new").length} new and ${by("change").length} changed slots`);
    setBusy(false);
    if (ok) { setFiles([]); setPaste(""); }
  }

  const shown = filter ? plan.filter((p) => p.kind === filter) : plan.filter((p) => p.kind !== "same");

  return (
    <div className="importp">
      <div className="card">
        <div className="hd"><h2 className="sec">Upload roast lines</h2>
          <div className="row-btns">
            <button type="button" className="btn sm" onClick={() => download("endloop-roasts-template.csv", TEMPLATE_CSV, "text/csv")}><Icon name="download" />Template CSV</button>
            <button type="button" className="btn sm" onClick={() => download(`endloop-roasts-${today()}.csv`, slotsToCsv(slots), "text/csv")}><Icon name="download" />All slots as CSV</button>
          </div>
        </div>
        <p className="muted small">
          CSV in the board's format (download the template or all slots, edit in Sheets or Excel, upload it back), or the app's
          <code>core.en.json</code> / <code>core.ta-Latn.json</code>. One row per slot with an <code>en</code> and a <code>ta</code> column.
          Only columns in your file are changed; an empty line cell leaves that line as it is. Nothing is saved until you press Import.
        </p>
        <div className={`drop big${drag ? " over" : ""}`} role="button" tabIndex={0}
          onClick={() => inputRef.current.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); readFiles([...e.dataTransfer.files]); }}>
          <Icon name="upload" />
          <span><b>Choose files</b> or drop them here</span>
          <small>.csv or .json, several at once</small>
          <input ref={inputRef} type="file" accept=".csv,.json,.txt" multiple hidden onChange={(e) => { readFiles([...e.target.files]); e.target.value = ""; }} />
        </div>
        {files.length > 0 && (
          <div className="filelist">
            {files.map((f) => (
              <span key={f.name} className="filechip">{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((o) => o.filter((x) => x.name !== f.name))}><Icon name="x" /></button></span>
            ))}
          </div>
        )}
        <details className="pastebox">
          <summary>Or paste CSV</summary>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"slot,category,intensity,en,ta\nlh_s20,limit_hit,savage,\"{time} on {app}...\",\"{time} {app}-la...\""} />
        </details>
        <label className="checkline">
          <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
          <span>New slots start as Draft (they won't ship until you set them Live)</span>
        </label>
      </div>

      {parsed.problems.map((p) => <div key={p} className="notice">{p}</div>)}

      {plan.length > 0 && (
        <div className="card">
          <div className="hd">
            <h2 className="sec">Check before importing</h2>
            <button type="button" className="btn primary" disabled={busy || !todo.length || by("error").length > 0} onClick={apply}>
              <Icon name="upload" />Import {todo.length} {todo.length === 1 ? "slot" : "slots"}
            </button>
          </div>
          <Chips label="Show" value={filter} onChange={setFilter} options={[
            ["", "To import", todo.length + by("error").length], ["new", "New", by("new").length], ["change", "Changed", by("change").length],
            ["same", "No change", by("same").length], ["error", "Problems", by("error").length],
          ]} />
          {by("error").length > 0 && <p className="issue err">Fix the {by("error").length} rows with problems in your file and upload it again. Nothing is imported until they're fixed.</p>}
          <div className="plan">
            {shown.slice(0, 300).map((p) => (
              <div key={p.slot} className={`planrow k-${p.kind}`}>
                <span className={`badge k-${p.kind}`}>{{ new: "New", change: "Changed", same: "Same", error: "Problem" }[p.kind]}</span>
                <span className="id">{p.slot}</span>
                <div className="t">
                  {LANG_CODES.map((l) => p.texts[l] ? <div key={l} className="pl"><small>{LANG_SHORT[l]}</small><Line text={p.texts[l]} /></div> : null)}
                  {p.changes.length > 0 && <div className="meta">{p.changes.map((c) => <span key={c}>{c}</span>)}</div>}
                  {p.errors.map((e) => <div key={e} className="issue err">{e}</div>)}
                  {p.warnings.map((e) => <div key={e} className="issue">{e}</div>)}
                </div>
              </div>
            ))}
            {shown.length > 300 && <p className="muted small">…and {shown.length - 300} more.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Publish ================= */

function PublishPanel({ rows, slots, api, myName, setToast, onError }) {
  const [rel, setRel] = useState(null); // { live, releases }
  const [livePacks, setLivePacks] = useState(null);
  const [setup, setSetup] = useState(false);
  const [notes, setNotes] = useState("");
  const [anyway, setAnyway] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCov, setShowCov] = useState(false);
  const [openLang, setOpenLang] = useState("");

  async function load() {
    try {
      const r = await api.releases();
      setRel(r);
      setLivePacks(r.live ? await api.releasePacks(r.live) : {});
    } catch (err) {
      if (isMissingFn(err)) setSetup(true);
      else onError(err);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nextVersion = rel ? (rel.releases[0] ? rel.releases[0].version + 1 : 1) : 1;
  const packs = useMemo(() => buildPacks(rows, nextVersion), [rows, nextVersion]);
  const cov = useMemo(() => coverage(rows), [rows]);
  const lineErrors = useMemo(() => {
    const out = [];
    for (const g of slots) for (const r of Object.values(g.rows)) {
      if (statusOf(r) !== "live") continue;
      const e = lineIssues(r.text, g.meta.category, r.lang).errors;
      if (e.length) out.push(`${r.id}: ${e.join(" ")}`);
    }
    return out;
  }, [slots]);
  const diff = useMemo(() => (livePacks ? diffPacks(packs, livePacks) : null), [packs, livePacks]);
  const changes = diff ? Object.values(diff).reduce((n, d) => n + d.added.length + d.changed.length + d.removed.length, 0) : 0;
  const blocked = lineErrors.length > 0 || (cov.errors.length > 0 && !anyway) || !packs.en;

  async function publish() {
    setBusy(true);
    try {
      const r = await api.publish(packs, notes.trim(), myName);
      setToast(`Published version ${r.version}. The app picks it up on its next check.`);
      setNotes("");
      await load();
    } catch (err) {
      onError(err);
    }
    setBusy(false);
  }
  async function makeLive(v) {
    try {
      await api.setLive(v);
      setToast(`Version ${v} is live`);
      await load();
    } catch (err) {
      onError(err);
    }
  }
  function downloadFiles() {
    for (const [lang, p] of Object.entries(packs)) download(`core.${lang}.json`, JSON.stringify(p, null, 2));
    download("manifest.json", JSON.stringify(manifestFor(packs, nextVersion), null, 2));
    setToast("Downloaded the app files");
  }

  const urls = publicRoastUrls();
  const counts = Object.fromEntries(LANG_CODES.map((l) => [l, packs[l] ? packs[l].roasts.length : 0]));

  return (
    <div className="publishp">
      {setup && (
        <div className="notice">Publishing isn't set up in the database yet. In Supabase open SQL Editor, run <code>supabase/roast-admin.sql</code>, then come back here.</div>
      )}

      <div className="kpis">
        <div className="kpi"><span className="lab">Live English lines</span><span className="num">{counts.en}</span></div>
        <div className="kpi"><span className="lab">Live Tanglish lines</span><span className="num">{counts["ta-Latn"]}</span></div>
        <div className="kpi"><span className="lab">Changes since live</span><span className="num">{diff ? changes : "–"}</span></div>
        <div className="kpi"><span className="lab">Live version</span><span className="num">{rel && rel.live ? `v${rel.live}` : "None"}</span></div>
      </div>

      <div className="card">
        <div className="hd"><h2 className="sec">Checks</h2></div>
        <div className={`check ${lineErrors.length ? "bad" : "ok"}`}>
          <Icon name={lineErrors.length ? "x" : "check"} />
          {lineErrors.length ? `${lineErrors.length} live lines have problems. Fix them in Lines (filter: Problems).` : "Every live line is valid."}
        </div>
        {lineErrors.slice(0, 8).map((e) => <div key={e} className="issue err">{e}</div>)}
        <div className={`check ${cov.errors.length ? "bad" : cov.warnings.length ? "warn" : "ok"}`}>
          <Icon name={cov.errors.length ? "x" : "check"} />
          {cov.errors.length
            ? `${cov.errors.length} gaps: some users would get no line in their language, level and kind of app.`
            : cov.warnings.length ? `No gaps. ${cov.warnings.length} spots have only one line, so it repeats.` : "No gaps: every language, level and kind of app has at least 2 lines."}
          {(cov.errors.length > 0 || cov.warnings.length > 0) && (
            <button type="button" className="linkbtn" onClick={() => setShowCov(!showCov)}>{showCov ? "Hide" : "Show"}</button>
          )}
        </div>
        {showCov && (
          <div className="covlist">
            {cov.errors.map((e) => <div key={e.text} className="issue err">{e.text}</div>)}
            {cov.warnings.map((e) => <div key={e.text} className="issue">{e.text}</div>)}
          </div>
        )}
      </div>

      {diff && (
        <div className="card">
          <div className="hd"><h2 className="sec">What changes for the app</h2><small className="muted">compared with {rel && rel.live ? `v${rel.live}` : "nothing published"}</small></div>
          {LANG_CODES.map((l) => {
            const d = diff[l] || { added: [], changed: [], removed: [] };
            const total = d.added.length + d.changed.length + d.removed.length;
            return (
              <div key={l} className="difflang">
                <button type="button" className="linkbtn dl" onClick={() => setOpenLang(openLang === l ? "" : l)} aria-expanded={openLang === l} disabled={!total}>
                  <b>{l === "en" ? "English" : "Tanglish"}</b>
                  <span className="d-add">+{d.added.length} new</span>
                  <span className="d-chg">{d.changed.length} changed</span>
                  <span className="d-rm">−{d.removed.length} removed</span>
                </button>
                {openLang === l && (
                  <div className="difflist">
                    {d.added.map((r) => <div key={"a" + r.id} className="dr add"><span className="id">{r.id}</span><Line text={r.text} /></div>)}
                    {d.changed.map((c) => (
                      <div key={"c" + c.id} className="dr chg"><span className="id">{c.id}</span>
                        <div>{c.was.text !== c.now.text ? <><div className="was"><Line text={c.was.text} /></div><Line text={c.now.text} /></> : <span className="muted">Details changed (level, apps, dates…)</span>}</div>
                      </div>
                    ))}
                    {d.removed.map((r) => <div key={"r" + r.id} className="dr rm"><span className="id">{r.id}</span><Line text={r.text} /></div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="hd"><h2 className="sec">Publish to the app</h2></div>
        <p className="muted small">Publishes every <b>Live</b> line as version {nextVersion}. Drafts, Off lines, review notes and tester names are not included.
          Phones download it on their next check. You can switch back to an older version below at any time.</p>
        <label className="form one"><span className="lbl2">What changed <span className="hint">for your own history</span></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Diwali lines, 12 Tanglish fixes from testers" maxLength={500} />
        </label>
        {cov.errors.length > 0 && !lineErrors.length && (
          <label className="checkline"><input type="checkbox" checked={anyway} onChange={(e) => setAnyway(e.target.checked)} /><span>Publish anyway (users in the gaps get English or a milder level)</span></label>
        )}
        <div className="row-btns">
          <button type="button" className="btn" onClick={downloadFiles} disabled={!packs.en}><Icon name="download" />Download app files</button>
          <button type="button" className="btn primary" onClick={publish} disabled={busy || blocked || setup || (diff && !changes)}>
            <Icon name="send" />{diff && !changes ? "Nothing new to publish" : `Publish version ${nextVersion}`}
          </button>
        </div>
        <p className="muted small">App files: <code>core.en.json</code>, <code>core.ta-Latn.json</code> and <code>manifest.json</code> for the copy bundled inside the app (<code>src/roasts/</code>).</p>
      </div>

      {rel && rel.releases.length > 0 && (
        <div className="card">
          <div className="hd"><h2 className="sec"><Icon name="history" /> Versions</h2></div>
          <div className="rels">
            {rel.releases.map((r) => (
              <div key={r.version} className={`rel${r.version === rel.live ? " live" : ""}`}>
                <b>v{r.version}</b>
                <div className="t">
                  <div>{r.notes || <span className="muted">No notes</span>}</div>
                  <div className="meta"><span>{fmtDateTime(r.createdAt)}</span>{r.createdBy && <span>by {r.createdBy}</span>}
                    {Object.entries(r.counts || {}).map(([l, c]) => <span key={l}>{LANG_SHORT[l] || l} {c}</span>)}</div>
                </div>
                {r.version === rel.live ? <span className="pill rv-keep"><i />Live</span>
                  : <button type="button" className="btn sm" onClick={() => makeLive(r.version)}>Make live</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="hd"><h2 className="sec">How the app gets it</h2></div>
        <p className="muted small">Public links, no passcode. They only ever return the live version.</p>
        <div className="urls">
          <code>{urls.manifest}</code>
          <code>{urls.pack("en")}</code>
          <code>{urls.pack("ta-Latn")}</code>
        </div>
        <p className="muted small">Send the <code>apikey</code> header with the project's publishable key. The manifest gives the live version and a checksum per language; download a pack only when they change.</p>
      </div>
    </div>
  );
}


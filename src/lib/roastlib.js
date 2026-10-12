// Roast library logic for the admin tab: slots, checks, coverage, app pack files, CSV/JSON import.
// Mirrors design/tools/roasts/build.py in the app repo, so files made here match the app's format.
//
// Model: one row per language per slot. Row id = language prefix + slot ("en_lh_s03", "ta_lh_s03").
// A slot is category + level + app kinds + apps + roaster (+ extras). The text can be a different
// joke per language; the slot details are the same on both rows.

import { NATIVE_CATEGORIES, NATIVE_PLACEHOLDERS, PLACEHOLDERS } from "./constants";

export const LANG_CODES = ["en", "ta-Latn"];
export const LANG_PREFIX = { en: "en", "ta-Latn": "ta" };
export const LANG_SHORT = { en: "EN", "ta-Latn": "TA" };

export const LEVELS = ["polite", "honest", "savage", "unhinged"];
/** Levels users can pick in the app today. Add "unhinged" when it ships. */
export const USER_LEVELS = ["polite", "honest", "savage"];
export const APP_KIND_LIST = ["feed", "video", "chat", "browser", "games", "shopping", "work"];
export const APP_KEYS = {
  instagram: ["com.instagram.android"],
  youtube: ["com.google.android.youtube"],
  snapchat: ["com.snapchat.android"],
  x: ["com.twitter.android"],
  reddit: ["com.reddit.frontpage"],
  whatsapp: ["com.whatsapp"],
};
export const LINE_STATUS = [
  ["live", "Live", "var(--chill)"],
  ["draft", "Draft", "var(--heads)"],
  ["off", "Off", "var(--sev-polish)"],
];

const LEVELLED = ["heads_up", "last_call", "limit_hit", "snooze_ask", "snooze_sentence_1"];
const ANY_LEVEL = [
  "late_night", "after_snooze", "snooze_sentence_2", "snoozes_used_up", "snooze_backout",
  "home_day1", "home_under", "home_close", "home_over", "weekly_good", "weekly_bad", "weekly_mixed", "weekly_first",
  "win_first_roast", "win_streak", "win_streak_7", "win_perfect_day", "win_lowered_limit", "comparison",
];
const TYPED = ["snooze_sentence_1", "snooze_sentence_2"];

/** Prefix for new slot ids, by moment. Levelled moments add the level letter (lh_s14). */
const ID_PREFIX = {
  limit_hit: "lh", heads_up: "hu", last_call: "lc", late_night: "ln", snooze_ask: "sa",
  snooze_sentence_1: "st", snooze_sentence_2: "st2", after_snooze: "as", snoozes_used_up: "su",
  snooze_backout: "cm", comparison: "cp", weekly_good: "wr_g", weekly_bad: "wr_b", weekly_mixed: "wr_m",
  weekly_first: "wr_f", win_first_roast: "w", win_streak: "w", win_streak_7: "w", win_perfect_day: "w",
  win_lowered_limit: "w", home_day1: "hm", home_under: "hm", home_close: "hm", home_over: "hm",
};

export const SAMPLE = {
  app: "Instagram", time: "1h 32m", left: "15m", limit: "1h", over: "32m", opens: "47", clock: "1:12 am",
  streak: "6", week_total: "9h 14m", won_back: "2h 41m", worst_app: "Instagram", worst_time: "4h 02m",
};
export const fillSample = (t) => String(t || "").replace(/\{(\w+)\}/g, (m, k) => (k in SAMPLE ? SAMPLE[k] : m));

/** Fields that describe the slot (same on every language row). */
export const META_KEYS = ["category", "intensity", "kinds", "apps", "roaster", "order", "minMinutes", "minStreak", "fact", "from", "to"];

/* ---------- slots ---------- */

export const isProposal = (r) => r.source === "new";
export const slotOf = (r) => (isProposal(r) ? null : r.slot || String(r.id).replace(/^(en|ta)_/, ""));
export const rowId = (lang, slot) => `${LANG_PREFIX[lang]}_${slot}`;
export const statusOf = (r) => (r && r.status) || "live";

export function metaOf(r) {
  const m = {};
  for (const k of META_KEYS) m[k] = r[k] === undefined ? null : r[k];
  if (!m.kinds || !m.kinds.length) m.kinds = null;
  if (!m.apps || !m.apps.length) m.apps = null;
  return m;
}

/** Group board rows into slots: [{ slot, meta, rows: { en, "ta-Latn" } }], in app order. */
export function groupSlots(rows) {
  const map = new Map();
  for (const r of rows) {
    const s = slotOf(r);
    if (!s) continue;
    if (!map.has(s)) map.set(s, { slot: s, meta: null, rows: {} });
    const g = map.get(s);
    g.rows[r.lang] = r;
    if (!g.meta || r.lang === "en") g.meta = metaOf(r);
  }
  return [...map.values()].sort((a, b) => (a.meta.order ?? 1e9) - (b.meta.order ?? 1e9) || a.slot.localeCompare(b.slot));
}

export function nextSlotId(category, intensity, slots) {
  let pre = ID_PREFIX[category] || "x";
  if (LEVELLED.includes(category)) pre += "_" + (intensity ? intensity[0] : "a");
  else pre += "_";
  if (!pre.endsWith("_")) pre += "_";
  const taken = new Set(slots.map((s) => s.slot));
  let n = slots.filter((s) => s.slot.startsWith(pre)).reduce((m, s) => Math.max(m, parseInt(s.slot.slice(pre.length)) || 0), 0) + 1;
  while (taken.has(pre + String(n).padStart(2, "0"))) n++;
  return pre + String(n).padStart(2, "0");
}
export const nextOrder = (slots) => slots.reduce((m, s) => Math.max(m, s.meta.order ?? 0), 0) + 1;

/** Rows to save for one slot. texts/statuses keyed by language; empty text removes that language's row. */
export function rowsForSlot(slot, meta, texts, statuses, existing = {}, extra = {}) {
  const save = [], remove = [];
  const now = new Date().toISOString();
  for (const lang of LANG_CODES) {
    const id = rowId(lang, slot);
    const text = (texts[lang] || "").trim();
    const old = existing[lang];
    if (!text) {
      if (old) remove.push(old.id);
      continue;
    }
    const base = old ? { ...old } : { source: "app", review: "unreviewed", createdAt: now };
    delete base.id;
    save.push({
      id: old ? old.id : id,
      data: { ...base, ...cleanMeta(meta), ...(extra[lang] || {}), slot, lang, text, status: statuses[lang] || "live", updatedAt: now },
    });
  }
  return { save, remove };
}

export function cleanMeta(meta) {
  const m = {
    category: meta.category,
    intensity: meta.intensity || null,
    kinds: meta.kinds && meta.kinds.length ? [...meta.kinds] : null,
    apps: meta.apps && meta.apps.length ? [...meta.apps] : null,
    roaster: meta.roaster || null,
    order: meta.order ?? null,
  };
  if (meta.category === "comparison" && meta.minMinutes) m.minMinutes = Number(meta.minMinutes);
  else m.minMinutes = null;
  if (meta.category === "win_streak" && meta.minStreak) m.minStreak = Number(meta.minStreak);
  else m.minStreak = null;
  m.fact = meta.fact ? true : null;
  m.from = meta.from || null;
  m.to = meta.to || null;
  return m;
}

/* ---------- checks ---------- */

/** Problems with one line. Errors block publishing; warnings don't. */
export function lineIssues(text, category, lang, allTexts = null) {
  const errors = [], warnings = [];
  const t = String(text || "").trim();
  if (!t) return { errors: ["Line is empty."], warnings };
  const used = [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = used.filter((k) => !PLACEHOLDERS.includes(k));
  if (unknown.length) errors.push(`Unknown placeholder {${unknown.join("}, {")}}.`);
  if (/[{}]/.test(t.replace(/\{\w+\}/g, ""))) errors.push("A { or } is not closed.");
  if (NATIVE_CATEGORIES.includes(category) && used.some((k) => !NATIVE_PLACEHOLDERS.includes(k)))
    warnings.push(`On the roast screen and notifications only ${NATIVE_PLACEHOLDERS.join(", ")} can be filled; this line will be skipped there.`);
  if (TYPED.includes(category)) {
    if (used.length) errors.push("People type this sentence, so it can't have placeholders.");
    if (t.length > 70) warnings.push("Long for something people have to type (over 70 characters).");
    if (/[^\x20-\x7E]/.test(t)) warnings.push("Has characters that are hard to type (emoji, curly quotes or accents).");
  }
  if (t.length > 160) warnings.push("Long line (over 160 characters). It may not fit on the roast screen.");
  if (allTexts && allTexts.filter((x) => x.trim().toLowerCase() === t.toLowerCase()).length > 1)
    warnings.push(`Same text as another ${LANG_SHORT[lang] || ""} line.`);
  return { errors, warnings };
}

export function slotIssues(slot, meta, slots, isNew) {
  const errors = [];
  if (!/^[a-z0-9_]{1,40}$/.test(slot)) errors.push("Slot id: lowercase letters, numbers and _ only.");
  else if (/^(en|ta)_/.test(slot)) errors.push("Slot id can't start with en_ or ta_ (that's the language).");
  else if (isNew && slots.some((s) => s.slot === slot)) errors.push(`Slot ${slot} already exists.`);
  if (!meta.category) errors.push("Pick a moment.");
  if (meta.category === "comparison" && !meta.minMinutes) errors.push("Comparison lines need minimum minutes.");
  if (meta.from && meta.to && meta.from > meta.to) errors.push("The start date is after the end date.");
  return errors;
}

/* ---------- coverage (same rules as build.py) ---------- */

const isOn = (r) => statusOf(r) === "live" && String(r.text || "").trim();

function pool(lines, cat, lvl, kind, roaster) {
  return lines.filter((r) => r.category === cat && !(r.apps && r.apps.length)
    && (!r.roaster || r.roaster === roaster)
    && (!r.kinds || !r.kinds.length || r.kinds.includes(kind))
    && (lvl === null || !r.intensity || r.intensity === lvl));
}

/** { errors, warnings } for what users would actually get from the live lines. */
export function coverage(rows) {
  const errors = [], warnings = [];
  const kinds = [...APP_KIND_LIST, "other"];
  for (const lang of LANG_CODES) {
    const lines = rows.filter((r) => !isProposal(r) && r.lang === lang && isOn(r));
    const s = LANG_SHORT[lang];
    const seenE = new Set(), seenW = new Set();
    for (const roaster of ["loop", "lupe"]) {
      for (const kind of kinds) {
        for (const cat of LEVELLED) for (const lvl of USER_LEVELS) {
          const n = pool(lines, cat, lvl, kind, roaster).length;
          const key = `${s}|${cat}|${lvl}|${kind}`;
          if (n === 0 && !seenE.has(key)) { seenE.add(key); errors.push({ lang, cat, lvl, kind, roaster, text: `${s}: no ${cat} line at ${lvl} for ${kind} apps` }); }
          else if (n === 1 && !seenW.has(key)) { seenW.add(key); warnings.push({ lang, cat, lvl, kind, roaster, text: `${s}: only 1 ${cat} line at ${lvl} for ${kind} apps` }); }
        }
        for (const cat of ANY_LEVEL) {
          const key = `${s}|${cat}|${kind}`;
          if (!pool(lines, cat, null, kind, roaster).length && !seenE.has(key)) {
            seenE.add(key);
            errors.push({ lang, cat, lvl: null, kind, roaster, text: `${s}: no ${cat} line for ${kind} apps` });
          }
        }
      }
    }
  }
  return { errors, warnings };
}

/* ---------- app pack files ---------- */

const NOTES = "Same id = same slot in every language (category, intensity, apps, kinds, roaster). The text can be a different joke per language. intensity null = any level; apps null = any app; kinds null = any kind of app (feed, video, chat, browser, games, shopping, work); roaster null = both. from/to (YYYY-MM-DD, optional) = only show between these dates. snooze_sentence_* must be typed by the user; compare ignoring case and extra spaces. comparison lines use minMinutes; win_streak uses minStreak.";

/** The app's pack document for one language, built from live lines. */
export function buildPack(rows, lang, version) {
  const slots = groupSlots(rows);
  const roasts = [];
  for (const g of slots) {
    const r = g.rows[lang];
    if (!r || !isOn(r)) continue;
    const m = g.meta;
    const out = {
      id: g.slot, category: m.category, intensity: m.intensity || null, text: String(r.text).trim(),
      apps: m.apps || null, roaster: m.roaster || null, kinds: m.kinds || null, lang,
    };
    if (m.minMinutes != null) out.minMinutes = m.minMinutes;
    if (m.minStreak != null) out.minStreak = m.minStreak;
    if (m.fact) out.fact = true;
    if (m.from) out.from = m.from;
    if (m.to) out.to = m.to;
    roasts.push(out);
  }
  return { pack: "core", lang, version, placeholders: [...PLACEHOLDERS].sort(), appKeys: APP_KEYS, notes: NOTES, roasts };
}

export function buildPacks(rows, version) {
  const packs = {};
  for (const lang of LANG_CODES) {
    const p = buildPack(rows, lang, version);
    if (p.roasts.length) packs[lang] = p;
  }
  return packs;
}

export const manifestFor = (packs, version) => ({
  version,
  packs: Object.entries(packs).map(([lang, p]) => ({ file: `core.${lang}.json`, lang, count: p.roasts.length })),
});

/** JSON with sorted keys, so lines compare equal whatever order the database stored their keys in. */
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().filter((key) => x[key] !== undefined).map((key) => [key, x[key]])) : x));

/** What changed between two sets of packs: per language, added / changed / removed ids. */
export function diffPacks(next, prev) {
  const out = {};
  for (const lang of new Set([...Object.keys(next || {}), ...Object.keys(prev || {})])) {
    const a = new Map(((next || {})[lang]?.roasts || []).map((r) => [r.id, r]));
    const b = new Map(((prev || {})[lang]?.roasts || []).map((r) => [r.id, r]));
    const added = [], changed = [], removed = [];
    for (const [id, r] of a) {
      if (!b.has(id)) added.push(r);
      else if (canon(r) !== canon(b.get(id))) changed.push({ id, now: r, was: b.get(id) });
    }
    for (const [id, r] of b) if (!a.has(id)) removed.push(r);
    out[lang] = { added, changed, removed };
  }
  return out;
}

/* ---------- CSV ---------- */

export const CSV_COLS = ["slot", "category", "intensity", "roaster", "kinds", "apps", "from", "to", "minMinutes", "minStreak", "fact", "order",
  "status_en", "en", "status_ta", "ta"];

const cell = (v) => {
  v = String(v ?? "");
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

export function slotsToCsv(slots) {
  const lines = [CSV_COLS.join(",")];
  for (const g of slots) {
    const m = g.meta, en = g.rows.en, ta = g.rows["ta-Latn"];
    lines.push([
      g.slot, m.category, m.intensity || "", m.roaster || "", (m.kinds || []).join(" "), (m.apps || []).join(" "),
      m.from || "", m.to || "", m.minMinutes ?? "", m.minStreak ?? "", m.fact ? "yes" : "", m.order ?? "",
      en ? statusOf(en) : "", en ? en.text : "", ta ? statusOf(ta) : "", ta ? ta.text : "",
    ].map(cell).join(","));
  }
  return "﻿" + lines.join("\r\n");
}

export function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/* ---------- import ---------- */

const listOf = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean);
  const s = String(v ?? "").trim();
  return s ? s.split(/[\s,;|]+/).filter(Boolean) : [];
};
const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
const bool = (v) => (typeof v === "boolean" ? v : /^(yes|true|1|y)$/i.test(String(v ?? "").trim()));
const levelOrNull = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return !s || s === "any" || s === "null" ? null : s;
};
const roasterOrNull = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return !s || s === "both" || s === "any" || s === "null" ? null : s;
};

/** Records from a CSV in the board's format. Only columns present in the file are touched. */
function recordsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  const idx = (k) => head.indexOf(k);
  if (idx("slot") < 0) throw new Error("The CSV needs a 'slot' column. Download the template to see the format.");
  const out = [];
  for (const r of rows.slice(1)) {
    const get = (k) => (idx(k) >= 0 ? r[idx(k)] ?? "" : undefined);
    const rec = { slot: String(get("slot")).trim(), meta: {}, texts: {}, statuses: {} };
    if (get("category") !== undefined) rec.meta.category = String(get("category")).trim();
    if (get("intensity") !== undefined) rec.meta.intensity = levelOrNull(get("intensity"));
    if (get("roaster") !== undefined) rec.meta.roaster = roasterOrNull(get("roaster"));
    if (get("kinds") !== undefined) rec.meta.kinds = listOf(get("kinds"));
    if (get("apps") !== undefined) rec.meta.apps = listOf(get("apps"));
    if (get("from") !== undefined) rec.meta.from = String(get("from")).trim() || null;
    if (get("to") !== undefined) rec.meta.to = String(get("to")).trim() || null;
    if (get("minMinutes") !== undefined) rec.meta.minMinutes = numOrNull(get("minMinutes"));
    if (get("minStreak") !== undefined) rec.meta.minStreak = numOrNull(get("minStreak"));
    if (get("fact") !== undefined) rec.meta.fact = bool(get("fact"));
    if (get("order") !== undefined && String(get("order")).trim()) rec.meta.order = numOrNull(get("order"));
    for (const [col, lang] of [["en", "en"], ["ta", "ta-Latn"]]) {
      const t = get(col);
      if (t !== undefined && String(t).trim()) rec.texts[lang] = String(t).trim();
      const st = get("status_" + col);
      if (st !== undefined && String(st).trim()) rec.statuses[lang] = String(st).trim().toLowerCase();
    }
    if (rec.slot) out.push(rec);
  }
  return out;
}

/** Records from JSON: an app pack file (core.en.json), an array of pack lines, or { roasts: [...] }. */
function recordsFromJson(text) {
  const doc = JSON.parse(text);
  const list = Array.isArray(doc) ? doc : doc.roasts;
  if (!Array.isArray(list)) throw new Error("JSON must be an app pack file (with a 'roasts' list) or a list of lines.");
  const fileLang = !Array.isArray(doc) && doc.lang;
  return list.map((r) => {
    const lang = r.lang || fileLang || "en";
    const slot = String(r.slot || r.id || "").replace(/^(en|ta)_/, "").trim();
    const meta = {};
    for (const k of ["category", "intensity", "roaster", "kinds", "apps", "minMinutes", "minStreak", "fact", "from", "to", "order"]) {
      if (k in r) meta[k] = k === "kinds" || k === "apps" ? listOf(r[k]) : r[k];
    }
    return { slot, meta, texts: r.text ? { [lang]: String(r.text).trim() } : {}, statuses: r.status ? { [lang]: r.status } : {} };
  });
}

/** Parse uploaded files into one record per slot (later files win). */
export function parseImport(files) {
  const bySlot = new Map();
  const problems = [];
  for (const { name, text } of files) {
    let recs;
    try {
      recs = /\.json$/i.test(name) || /^\s*[[{]/.test(text) ? recordsFromJson(text) : recordsFromCsv(text);
    } catch (e) {
      problems.push(`${name}: ${e.message}`);
      continue;
    }
    for (const r of recs) {
      const cur = bySlot.get(r.slot) || { slot: r.slot, meta: {}, texts: {}, statuses: {} };
      bySlot.set(r.slot, {
        slot: r.slot, meta: { ...cur.meta, ...r.meta },
        texts: { ...cur.texts, ...r.texts }, statuses: { ...cur.statuses, ...r.statuses },
      });
    }
  }
  return { records: [...bySlot.values()], problems };
}

/**
 * Compare imported records with the board. Returns a plan:
 * [{ slot, kind: "new" | "change" | "same" | "error", changes: [..], errors: [..], warnings: [..], save, remove }]
 */
export function planImport(records, slots) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  let order = nextOrder(slots);
  return records.map((rec) => {
    const cur = bySlot.get(rec.slot);
    const meta = { ...(cur ? cur.meta : { category: null, intensity: null, kinds: null, apps: null, roaster: null, order: order++ }), ...rec.meta };
    const errors = slotIssues(rec.slot, meta, slots, false);
    const warnings = [];
    if (meta.intensity && !LEVELS.includes(meta.intensity)) errors.push(`Unknown level "${meta.intensity}".`);
    if (meta.roaster && !["loop", "lupe"].includes(meta.roaster)) errors.push(`Unknown roaster "${meta.roaster}".`);
    for (const k of meta.kinds || []) if (!APP_KIND_LIST.includes(k)) errors.push(`Unknown app kind "${k}".`);
    for (const a of meta.apps || []) if (!APP_KEYS[a]) errors.push(`Unknown app "${a}".`);
    for (const d of [meta.from, meta.to]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`Dates must look like 2026-11-01 (got "${d}").`);
    const texts = {}, statuses = {};
    for (const lang of LANG_CODES) {
      const old = cur && cur.rows[lang];
      texts[lang] = rec.texts[lang] ?? (old ? old.text : "");
      statuses[lang] = rec.statuses[lang] ?? (old ? statusOf(old) : "live");
      if (!["live", "draft", "off"].includes(statuses[lang])) errors.push(`Unknown status "${statuses[lang]}".`);
      if (rec.texts[lang] !== undefined) {
        const li = lineIssues(texts[lang], meta.category, lang);
        errors.push(...li.errors.map((e) => `${LANG_SHORT[lang]}: ${e}`));
        warnings.push(...li.warnings.map((e) => `${LANG_SHORT[lang]}: ${e}`));
      }
    }
    if (!LANG_CODES.some((l) => texts[l])) errors.push("No line in any language.");
    const changes = [];
    if (cur) {
      const cm = cleanMeta(cur.meta), nm = cleanMeta(meta);
      for (const k of Object.keys(nm)) if (JSON.stringify(cm[k]) !== JSON.stringify(nm[k])) changes.push(`${k}: ${fmt(cm[k])} → ${fmt(nm[k])}`);
      for (const lang of LANG_CODES) {
        const old = cur.rows[lang];
        if ((old ? old.text : "") !== texts[lang]) changes.push(`${LANG_SHORT[lang]} text`);
        if (old && statusOf(old) !== statuses[lang]) changes.push(`${LANG_SHORT[lang]} status: ${statusOf(old)} → ${statuses[lang]}`);
      }
    }
    const kind = errors.length ? "error" : !cur ? "new" : changes.length ? "change" : "same";
    const { save, remove } = kind === "new" || kind === "change"
      ? rowsForSlot(rec.slot, meta, texts, statuses, cur ? cur.rows : {}) : { save: [], remove: [] };
    return { slot: rec.slot, kind, changes, errors, warnings, texts, meta, save, remove };
  });
}
const fmt = (v) => (v == null || (Array.isArray(v) && !v.length) ? "any" : Array.isArray(v) ? v.join(" ") : String(v));

/* ---------- files ---------- */

export function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const TEMPLATE_CSV = "﻿" + [
  CSV_COLS.join(","),
  'lh_s20,limit_hit,savage,,feed video,,,,,,,,live,"{time} on {app}. Your thumb deserves a pension.",live,"{time} {app}-la. Unga thumb-ku pension kudukkanum."',
  'ln_20,late_night,,,,,2026-10-28,2026-11-02,,,,,draft,"Diwali crackers are louder than your notifications. Sleep.",draft,"Pattasu sound-e unga notification-a vida jaasti. Thoongunga."',
].join("\r\n");

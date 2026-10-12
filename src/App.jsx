import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage, isConfigured, makeApi } from "./lib/api";
import { INTENSITY, KINDS, LANGS, REVIEW, ROASTER, SEV, SSTATUS, STATUS } from "./lib/constants";
import { bid, catLbl, codeOf, downloadFile, isOpen, lbl, reviewOf, sActive, screenLbl, sid, toCsv, today } from "./lib/format";
import { useLocalState } from "./lib/useLocalState";
import Icon from "./components/Icon";
import Gate from "./components/Gate";
import ItemSheet from "./components/ItemSheet";
import { Brand } from "./components/bits";
import Dashboard from "./views/Dashboard";
import BugsView from "./views/BugsView";
import SuggestionsView from "./views/SuggestionsView";
import RoastsView from "./views/RoastsView";
import RoastAdminView from "./views/RoastAdminView";
import { download, groupSlots, slotsToCsv } from "./lib/roastlib";

const TABS = [
  ["dash", "Dashboard", "chart"],
  ["bugs", "Bugs", "bug"],
  ["sugg", "Suggestions", "bulb"],
  ["roast", "Roasts", "flame"],
];
const ADMIN_TAB = ["admin", "Roast admin", "sliders"];
const HASH_TAB = { "#dashboard": "dash", "#bugs": "bugs", "#suggestions": "sugg", "#roasts": "roast", "#roast-admin": "admin" };

const BUG_COLS = [
  ["ID", (b) => bid(b.num)], ["Title", (b) => b.title], ["Screen", (b) => screenLbl(b.screen)], ["Severity", (b) => lbl(SEV, b.severity)],
  ["Status", (b) => lbl(STATUS, b.status)], ["Roaster", (b) => (b.roaster ? lbl(ROASTER, b.roaster) : "")], ["Device", (b) => b.device],
  ["Build", (b) => b.build], ["Reported by", (b) => b.reporter], ["Steps", (b) => b.steps], ["Expected vs actual", (b) => b.expected],
  ["Fix notes", (b) => b.notes], ["Reported", (b) => b.createdAt], ["Updated", (b) => b.updatedAt], ["Closed", (b) => b.closedAt],
];
const SUGG_COLS = [
  ["ID", (s) => sid(s.num)], ["Type", (s) => lbl(KINDS, s.kind)], ["Title", (s) => s.title], ["Roast line", (s) => s.roastLine],
  ["For roast", (s) => s.roastId], ["Intensity", (s) => (s.intensity ? lbl(INTENSITY, s.intensity) : "")],
  ["Roaster", (s) => (s.roaster ? lbl(ROASTER, s.roaster) : "")], ["Screen", (s) => (s.screen ? screenLbl(s.screen) : "")],
  ["Status", (s) => lbl(SSTATUS, s.status)], ["Suggested by", (s) => s.suggestedBy], ["Details", (s) => s.details],
  ["Notes", (s) => s.notes], ["Added", (s) => s.createdAt], ["Updated", (s) => s.updatedAt], ["Closed", (s) => s.closedAt],
];
const ROAST_COLS = [
  ["ID", (r) => r.id], ["Language", (r) => lbl(LANGS, r.lang)], ["Moment", (r) => catLbl(r.category)], ["Category key", (r) => r.category],
  ["Intensity", (r) => r.intensity || "any"], ["Roaster", (r) => r.roaster || "both"], ["App kinds", (r) => (r.kinds || []).join(" ")],
  ["Current line", (r) => r.text], ["Decision", (r) => lbl(REVIEW, reviewOf(r))], ["New version", (r) => r.proposed],
  ["Notes", (r) => r.notes], ["Reviewed by", (r) => r.reviewedBy], ["Reviewed", (r) => r.reviewedAt],
];

function readStored(key) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}
function writeStored(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* blocked */ }
}

export default function App() {
  const [code, setCode] = useState(() => readStored("elb.code"));
  const [myName, setMyName] = useState(() => readStored("elb.name"));
  const [gateMsg, setGateMsg] = useState("");
  const [role, setRole] = useState(null);
  const [data, setData] = useState({ bugs: [], suggestions: [], roasts: [] });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useLocalState("elb.tab", HASH_TAB[location.hash] || "dash");
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [notice, setNotice] = useState("");

  const api = useMemo(() => makeApi(code), [code]);
  const isAdmin = role === "admin";
  const sheetOpen = useRef(false);
  const adminSheetOpen = useRef(false);
  const [newSlot, setNewSlot] = useState(0);
  sheetOpen.current = Boolean(sheet);

  const lock = useCallback((msg = "") => {
    writeStored("elb.code", "");
    setCode("");
    setRole(null);
    setLoaded(false);
    setSheet(null);
    setGateMsg(msg);
  }, []);

  const handleErr = useCallback((err) => {
    if (err.code === "wrong_code") lock("That passcode no longer works. Enter the current one.");
    else setNotice(errorMessage(err));
  }, [lock]);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const d = await api.read();
      setRole(d.role);
      setData({ bugs: d.bugs || [], suggestions: d.suggestions || [], roasts: d.roasts || [] });
      setLoaded(true);
      setNotice("");
    } catch (err) {
      handleErr(err);
    }
  }, [api, code, handleErr]);

  // Load on unlock, then every 30 s and whenever the tab comes back, unless a sheet is open.
  useEffect(() => {
    if (!code || !isConfigured) return;
    refresh();
    const tick = () => !document.hidden && !sheetOpen.current && !adminSheetOpen.current && refresh();
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [code, refresh]);

  // The admin tab is admin-only; send testers who land on it to the Roasts tab.
  useEffect(() => {
    if (role && role !== "admin" && tab === "admin") setTab("roast");
  }, [role, tab, setTab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function unlock(newCode, name) {
    try {
      await makeApi(newCode).read();
    } catch (err) {
      return err.code === "wrong_code" ? "That passcode isn't right." : "Couldn't reach the board. Check your connection.";
    }
    writeStored("elb.code", newCode);
    writeStored("elb.name", name);
    setMyName(name);
    setGateMsg("");
    setCode(newCode);
    return null;
  }

  const store = { bug: data.bugs, sugg: data.suggestions, roast: data.roasts };
  const sheetItem = sheet && sheet.id ? store[sheet.type].find((x) => x.id === sheet.id) : null;

  function openSheet(type, id = null, prefill = null) {
    if (type === "roast" && !id && !isAdmin) {
      type = "sugg";
      prefill = { kind: "roast" };
    }
    setSheet({ type, id, prefill, key: Date.now() });
  }

  async function save(type, item, payload, pending = []) {
    let failMsg = "";
    try {
      if (type === "roast") {
        await api.saveRoast(payload.id, payload.data);
        setToast(`${item ? "Saved" : "Added"} ${payload.id}`);
      } else {
        const saved = await api.save(type, item ? item.id : null, payload.data);
        const label = codeOf(type, saved || item);
        let failed = 0;
        for (const f of pending) {
          try {
            await api.attach(type, saved.id, f.name, f.data, myName);
          } catch {
            failed++;
          }
        }
        if (failed) failMsg = `Added ${label}, but ${failed} of ${pending.length} images didn't upload. Open it and add them again.`;
        setToast(`${item ? "Saved" : "Added"} ${label}${pending.length - failed ? ` with ${pending.length - failed} image${pending.length - failed === 1 ? "" : "s"}` : ""}`);
      }
      setSheet(null);
      await refresh();
      if (failMsg) setNotice(failMsg);
      return true;
    } catch (err) {
      handleErr(err);
      return false;
    }
  }

  async function remove(type, item) {
    try {
      await api.remove(type, item.id);
      setSheet(null);
      setToast(`Deleted ${codeOf(type, item)}`);
      refresh();
    } catch (err) {
      handleErr(err);
    }
  }

  function exportCsv() {
    if (tab === "admin") {
      const slots = groupSlots(data.roasts);
      if (!slots.length) return setToast("No roast slots to export yet");
      download(`endloop-roasts-${today()}.csv`, slotsToCsv(slots), "text/csv");
      return setToast(`Exported ${slots.length} roast slots`);
    }
    const [rows, cols, what, key] =
      tab === "sugg" ? [data.suggestions, SUGG_COLS, "suggestions"]
      : tab === "roast" ? [data.roasts, ROAST_COLS, "roasts", (r) => r.lang + r.id]
      : [data.bugs, BUG_COLS, "bugs"];
    if (!rows.length) {
      setToast(`No ${what} to export yet`);
      return;
    }
    downloadFile(`endloop-${what}-${today()}.csv`, toCsv(rows, cols, key));
    setToast(`Exported ${rows.length} ${what === "roasts" ? "roast lines" : what}`);
  }

  if (!isConfigured || !code) {
    return <Gate configured={isConfigured} message={gateMsg} defaultName={myName} onUnlock={unlock} />;
  }

  const counts = {
    bugs: data.bugs.filter((b) => isOpen(b.status)).length,
    sugg: data.suggestions.filter((s) => sActive(s.status)).length,
    roast: data.roasts.filter((r) => ["change", "remove", "new"].includes(r.review)).length,
  };
  const onAdmin = tab === "admin" && isAdmin;
  const newLabel = onAdmin ? "New roast slot" : { sugg: "Add suggestion", roast: isAdmin ? "Add roast line" : "Suggest a roast line" }[tab] || "Report a bug";
  const exportLabel = `Export ${{ sugg: "suggestions", roast: "roasts", admin: "roast slots" }[tab] || "bugs"}`;
  const newItem = () => (onAdmin ? setNewSlot(Date.now()) : openSheet(tab === "sugg" ? "sugg" : tab === "roast" ? "roast" : "bug"));
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <>
      <div className="wrap" id="app">
        <header className="top">
          <Brand tag="Test board" />
          <div className="top-actions">
            <span className="role" id="roleTag">{role ? (isAdmin ? "Admin" : `Tester${myName ? " · " + myName : ""}`) : ""}</span>
            <button className="btn icon ghost" type="button" title="Lock the board on this device" aria-label="Lock" id="lockBtn" onClick={() => lock()}>
              <Icon name="lock" />
            </button>
            <button className="btn" type="button" id="exportBtn" title={exportLabel + " as CSV"} onClick={exportCsv}>
              <Icon name="download" /><span className="lbl">{exportLabel}</span>
            </button>
            <button className="btn primary" type="button" id="newBtn" onClick={newItem}>
              <Icon name="plus" /><span className="lbl">{newLabel}</span>
            </button>
          </div>
        </header>

        {notice && <div className="notice" role="status">{notice}</div>}

        <div className="tabs" role="tablist" aria-label="View">
          {tabs.map(([k, label, icon]) => (
            <button key={k} className="tab" role="tab" id={`tab-${k}`} type="button" aria-selected={tab === k} onClick={() => setTab(k)}>
              <Icon name={icon} />
              <span className="tl">{label}</span>
              {counts[k] !== undefined && <span className="count">{counts[k]}</span>}
            </button>
          ))}
        </div>

        {tab === "dash" && (
          <Dashboard bugs={data.bugs} suggs={data.suggestions} roasts={data.roasts} onOpen={openSheet} onGoto={setTab} />
        )}
        {tab === "bugs" && <BugsView bugs={data.bugs} loaded={loaded} onOpen={openSheet} />}
        {tab === "sugg" && <SuggestionsView suggs={data.suggestions} loaded={loaded} onOpen={openSheet} />}
        {tab === "roast" && <RoastsView roasts={data.roasts} loaded={loaded} onOpen={openSheet} />}
        {tab === "admin" && (isAdmin ? (
          <RoastAdminView rows={data.roasts} loaded={loaded} api={api} myName={myName} refresh={refresh}
            setToast={setToast} onError={handleErr} sheetOpenRef={adminSheetOpen} newSlotSignal={newSlot} />
        ) : role ? (
          <div className="notice">Roast admin needs the admin passcode.</div>
        ) : null)}
      </div>

      <button className="btn primary fab" id="fab" type="button" onClick={newItem}>
        <Icon name="plus" />{newLabel}
      </button>

      {sheet && (sheet.id ? sheetItem : true) && (
        <ItemSheet
          key={sheet.key}
          sheet={sheet}
          item={sheetItem}
          api={api}
          onFilesChanged={refresh}
          isAdmin={isAdmin}
          myName={myName}
          suggs={data.suggestions}
          roasts={data.roasts}
          onClose={() => setSheet(null)}
          onSave={save}
          onDelete={remove}
          onSuggestChange={(r) =>
            openSheet("sugg", null, {
              kind: "roast", roastId: r.id, title: `Change to ${r.id}`, roastLine: r.proposed || r.text,
              intensity: r.intensity || "", roaster: r.roaster || "",
            })
          }
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

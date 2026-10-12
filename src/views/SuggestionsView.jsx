import { INTENSITY, KINDS, ROASTER, SCREENS, SSTATUS } from "../lib/constants";
import { ago, col, lbl, sActive, screenLbl, sid } from "../lib/format";
import { IMG } from "../lib/images";
import { useLocalState } from "../lib/useLocalState";
import Icon from "../components/Icon";
import { Chips, Empty, Line, Pill, Select } from "../components/bits";

export default function SuggestionsView({ suggs, loaded, onOpen }) {
  const [q, setQ] = useLocalState("elb.sugg.q", "");
  const [status, setStatus] = useLocalState("elb.sugg.status", "active");
  const [roaster, setRoaster] = useLocalState("elb.sugg.roaster", "");
  const [screen, setScreen] = useLocalState("elb.sugg.screen", "");
  const [kind, setKind] = useLocalState("elb.sugg.kind", "");

  const active = suggs.filter((s) => sActive(s.status));
  const query = q.trim().toLowerCase();
  const rows = suggs
    .filter((s) =>
      (status === "all" || sActive(s.status)) && (!kind || s.kind === kind) &&
      (!roaster || s.roaster === roaster || s.roaster === "both") && (!screen || s.screen === screen) &&
      (!query || [s.title, s.details, s.roastLine, s.suggestedBy, s.notes, s.roastId, sid(s.num)].join(" ").toLowerCase().includes(query)))
    .sort((a, b) => sActive(b.status) - sActive(a.status) || (b.status === "new") - (a.status === "new") || (b.num || 0) - (a.num || 0));

  let body;
  if (!loaded) body = <Empty title="Loading suggestions…" />;
  else if (!suggs.length) body = <Empty img={IMG.thinking} title="No suggestions yet">Log what testers say about the UI, the roasts and missing features with Add suggestion.</Empty>;
  else if (!rows.length) body = <Empty img={IMG.chill} title="Nothing matches">Pick All, switch to All statuses or clear the search.</Empty>;
  else body = rows.map((s) => <SuggRow key={s.id} s={s} onOpen={onOpen} />);

  return (
    <section className="view" role="tabpanel" aria-label="Suggestions">
      <div className="filters">
        <div className="field search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas, roast lines, tester" aria-label="Search suggestions" />
        </div>
        <div className="field"><Select value={status} onChange={setStatus} aria-label="Status" options={[["active", "Not done yet"], ["all", "All statuses"]]} /></div>
        <div className="field"><Select value={roaster} onChange={setRoaster} aria-label="Roaster" options={[["", "Any roaster"], ...ROASTER.slice(1)]} /></div>
        <div className="field wide"><Select value={screen} onChange={setScreen} aria-label="Screen" options={[["", "All screens"], ...SCREENS.map((s) => [s[0], screenLbl(s[0])])]} /></div>
      </div>
      <div className="filterbar">
        <Chips label="Suggestion type" value={kind} onChange={setKind}
          options={[["", "All", active.length], ...KINDS.map((k) => [k[0], k[1], active.filter((s) => s.kind === k[0]).length])]} />
        <small className="muted">{loaded ? `${rows.length} ${rows.length === 1 ? "suggestion" : "suggestions"}` : ""}</small>
      </div>
      <div className="list">{body}</div>
    </section>
  );
}

function SuggRow({ s, onOpen }) {
  const c = col(KINDS, s.kind);
  const open = () => onOpen("sugg", s.id);
  return (
    <div className={`row${sActive(s.status) ? "" : " closed"}`} tabIndex={0} role="button" aria-label={`${sid(s.num)}: ${s.title || s.roastLine}`}
      onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <span className="stripe" style={{ background: c }} />
      <span className="id">{sid(s.num)}</span>
      <div className="t">
        <strong>{s.title || "Roast line"}</strong>
        {s.kind === "roast" && s.roastLine && <div className="quote"><Line text={s.roastLine} /></div>}
        <div className="meta">
          <span className="kind" style={{ color: c }}><Icon name={s.kind === "roast" ? "flame" : "bulb"} />{lbl(KINDS, s.kind)}</span>
          {s.intensity && <span>{lbl(INTENSITY, s.intensity)}</span>}
          {s.screen && <span><Icon name="screen" />{screenLbl(s.screen)}</span>}
          {s.roaster && <span><Icon name="mask" />{lbl(ROASTER, s.roaster)}</span>}
          {s.roastId && <span><Icon name="flame" />for {s.roastId}</span>}
          {s.suggestedBy && <span><Icon name="user" />{s.suggestedBy}</span>}
          {s.files > 0 && <span title="Screenshots"><Icon name="clip" />{s.files}</span>}
        </div>
      </div>
      <span className="age">{ago(s.createdAt)}</span>
      <Pill cls={`st-${s.status}`}>{lbl(SSTATUS, s.status)}</Pill>
    </div>
  );
}

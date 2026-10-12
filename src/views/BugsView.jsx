import { ROASTER, SCREENS, SEV, STATUS } from "../lib/constants";
import { ago, bid, col, isOpen, lbl, screenLbl, sevRank } from "../lib/format";
import { IMG } from "../lib/images";
import { useLocalState } from "../lib/useLocalState";
import Icon from "../components/Icon";
import { Chips, Empty, Pill, Select } from "../components/bits";

export default function BugsView({ bugs, loaded, onOpen }) {
  const [q, setQ] = useLocalState("elb.bugs.q", "");
  const [status, setStatus] = useLocalState("elb.bugs.status", "open");
  const [sev, setSev] = useLocalState("elb.bugs.sev", "");
  const [screen, setScreen] = useLocalState("elb.bugs.screen", "");
  const [sort, setSort] = useLocalState("elb.bugs.sort", "severity");

  const query = q.trim().toLowerCase();
  const rows = bugs.filter((b) =>
    (status === "all" || isOpen(b.status)) && (!sev || b.severity === sev) && (!screen || b.screen === screen) &&
    (!query || [b.title, b.steps, b.device, b.expected, b.notes, b.reporter, b.build, bid(b.num)].join(" ").toLowerCase().includes(query)));
  const newest = (a, b) => (b.num || 0) - (a.num || 0);
  const screenIdx = (v) => SCREENS.findIndex((s) => s[0] === v);
  if (sort === "newest") rows.sort(newest);
  else if (sort === "screen") rows.sort((a, b) => screenIdx(a.screen) - screenIdx(b.screen) || sevRank[a.severity] - sevRank[b.severity] || newest(a, b));
  else rows.sort((a, b) => isOpen(b.status) - isOpen(a.status) || sevRank[a.severity] - sevRank[b.severity] || newest(a, b));

  let body;
  if (!loaded) body = <Empty title="Loading bugs…" />;
  else if (!bugs.length) body = <Empty img={IMG.binoc} title="No bugs yet">When a tester hits something, add it with Report a bug. Crashes always sort to the top.</Empty>;
  else if (!rows.length) body = <Empty img={IMG.chill} title="Nothing matches">Switch to All statuses or clear the search.</Empty>;
  else body = rows.map((b) => <BugRow key={b.id} b={b} onOpen={onOpen} />);

  return (
    <section className="view" role="tabpanel" aria-label="Bugs">
      <div className="filters">
        <div className="field search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, steps, device, tester" aria-label="Search bugs" />
        </div>
        <div className="field"><Select value={status} onChange={setStatus} aria-label="Status" options={[["open", "Open bugs"], ["all", "All statuses"]]} /></div>
        <div className="field"><Select value={sev} onChange={setSev} aria-label="Severity" options={[["", "All severities"], ...SEV.map((s) => [s[0], s[1]])]} /></div>
        <div className="field wide"><Select value={screen} onChange={setScreen} aria-label="Screen" options={[["", "All screens"], ...SCREENS.map((s) => [s[0], screenLbl(s[0])])]} /></div>
      </div>
      <div className="filterbar">
        <Chips label="Sort bugs" value={sort} onChange={setSort} options={[["severity", "By severity"], ["newest", "Newest"], ["screen", "By screen"]]} />
        <small className="muted">{loaded ? `${rows.length} ${rows.length === 1 ? "bug" : "bugs"}` : ""}</small>
      </div>
      <div className="list">{body}</div>
    </section>
  );
}

function BugRow({ b, onOpen }) {
  const c = col(SEV, b.severity);
  const open = () => onOpen("bug", b.id);
  return (
    <div className={`row bug${isOpen(b.status) ? "" : " closed"}`} tabIndex={0} role="button" aria-label={`${bid(b.num)}: ${b.title}`}
      onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <span className="stripe" style={{ background: c }} />
      <span className="id">{bid(b.num)}</span>
      <div className="t">
        <strong>{b.title}</strong>
        <div className="meta">
          <span className="sev" style={{ color: c }}><i style={{ background: c }} />{lbl(SEV, b.severity)}</span>
          <span><Icon name="screen" />{screenLbl(b.screen)}</span>
          {b.roaster && <span><Icon name="mask" />{lbl(ROASTER, b.roaster)}</span>}
          {b.device && <span><Icon name="phone" />{b.device}</span>}
          {b.reporter && <span><Icon name="user" />{b.reporter}</span>}
          {b.files > 0 && <span title="Screenshots"><Icon name="clip" />{b.files}</span>}
        </div>
      </div>
      <span className="age">{ago(b.createdAt)}</span>
      <Pill cls={`st-${b.status}`}>{lbl(STATUS, b.status)}</Pill>
    </div>
  );
}

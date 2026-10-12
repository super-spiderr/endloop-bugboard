import { KINDS, REVIEW, ROASTER, SCREENS, SEV, SSTATUS, STATUS } from "../lib/constants";
import { DAY, ago, catLbl, col, dayKey, isOpen, lbl, reviewOf, sActive } from "../lib/format";
import { IMG } from "../lib/images";
import { HBar, Legend, StackBar } from "../components/charts";

function Kpi({ label, dot, value, foot, hot }) {
  return (
    <div className={`kpi${hot ? " hot" : ""}`}>
      <div className="lab">
        <span className="dot" style={{ background: dot }} />
        {label}
      </div>
      <div className="num">{value}</div>
      <div className="foot">{foot}</div>
    </div>
  );
}

function Health({ bugs }) {
  const open = bugs.filter((b) => isOpen(b.status));
  const crashes = open.filter((b) => b.severity === "crash").length;
  const major = open.filter((b) => b.severity === "major").length;
  let cls = "health", img = IMG.binoc, title, text;
  if (!bugs.length) {
    title = "No bugs logged yet";
    text = "Loop is watching. Log the first one from your testers with Report a bug.";
  } else if (crashes) {
    cls = "health bad";
    img = IMG.fuming;
    title = crashes === 1 ? "1 crash is blocking the next build" : `${crashes} crashes are blocking the next build`;
    text = `Fix ${crashes === 1 ? "it" : "them"} before you send testers a new build.` +
      (major ? ` ${major} major ${major === 1 ? "bug is" : "bugs are"} open too.` : "");
  } else if (open.length) {
    img = IMG.chill;
    title = "No open crashes. Good to ship.";
    text = `${open.length} open ${open.length === 1 ? "bug" : "bugs"} left` + (major ? `, ${major} of them major.` : ", none of them major.");
  } else {
    img = IMG.party;
    title = "Every bug is closed";
    text = "Nothing open on the board. Time for the next round of testing.";
  }
  return (
    <div className={cls}>
      <img src={img} alt="" />
      <div>
        <div className="eyebrow">Next build</div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Last14({ bugs }) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start.getTime() - (13 - i) * DAY);
    return { k: dayKey(d), d, r: 0, f: 0 };
  });
  const idx = Object.fromEntries(days.map((d, i) => [d.k, i]));
  bugs.forEach((b) => {
    if (b.createdAt && idx[dayKey(b.createdAt)] != null) days[idx[dayKey(b.createdAt)]].r++;
    if (b.status === "fixed" && b.closedAt && idx[dayKey(b.closedAt)] != null) days[idx[dayKey(b.closedAt)]].f++;
  });
  const max = Math.max(1, ...days.map((d) => Math.max(d.r, d.f)));
  return (
    <>
      <div className="cols" aria-label="Bugs reported and fixed per day">
        {days.map((d) => (
          <div key={d.k} className="col" title={`${d.d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}: ${d.r} reported, ${d.f} fixed`}>
            <span style={{ height: `${(d.r / max) * 100}%`, background: "var(--red)" }} />
            <span style={{ height: `${(d.f / max) * 100}%`, background: "var(--chill)" }} />
          </div>
        ))}
      </div>
      <div className="colx">
        {days.map((d, i) => (
          <span key={d.k}>{i === 13 ? "Today" : d.d.getDate()}</span>
        ))}
      </div>
    </>
  );
}

function Mini({ items, empty, stripe, right, onOpen }) {
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div className="mini">
      {items.map((x) => (
        <button key={x.id} type="button" onClick={() => onOpen(x)}>
          <span className="st" style={{ background: stripe(x) }} />
          <span className="tt">{x.title || x.roastLine}</span>
          <span className="age">{right(x)}</span>
        </button>
      ))}
    </div>
  );
}

export default function Dashboard({ bugs, suggs, roasts, onOpen, onGoto }) {
  const open = bugs.filter((b) => isOpen(b.status));
  const crashes = open.filter((b) => b.severity === "crash");
  const weekAgo = Date.now() - 7 * DAY;
  const inWeek = (iso) => iso && new Date(iso) > weekAgo;

  const sevRows = SEV.map((s) => [s[1], s[2], open.filter((b) => b.severity === s[0]).length]);
  const stRows = STATUS.map((s) => [s[1], s[2], bugs.filter((b) => b.status === s[0]).length]);

  const byScreen = SCREENS.map((s) => ({ s, list: open.filter((b) => b.screen === s[0]) }))
    .filter((x) => x.list.length)
    .sort((a, b) => b.list.length - a.list.length)
    .slice(0, 8);
  const maxS = Math.max(1, ...byScreen.map((x) => x.list.length));

  const rRows = ROASTER.map((r) => [r[1], open.filter((b) => (b.roaster || "") === r[0]).length]);
  const maxR = Math.max(1, ...rRows.map((r) => r[1]));

  const oldest = [...open].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).slice(0, 5);

  const act = suggs.filter((s) => sActive(s.status));
  const kRows = KINDS.map((k) => [k[1], k[2], act.filter((s) => s.kind === k[0]).length]);
  const ssRows = SSTATUS.map((s) => [s[1], s[2], suggs.filter((x) => x.status === s[0]).length]);
  const latest = [...suggs].sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 5);

  const orig = roasts.filter((r) => r.source !== "new");
  const reviewed = orig.filter((r) => reviewOf(r) !== "unreviewed").length;
  const rvRows = REVIEW.map((v) => [v[1], v[2], roasts.filter((r) => reviewOf(r) === v[0]).length]);
  const moments = [...new Set(orig.map((r) => r.category))]
    .map((c) => {
      const l = orig.filter((r) => r.category === c);
      return { c, n: l.length, d: l.filter((r) => reviewOf(r) !== "unreviewed").length };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);

  return (
    <section className="view" role="tabpanel" aria-label="Dashboard">
      <div className="kpis">
        <Kpi label="Open bugs" dot="var(--ink)" value={open.length} foot={`${bugs.filter((b) => inWeek(b.createdAt)).length} reported this week`} />
        <Kpi label="Open crashes" dot="var(--red)" value={crashes.length} foot={crashes.length ? "blocking the next build" : "none open"} hot={crashes.length > 0} />
        <Kpi label="Fixed" dot="var(--chill)" value={bugs.filter((b) => b.status === "fixed").length}
          foot={`${bugs.filter((b) => b.status === "fixed" && inWeek(b.closedAt)).length} fixed this week`} />
        <Kpi label="New suggestions" dot="var(--violet)" value={suggs.filter((s) => s.status === "new").length}
          foot={`${suggs.filter((s) => s.kind === "roast" && sActive(s.status)).length} roast ideas open`} />
      </div>

      <Health bugs={bugs} />

      <div className="grid2">
        <div className="card">
          <div className="hd"><h2 className="sec">Open bugs by severity</h2><small>{open.length} open</small></div>
          <StackBar rows={sevRows} total={open.length} />
          <Legend rows={sevRows.map(([n, c, v]) => [n, c, v])} />
        </div>
        <div className="card">
          <div className="hd"><h2 className="sec">All bugs by status</h2><small>{bugs.length} total</small></div>
          <StackBar rows={stRows} total={bugs.length} />
          <Legend rows={stRows} />
        </div>
        <div className="card">
          <div className="hd"><h2 className="sec">Open bugs by screen</h2><small>top 8</small></div>
          <div className="hbars">
            {byScreen.length ? byScreen.map(({ s, list }) => (
              <HBar key={s[0]} prefix={s[0].startsWith("S") ? s[0] : null} label={s[1]} value={list.length} max={maxS}
                segments={SEV.map((v) => [v[2], list.filter((b) => b.severity === v[0]).length]).filter((x) => x[1])} />
            )) : <p className="muted" style={{ margin: 0 }}>No open bugs on any screen.</p>}
          </div>
        </div>
        <div className="card">
          <div className="hd">
            <h2 className="sec">Last 14 days</h2>
            <Legend inline rows={[["Bugs reported", "var(--red)"], ["Fixed", "var(--chill)"]]} />
          </div>
          <Last14 bugs={bugs} />
        </div>
        <div className="card">
          <div className="hd"><h2 className="sec">Open bugs by roaster</h2></div>
          <div className="hbars">
            {rRows.map(([n, v]) => <HBar key={n} label={n} value={v} max={maxR} />)}
          </div>
        </div>
        <div className="card">
          <div className="hd"><h2 className="sec">Waiting longest</h2><small>open bugs, oldest first</small></div>
          <Mini items={oldest} empty="Nothing waiting." stripe={(b) => col(SEV, b.severity)} right={(b) => ago(b.createdAt)} onOpen={(b) => onOpen("bug", b.id)} />
        </div>

        <div className="card wide">
          <div className="hd">
            <h2 className="sec">Suggestions from testers</h2>
            <button type="button" className="linkbtn" onClick={() => onGoto("sugg")}>See all suggestions</button>
          </div>
          <div className="split">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <StackBar rows={kRows} total={act.length} />
              <Legend rows={kRows} />
              <StackBar rows={ssRows} total={suggs.length} />
              <Legend rows={ssRows} />
            </div>
            <Mini items={latest} empty="No suggestions yet. Testers' ideas for the UI and the roasts go here."
              stripe={(s) => col(KINDS, s.kind)} right={(s) => lbl(SSTATUS, s.status)} onOpen={(s) => onOpen("sugg", s.id)} />
          </div>
        </div>

        <div className="card wide">
          <div className="hd">
            <h2 className="sec">Roast review</h2>
            <button type="button" className="linkbtn" onClick={() => onGoto("roast")}>Review roasts</button>
          </div>
          <div className="split">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="bignum">{reviewed}</span>
                <span className="muted">of {orig.length} current lines reviewed</span>
              </div>
              <StackBar rows={rvRows.filter((r) => r[0] !== "Not reviewed")} total={roasts.length} />
              <Legend rows={rvRows} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <small className="muted">Reviewed, by moment</small>
              <div className="hbars">
                {moments.map((x) => (
                  <HBar key={x.c} label={catLbl(x.c)} value={x.d} max={x.n} color="var(--chill)" valueLabel={`${x.d}/${x.n}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

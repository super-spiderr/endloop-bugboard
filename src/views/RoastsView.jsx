import { useEffect, useState } from "react";
import { INTENSITY, LANGS, REVIEW, ROASTER } from "../lib/constants";
import { catLbl, col, lbl, reviewOf } from "../lib/format";
import { IMG } from "../lib/images";
import { useLocalState } from "../lib/useLocalState";
import Icon from "../components/Icon";
import { Chips, Empty, Line, Pill, Select } from "../components/bits";

const PAGE = 60;

export default function RoastsView({ roasts, loaded, onOpen }) {
  const [q, setQ] = useLocalState("elb.roast.q", "");
  const [lang, setLang] = useLocalState("elb.roast.lang", "en");
  const [intensity, setIntensity] = useLocalState("elb.roast.int", "");
  const [cat, setCat] = useLocalState("elb.roast.cat", "");
  const [review, setReview] = useLocalState("elb.roast.review", "");
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q, lang, intensity, cat, review]);

  const base = roasts.filter((r) => !lang || r.lang === lang);
  const cats = [...new Set(roasts.map((r) => r.category))].sort((a, b) => catLbl(a).localeCompare(catLbl(b)));
  const query = q.trim().toLowerCase();
  const rows = base.filter((r) =>
    (!review || reviewOf(r) === review) &&
    (!intensity || (intensity === "any" ? !r.intensity : r.intensity === intensity)) &&
    (!cat || r.category === cat) &&
    (!query || [r.id, r.text, r.proposed, r.notes, r.reviewedBy].join(" ").toLowerCase().includes(query)));

  let body;
  if (!loaded) body = <Empty title="Loading roasts…" />;
  else if (!roasts.length) body = <Empty img={IMG.binoc} title="No roast lines loaded">Run supabase/seed.sql to load the lines from the app.</Empty>;
  else if (!rows.length) body = <Empty img={IMG.chill} title="Nothing matches">Pick All or clear the search.</Empty>;
  else body = (
    <>
      {rows.slice(0, limit).map((r) => <RoastRow key={r.id} r={r} showLang={!lang} onOpen={onOpen} />)}
      {rows.length > limit && (
        <div className="more">
          <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
          </button>
        </div>
      )}
    </>
  );

  return (
    <section className="view" role="tabpanel" aria-label="Roasts">
      <div className="filters">
        <div className="field search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lines, IDs, notes" aria-label="Search roasts" />
        </div>
        <div className="field"><Select value={lang} onChange={setLang} aria-label="Language" options={[...LANGS, ["", "Both languages"]]} /></div>
        <div className="field"><Select value={intensity} onChange={setIntensity} aria-label="Intensity"
          options={[["", "Any intensity"], ...INTENSITY.slice(1), ["any", "Any-level lines"]]} /></div>
        <div className="field wide"><Select value={cat} onChange={setCat} aria-label="Moment"
          options={[["", "All moments"], ...cats.map((c) => [c, `${catLbl(c)} (${base.filter((r) => r.category === c).length})`])]} /></div>
      </div>
      <div className="filterbar">
        <Chips label="Review state" value={review} onChange={setReview}
          options={[["", "All", base.length], ...REVIEW.map((v) => [v[0], v[1], base.filter((r) => reviewOf(r) === v[0]).length])]} />
        <small className="muted">{loaded ? `${rows.length} ${rows.length === 1 ? "line" : "lines"}` : ""}</small>
      </div>
      <div className="list">{body}</div>
    </section>
  );
}

function RoastRow({ r, showLang, onOpen }) {
  const v = reviewOf(r);
  const changed = v === "change" && r.proposed;
  const open = () => onOpen("roast", r.id);
  return (
    <div className="row roast" tabIndex={0} role="button" aria-label={r.id}
      onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <span className="stripe" style={{ background: col(REVIEW, v) }} />
      <span className="id" style={{ fontSize: ".74rem" }}>{r.id.replace(/^(en|ta)_/, "")}</span>
      <div className="t">
        <div className={`line${changed || v === "remove" ? " old" : ""}`}><Line text={r.text || r.proposed} /></div>
        {changed && <div className="new"><Line text={r.proposed} /></div>}
        <div className="meta">
          <span className="kind" style={{ color: "var(--red)" }}><Icon name="flame" />{catLbl(r.category)}</span>
          <span>{r.intensity ? lbl(INTENSITY, r.intensity) : "Any level"}</span>
          {r.roaster && <span><Icon name="mask" />{lbl(ROASTER, r.roaster)} only</span>}
          {r.kinds && r.kinds.length > 0 && <span><Icon name="phone" />{r.kinds.join(", ")}</span>}
          {showLang && <span>{lbl(LANGS, r.lang)}</span>}
          {r.notes && <span><Icon name="user" />has notes</span>}
        </div>
      </div>
      <span className="age" />
      <Pill cls={`rv-${v}`}>{lbl(REVIEW, v)}</Pill>
    </div>
  );
}

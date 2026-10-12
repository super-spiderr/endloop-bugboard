import wordmark from "../assets/wordmark.svg";

const base = import.meta.env.BASE_URL;

/** App icon + Endloop wordmark. */
export function Brand({ tag }) {
  return (
    <div className="brand">
      <img className="appicon" src={`${base}favicon.svg`} alt="" />
      <img className="wm" src={wordmark} alt="Endloop" />
      {tag && <span className="tag">{tag}</span>}
    </div>
  );
}

/** A roast line with its {placeholders} shown as small tags. */
export function Line({ text, className }) {
  const parts = String(text || "").split(/(\{\w+\})/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        const m = p.match(/^\{(\w+)\}$/);
        return m ? (
          <span key={i} className="ph">
            {m[1]}
          </span>
        ) : (
          p
        );
      })}
    </span>
  );
}

export function Pill({ cls, children }) {
  return (
    <span className={`pill ${cls}`}>
      <i />
      {children}
    </span>
  );
}

export function Empty({ img, title, children }) {
  return (
    <div className="empty">
      {img && <img src={img} alt="" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Native select whose options are [value, label] pairs. */
export function Select({ value, onChange, options, ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Pill-style toggle group; options are [value, label, count?]. */
export function Chips({ value, onChange, options, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([v, l, n]) => (
        <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
          {n !== undefined && <span className="n">{n}</span>}
        </button>
      ))}
    </div>
  );
}

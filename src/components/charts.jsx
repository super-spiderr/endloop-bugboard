// Small CSS-drawn charts. Rows are [label, colour, value].

export function StackBar({ rows, total }) {
  return (
    <div className="stackbar">
      {total > 0 &&
        rows
          .filter((r) => r[2])
          .map(([n, c, v]) => <span key={n} style={{ width: `${(v / total) * 100}%`, background: c }} title={`${n}: ${v}`} />)}
    </div>
  );
}

export function Legend({ rows, inline }) {
  return (
    <div className="legend" style={inline ? { display: "flex", gap: 14 } : undefined}>
      {rows.map(([n, c, v]) => (
        <div key={n}>
          <i style={{ background: c }} />
          {n}
          {v !== undefined && <b>{v}</b>}
        </div>
      ))}
    </div>
  );
}

/** Horizontal bar: label, track filled to value/max, and the value on the right. */
export function HBar({ label, prefix, value, max, segments, color = "var(--red)", valueLabel }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="hbar">
      <span className="nm">
        {prefix && <em>{prefix}</em>}
        {label}
      </span>
      <span className="tr">
        {segments ? (
          <span style={{ display: "flex", height: "100%", width: `${pct}%` }}>
            {segments.map(([c, n], i) => (
              <span key={i} style={{ width: `${(n / value) * 100}%`, background: c }} />
            ))}
          </span>
        ) : (
          <span style={{ width: `${pct}%`, background: color }} />
        )}
      </span>
      <b style={valueLabel ? { width: "auto", whiteSpace: "nowrap" } : undefined}>{valueLabel ?? value}</b>
    </div>
  );
}

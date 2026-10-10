import React from 'react';

/**
 * Small dependency-free SVG charts, ported near-verbatim from speed-listing's
 * charts.tsx — pure SVG math, no CSS-variable dependency in the geometry itself.
 * Palette validated with the dataviz six-checks validator on a white surface:
 *  - sentiment (diverging: pole / neutral gray midpoint / pole): #0ca30c #898781 #d03b3b
 *  - demographics (categorical slots 1-2): #2a78d6 #eb6834
 * Identity is never color-alone: every chart ships a visible legend with values.
 */

const SENTIMENT_COLORS = { positive: '#0ca30c', neutral: '#898781', critical: '#d03b3b' };
const SERIES = { male: '#2a78d6', female: '#eb6834' };

export function SentimentDonut({ positive, neutral, critical }) {
  const total = positive + neutral + critical;
  if (total === 0) return <p className="text-slate-500">No review data.</p>;
  const R = 60;
  const C = 2 * Math.PI * R;
  const segs = [
    { label: 'Positive (4-5★)', value: positive, color: SENTIMENT_COLORS.positive },
    { label: 'Neutral (3★)', value: neutral, color: SENTIMENT_COLORS.neutral },
    { label: 'Critical (1-2★)', value: critical, color: SENTIMENT_COLORS.critical },
  ].filter((s) => s.value > 0);

  let offset = 0;
  const arcs = segs.map((s) => {
    const frac = s.value / total;
    const arc = (
      <circle
        key={s.label}
        r={R}
        cx={80}
        cy={80}
        fill="none"
        stroke={s.color}
        strokeWidth={22}
        strokeDasharray={`${Math.max(frac * C - 2, 0.5)} ${C}`}
        strokeDashoffset={-offset * C}
        transform="rotate(-90 80 80)"
      >
        <title>{`${s.label}: ${s.value} (${Math.round(frac * 100)}%)`}</title>
      </circle>
    );
    offset += frac;
    return arc;
  });

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="h-[200px] w-full flex items-center justify-center">
        <svg viewBox="0 0 160 160" width={170} height={170} role="img" aria-label="Sentiment distribution">
          {arcs}
          <text x={80} y={75} textAnchor="middle" className="fill-slate-900" style={{ font: '700 24px/1 -apple-system, "Segoe UI", Roboto, sans-serif' }}>
            {Math.round((positive / total) * 100)}%
          </text>
          <text x={80} y={94} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>
            positive
          </text>
        </svg>
      </div>
      <div className="flex gap-3.5 flex-wrap justify-center text-xs text-slate-500">
        {segs.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label} — {s.value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DemographicsBars({ brackets }) {
  if (brackets.length === 0) return <p className="text-slate-500">No demographic estimate.</p>;
  const W = 380;
  const H = 190;
  const PAD = { left: 26, bottom: 22, top: 8 };
  const plotW = W - PAD.left - 6;
  const plotH = H - PAD.bottom - PAD.top;
  const max = Math.max(1, ...brackets.flatMap((b) => [b.male, b.female]));
  const group = plotW / brackets.length;
  const barW = Math.min(22, group / 3);
  const y = (v) => PAD.top + plotH * (1 - v / max);
  const ticks = [0, Math.ceil(max / 2), max];

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="h-[200px] w-full flex items-center">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} role="img" aria-label="Estimated reviewer demographics">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - 6} y1={y(t)} y2={y(t)} stroke="#e1e0d9" strokeWidth={1} />
              <text x={PAD.left - 5} y={y(t) + 3.5} textAnchor="end" className="fill-slate-500" style={{ fontSize: 10 }}>
                {t}
              </text>
            </g>
          ))}
          {brackets.map((b, i) => {
            const cx = PAD.left + group * i + group / 2;
            return (
              <g key={b.label}>
                <rect x={cx - barW - 1} y={y(b.male)} width={barW} height={Math.max(plotH + PAD.top - y(b.male), 0)} rx={2} fill={SERIES.male}>
                  <title>{`${b.label} male: ${b.male}`}</title>
                </rect>
                <rect x={cx + 1} y={y(b.female)} width={barW} height={Math.max(plotH + PAD.top - y(b.female), 0)} rx={2} fill={SERIES.female}>
                  <title>{`${b.label} female: ${b.female}`}</title>
                </rect>
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
                  {b.label}
                </text>
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - 6} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#c3c2b7" strokeWidth={1} />
        </svg>
      </div>
      <div className="flex gap-3.5 flex-wrap justify-center w-full text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.male }} /> Male
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES.female }} /> Female
        </span>
      </div>
    </div>
  );
}

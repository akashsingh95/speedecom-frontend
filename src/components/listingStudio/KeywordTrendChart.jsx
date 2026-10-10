import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatNumber = (v) => Number(v).toLocaleString('en-US');

// Our history is one point per month, so a range is the last N points.
const RANGES = [
  { key: '1y', label: '1 Year', months: 12 },
  { key: '3y', label: '3 Years', months: 36 },
  { key: '5y', label: '5 Years', months: 60 },
];

/** The range buttons + line chart for one keyword's monthly points. Exported on its own so a
 *  single-keyword modal (opened from a row's trend icon) can show it without the card below. */
export function TrendChart({ points }) {
  const [range, setRange] = useState('1y');
  const selectedRange = RANGES.find((r) => r.key === range);
  const visible = selectedRange?.months ? points.slice(-selectedRange.months) : points;
  const data = visible.map((p) => ({
    label: `${MONTHS[p.month - 1]} ${String(p.year).slice(2)}`,
    volume: p.searchVolume,
  }));

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGES.map((r) => {
          const active = range === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition ${
                active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatNumber} width={70} />
            <Tooltip formatter={formatNumber} />
            <Line type="monotone" dataKey="volume" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-500 mt-2">Monthly searches on Google and Bing, not Amazon.</p>
    </>
  );
}

/** Card version: a keyword dropdown above the chart. `trends` is keyed by keyword, each value an
 *  oldest-first list of { year, month, searchVolume }. */
export default function KeywordTrendChart({ keywords, trends }) {
  const available = keywords.filter((k) => trends[k.keyword]?.length > 0);
  const [picked, setPicked] = useState(available[0]?.keyword);
  if (available.length === 0) return null;

  const current = trends[picked] ? picked : available[0].keyword;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold text-slate-900">Search trend</h2>
        <select
          value={current}
          onChange={(e) => setPicked(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 bg-white"
        >
          {available.map((k) => (
            <option key={k.keyword} value={k.keyword}>
              {k.keyword}
            </option>
          ))}
        </select>
      </div>
      <TrendChart points={trends[current]} />
    </div>
  );
}
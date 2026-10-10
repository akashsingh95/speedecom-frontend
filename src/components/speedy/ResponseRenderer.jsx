import React from 'react';
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ReferenceLine, ReferenceDot, ComposedChart, Line, LabelList,
} from 'recharts';
import { ChevronRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

// Accordion expand/collapse indicator.
//   closed → FILLED disc + white chevron, pointing right
//   open   → OUTLINE disc + brand chevron, rotated 90° (pointing down)
// Colour is brand blue and adapts to light/dark; the rotation + fill/outline
// swap are animated together.
const AccordionIcon = ({ open }) => (
    <span
        className={`inline-flex items-center justify-center w-[15px] h-[15px] rounded-full shrink-0
            border transition-all duration-300 ease-out
            ${open
                ? 'rotate-90 bg-transparent border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'bg-blue-600 dark:bg-blue-500 border-transparent text-white'}`}
    >
        <ChevronRight size={11} strokeWidth={2.75} />
    </span>
);

// ─── Brand palette ────────────────────────────────────────
const COLORS = [
    '#7c3aed', '#6366f1', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6',
];

// ─── Helpers ──────────────────────────────────────────────
const isNumeric = (v) => v !== null && v !== undefined && !isNaN(Number(v));

const fmt = (v) => {
    if (v === null || v === undefined) return '—';
    if (isNumeric(v)) {
        const n = Number(v);
        if (Number.isInteger(n)) return n.toLocaleString('en-IN');
        return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(v);
};

const isNegative = (v) => isNumeric(v) && Number(v) < 0;

// Compact axis formatter — uses ₹ prefix for currency columns
const fmtAxisTick = (v, isCurrency) => {
    const n = Number(v);
    if (isNaN(n)) return v;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const prefix = isCurrency ? '₹' : '';
    if (abs >= 10_000_000) return `${sign}${prefix}${(abs / 10_000_000).toFixed(1)}Cr`;
    if (abs >= 100_000)    return `${sign}${prefix}${(abs / 100_000).toFixed(1)}L`;
    if (abs >= 1_000)      return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`;
    return `${sign}${prefix}${abs.toLocaleString('en-IN')}`;
};

// ─── Column type detection ─────────────────────────────────
const isPctColumn = (h) => {
    const l = h.toLowerCase();
    return (
        l.endsWith('_pct')        ||
        l.endsWith('_pct_change') ||
        l.endsWith('_percent')    ||
        l.endsWith('_rate')       ||
        l.endsWith('_margin')     ||
        l.endsWith('_ratio')      ||
        l.includes('_pct_')       ||
        l.includes('_percent_')   ||
        l === 'roas'              ||
        l === 'roi'               ||
        l === 'margin'
    );
};

const isCurrencyColumn = (h) => {
    const l = h.toLowerCase();
    // Quantity/count columns are never currency, even if the rest of the name
    // contains words like "loss" (e.g. refund_loss_qty is an integer count).
    if (l.endsWith('_qty') || l.endsWith('_quantity') || l.endsWith('_count') || l.endsWith('_orders')) {
        return false;
    }
    return (
        l.includes('sales')       || l.includes('revenue')    || l.includes('profit') ||
        l.includes('loss')        || l.includes('cost')       || l.includes('settlement') ||
        l.includes('payment')     || l.includes('amount')     || l.includes('fee') ||
        l.includes('claim')       || l.includes('ads')        || l.includes('spend') ||
        l.includes('earning')     || l.includes('income')     || l.includes('price') ||
        l === 'mp_fee_settlement' || l === 'orders_settlement'|| l === 'total_cost' ||
        l === 'product_cost'      || l === 'sku_wise_ads'     || l === 'investment' ||
        l === 'profit_loss'       || l === 'net_sales'        || l === 'gross_sales' ||
        l === 'value'
    ) && !isPctColumn(h);
};

// Identifier columns (SKU, order IDs, etc.) hold codes that may look numeric
// but must never be reformatted with commas or treated as currency/numbers.
const isIdentifierColumn = (h) => {
    const l = h.toLowerCase();
    return (
        l === 'sku'      || l === 'id'       || l === 'key'      || l === 'code' ||
        l === 'account'  || l === 'marketplace_id' ||
        l.endsWith('_id') || l.endsWith('_sku') || l.endsWith('_code') || l.endsWith('_key')
    );
};

// Date columns — render as "02 Mar 2026" instead of raw ISO timestamps.
const isDateColumn = (h) => /date|^day$|_day$/i.test(h);

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Format any parseable date string as "dd MMM yyyy" in UTC. Using UTC keeps
// the displayed date identical to what's stored — IST conversion can shift
// midnight-UTC timestamps onto the wrong calendar day.
const fmtDateCell = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${dd} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// Detect time-series xKey (month/date/week/etc.)
const isTimeSeriesKey = (key) =>
    /month|date|week|day|period|quarter|year/i.test(key);

const fmtHeader = (h) =>
    h.replace(/_pct_change$/, ' % change')
     .replace(/_pct$/, ' %')
     .replace(/_percent$/, ' %')
     .replace(/_margin$/, ' margin %')
     .replace(/_rate$/, ' rate %')
     .replace(/_ratio$/, ' ratio')
     .replace(/_/g, ' ');

const fmtCell = (h, v) => {
    if (v === null || v === undefined) return '—';
    // Identifier columns render raw — never number-formatted (commas would
    // mangle long numeric SKUs / order IDs).
    if (isIdentifierColumn(h)) return String(v);
    if (isDateColumn(h)) return fmtDateCell(v);
    if (isPctColumn(h) && isNumeric(v)) {
        if (h === 'roas') return fmt(v);
        // A change column shows its direction: "+2.5%" (rose) vs "-2.46%" (fell).
        // Negatives already carry "-"; only positives need the explicit "+".
        const sign = h.toLowerCase().endsWith('_pct_change') && Number(v) > 0 ? '+' : '';
        return `${sign}${fmt(v)}%`;
    }
    if (isCurrencyColumn(h) && isNumeric(v)) return `₹${fmt(v)}`;
    return fmt(v);
};

// Cell text colour. For "_pct_change" columns the sign is MEANINGFUL — these are
// return/RTO deltas (recent − previous) where a DECREASE is the improvement.
// So NEGATIVE = returns/RTO fell = good = GREEN, and POSITIVE = they rose = bad
// = RED (e.g. a rising return rate shows as +2.4% in red). Every other numeric
// column just flags negatives red, as before.
const cellColorClass = (h, v) => {
    if (isIdentifierColumn(h) || !isNumeric(v)) return 'text-gray-700 dark:text-gray-300';
    const n = Number(v);
    if (h.toLowerCase().endsWith('_pct_change')) {
        if (n < 0) return 'text-emerald-600 dark:text-emerald-400 font-medium';
        if (n > 0) return 'text-red-500 dark:text-red-400 font-medium';
        return 'text-gray-700 dark:text-gray-300';
    }
    return n < 0 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300';
};

// ─── Custom Tooltip ───────────────────────────────────────
const SpeedyTooltip = ({ active, payload, label, showPercent = false }) => {
    if (!active || !payload?.length) return null;
    // When the chart is stacked, sum all segments to compute each segment's
    // share of the bar. The total is shown as an extra footer row.
    const stackTotal = showPercent
        ? payload.reduce((s, e) => s + (Number(e.value) || 0), 0)
        : 0;
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-lg p-3 text-xs min-w-[150px] backdrop-blur-sm">
            {label !== undefined && (
                <div className="font-semibold text-gray-700 dark:text-gray-200 mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-800 text-[11px] uppercase tracking-wide">
                    {label}
                </div>
            )}
            {payload.map((entry, i) => {
                const name = entry.dataKey || entry.name || '';
                const val  = entry.value;
                const formatted = isPctColumn(name)
                    ? (name === 'roas' ? fmt(val) : `${fmt(val)}%`)
                    : isCurrencyColumn(name)
                        ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : Number(val).toLocaleString('en-IN');
                const pctSuffix = (showPercent && stackTotal > 0)
                    ? ` (${(Number(val) / stackTotal * 100).toFixed(1)}%)`
                    : '';
                return (
                    <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: entry.color || entry.fill }} />
                            <span className="text-gray-500 dark:text-gray-400 capitalize">{fmtHeader(name)}</span>
                        </div>
                        <span className={`font-semibold tabular-nums ${Number(val) < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                            {formatted}{pctSuffix}
                        </span>
                    </div>
                );
            })}
            {showPercent && stackTotal > 0 && (
                <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
                    <span className="text-gray-500 dark:text-gray-400">Total</span>
                    <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-100">
                        {Number(stackTotal).toLocaleString('en-IN')}
                    </span>
                </div>
            )}
        </div>
    );
};

// ─── DataTable ────────────────────────────────────────────
// Columns worth summing in a totals row: money and counts — never averages,
// percentages, ratios, "days pending", dates or identifiers (summing those is
// meaningless).
const isSummableColumn = (h) => {
    const l = h.toLowerCase();
    if (isIdentifierColumn(h) || isDateColumn(h) || isPctColumn(h)) return false;
    if (l.startsWith('avg') || l.includes('avg_') || l.includes('average') || l.includes('per_unit') || l.endsWith('_pending')) return false;
    if (isCurrencyColumn(h)) return true;
    return (
        l.endsWith('_qty') || l.endsWith('_quantity') || l.endsWith('_count') ||
        l.endsWith('_orders') || l.endsWith('_units') || l === 'orders' || l === 'qty' || l === 'units'
    );
};

const PAGE_SIZE = 100;

const DataTable = ({ data, showTotals = false }) => {
    const [page, setPage] = React.useState(1);
    const scrollRef = React.useRef(null);

    // Reset page whenever a new dataset arrives
    React.useEffect(() => { setPage(1); }, [data]);

    if (!data?.length) return null;
    const headers = Object.keys(data[0]);

    // Grand totals (over ALL rows, not just the current page) for summable cols.
    const summableCols = showTotals ? headers.filter(isSummableColumn) : [];
    const totals = {};
    summableCols.forEach(h => { totals[h] = data.reduce((s, r) => s + (Number(r[h]) || 0), 0); });

    const totalRows  = data.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const start      = (safePage - 1) * PAGE_SIZE;
    const end        = Math.min(start + PAGE_SIZE, totalRows);
    const pageRows   = totalRows > PAGE_SIZE ? data.slice(start, end) : data;
    const showPager  = totalPages > 1;

    // Sum of just the rows visible on the current page. Only meaningful when the
    // data is paginated — otherwise it equals the grand total.
    const pageTotals = {};
    if (showPager) summableCols.forEach(h => { pageTotals[h] = pageRows.reduce((s, r) => s + (Number(r[h]) || 0), 0); });

    const goTo = (p) => {
        const next = Math.max(1, Math.min(p, totalPages));
        setPage(next);
        // Snap table scroll back to top so user sees row 1 of the new page
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };

    return (
        <div className="flex flex-col max-h-[60vh] rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm relative overflow-hidden bg-white dark:bg-gray-900">
            <div ref={scrollRef} className="table-scrollbar overflow-auto flex-1">
                <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-gray-50 dark:bg-gray-800/80">
                        {headers.map((h) => (
                            <th
                                key={h}
                                className={`px-3 py-2.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 sticky top-0 ${!isIdentifierColumn(h) && isNumeric(data[0][h]) ? 'text-right' : 'text-left'}`}
                            >
                                {fmtHeader(h)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {pageRows.map((row, i) => (
                        <tr key={start + i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/60 dark:bg-gray-800/40'}>
                            {headers.map((h) => (
                                <td
                                    key={h}
                                    className={`
                                        px-3 py-2 border-b border-gray-100 dark:border-gray-700/40 whitespace-nowrap
                                        ${!isIdentifierColumn(h) && isNumeric(row[h]) ? 'text-right tabular-nums' : 'text-left'}
                                        ${cellColorClass(h, row[h])}
                                    `}
                                >
                                    {fmtCell(h, row[h])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
                {summableCols.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10">
                        {/* When paginated, show this-page subtotal above the grand total */}
                        {showPager && (
                            <tr className="bg-gray-50 dark:bg-gray-800/70 border-t border-gray-200 dark:border-gray-700">
                                {headers.map((h, idx) => (
                                    <td key={h}
                                        className={`px-3 py-2 font-semibold whitespace-nowrap
                                            ${summableCols.includes(h)
                                                ? 'text-right tabular-nums text-gray-700 dark:text-gray-300'
                                                : 'text-left text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-wide'}`}>
                                        {summableCols.includes(h) ? fmtCell(h, pageTotals[h]) : (idx === 0 ? 'Page total' : '')}
                                    </td>
                                ))}
                            </tr>
                        )}
                        <tr className="bg-gray-100 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                            {headers.map((h, idx) => (
                                <td key={h}
                                    className={`px-3 py-2.5 font-bold whitespace-nowrap border-t border-gray-300 dark:border-gray-600
                                        ${summableCols.includes(h)
                                            ? 'text-right tabular-nums text-gray-900 dark:text-gray-100'
                                            : 'text-left text-gray-500 dark:text-gray-400 uppercase text-[10px] tracking-wide'}`}>
                                    {summableCols.includes(h) ? fmtCell(h, totals[h]) : (idx === 0 ? (showPager ? 'Grand total' : 'Total') : '')}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                )}
            </table>
            </div>

            {/* Footer: row count (+ pagination when needed) */}
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/80 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 flex flex-none items-center justify-between gap-2 w-full">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500" />
                    {showPager
                        ? <>Rows <span className="text-gray-600 dark:text-gray-300 font-medium">{start + 1}–{end}</span> of <span className="text-gray-600 dark:text-gray-300 font-medium">{totalRows.toLocaleString('en-IN')}</span></>
                        : <>{totalRows} row{totalRows !== 1 ? 's' : ''}</>
                    }
                </span>

                {showPager && (
                    <span className="flex items-center gap-1">
                        <PagerBtn onClick={() => goTo(1)}            disabled={safePage === 1}           title="First">«</PagerBtn>
                        <PagerBtn onClick={() => goTo(safePage - 1)} disabled={safePage === 1}           title="Previous">‹</PagerBtn>
                        <span className="px-2 text-gray-600 dark:text-gray-300 font-medium tabular-nums">
                            {safePage} / {totalPages}
                        </span>
                        <PagerBtn onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}  title="Next">›</PagerBtn>
                        <PagerBtn onClick={() => goTo(totalPages)}   disabled={safePage === totalPages}  title="Last">»</PagerBtn>
                    </span>
                )}
            </div>
        </div>
    );
};

const PagerBtn = ({ onClick, disabled, title, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`w-6 h-6 flex items-center justify-center rounded-md text-sm leading-none transition-all
            ${disabled
                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200 active:scale-90'
            }`}
    >
        {children}
    </button>
);

// A tooltip for the P&L bar that also shows ad spend as a % of the total profit
// and how much is retained after ads. Full ₹ numbers (Indian grouping).
const PnlBarTooltip = ({ active, payload, label, colors = {} }) => {
    if (!active || !payload?.length) return null;
    const r = payload[0].payload;
    const without = Number(r.profit_without_ads) || 0;
    const withAds = Number(r.profit_with_ads) || 0;
    const adMag   = Math.abs(Number(r.ad_spend) || 0);   // ad_spend is plotted as magnitude
    const base    = Math.abs(without) || 0;
    const adPct    = base ? (adMag / base) * 100 : null;
    const finalPct = base ? (withAds / base) * 100 : null;
    const full = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const cWithout = colors.profit_without_ads || '#3b82f6';
    const cAds     = colors.ad_spend || '#ef4444';
    const cWith    = colors.profit_with_ads || '#10b981';

    const Row = ({ name, val, color, pct }) => (
        <div className="flex items-center justify-between gap-6 py-0.5">
            <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-gray-500 dark:text-gray-400">{name}</span>
            </span>
            <span className="font-semibold tabular-nums" style={{ color }}>
                {full(val)}{pct != null && <span className="opacity-70 font-normal"> · {pct.toFixed(1)}%</span>}
            </span>
        </div>
    );
    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-lg p-3 text-xs min-w-[240px]">
            <div className="font-semibold text-gray-700 dark:text-gray-200 mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-800">{label}</div>
            <Row name="Profit Without Ads" val={without} color={cWithout} />
            <Row name="Ad Spend"           val={-adMag}  color={cAds}     pct={adPct} />
            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            <Row name="Profit With Ads"    val={withAds} color={withAds >= 0 ? cWith : cAds} pct={finalPct} />
            {adPct != null && (
                <div className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                    Ads took {adPct.toFixed(1)}% of profit · you kept {finalPct.toFixed(1)}%
                </div>
            )}
        </div>
    );
};

// ─── Bar Chart ────────────────────────────────────────────
// highlightKey (optional): a series to annotate. When set, a zero baseline is
// drawn and the peak / trough of that series are marked, so "the important
// points" read at a glance without hunting through the bars.
// cellColors (optional): one colour per bar, used when a single-series chart
// wants each category coloured differently (e.g. a severity ramp).
const SpeedyBarChart = ({ data, xKey, valueKeys, stacked = false, highlightKey = null, colors = null, pnlPct = false, cellColors = null }) => {
    const perBar = Array.isArray(cellColors) && cellColors.length > 0 && valueKeys.length === 1;
    const hasCurrency = valueKeys.some(isCurrencyColumn);
    // For stacked bars only the top segment gets rounded corners.
    const lastIdx = valueKeys.length - 1;
    // Per-series colour: explicit map wins, else fall back to the palette.
    const colorFor = (k, idx) => (colors && colors[k]) || COLORS[idx % COLORS.length];

    // Locate the peak / trough of the highlighted series (skip when absent).
    let peak = null, trough = null;
    if (highlightKey && data.length > 1 && valueKeys.includes(highlightKey)) {
        let hi = 0, lo = 0;
        data.forEach((row, i) => {
            const v = Number(row[highlightKey]);
            if (v > Number(data[hi][highlightKey])) hi = i;
            if (v < Number(data[lo][highlightKey])) lo = i;
        });
        if (hi !== lo) {
            peak   = { x: data[hi][xKey], y: Number(data[hi][highlightKey]) };
            trough = { x: data[lo][xKey], y: Number(data[lo][highlightKey]) };
        }
    }
    const anyNegative = highlightKey && data.some(r => Number(r[highlightKey]) < 0);

    return (
        <ResponsiveContainer width="100%" height={288}>
            <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 40 }} barCategoryGap="28%">
                <defs>
                    {valueKeys.map((k, idx) => (
                        <linearGradient key={k} id={`bg-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colorFor(k, idx)} stopOpacity={1} />
                            <stop offset="100%" stopColor={colorFor(k, idx)} stopOpacity={0.72} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.18)" vertical={false} />
                <XAxis
                    dataKey={xKey}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    angle={data.length > 6 ? -30 : 0}
                    textAnchor={data.length > 6 ? 'end' : 'middle'}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => fmtAxisTick(v, hasCurrency)}
                    width={hasCurrency ? 72 : 52}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip content={pnlPct ? <PnlBarTooltip colors={colors} /> : <SpeedyTooltip showPercent={stacked} />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                {valueKeys.length > 1 && (
                    <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                        formatter={(v) => <span className="text-gray-600 dark:text-gray-400">{fmtHeader(v)}</span>}
                    />
                )}
                {/* Zero baseline — makes loss months unmistakable */}
                {anyNegative && <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />}
                {valueKeys.map((k, idx) => (
                    <Bar
                        key={k}
                        dataKey={k}
                        stackId={stacked ? 'a' : undefined}
                        fill={`url(#bg-${idx})`}
                        radius={stacked ? (idx === lastIdx ? [5, 5, 0, 0] : [0, 0, 0, 0]) : [5, 5, 0, 0]}
                        maxBarSize={72}
                        isAnimationActive={true}
                        animationBegin={idx * 80}
                        animationDuration={700}
                        animationEasing="ease-out"
                    >
                        {/* Per-bar colours (single-series charts only) */}
                        {perBar && data.map((_, i) => (
                            <Cell key={i} fill={cellColors[i % cellColors.length]} />
                        ))}
                    </Bar>
                ))}
                {/* Peak / trough markers on the highlighted series */}
                {peak && (
                    <ReferenceDot x={peak.x} y={peak.y} r={5} isFront
                        fill="#10b981" stroke="#fff" strokeWidth={1.5}
                        label={{ value: '▲ Peak', position: 'top', fill: '#10b981', fontSize: 10, fontWeight: 700 }} />
                )}
                {trough && (
                    <ReferenceDot x={trough.x} y={trough.y} r={5} isFront
                        fill="#ef4444" stroke="#fff" strokeWidth={1.5}
                        label={{ value: '▼ Low', position: 'bottom', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} />
                )}
            </BarChart>
        </ResponsiveContainer>
    );
};

// ─── Area Chart (used for line/trend data) ────────────────
const SpeedyAreaChart = ({ data, xKey, valueKeys }) => {
    const hasCurrency = valueKeys.some(isCurrencyColumn);
    return (
        <ResponsiveContainer width="100%" height={288}>
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 40 }}>
                <defs>
                    {valueKeys.map((k, idx) => (
                        <linearGradient key={k} id={`ag-${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.02} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.18)" vertical={false} />
                <XAxis
                    dataKey={xKey}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    angle={data.length > 8 ? -30 : 0}
                    textAnchor={data.length > 8 ? 'end' : 'middle'}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => fmtAxisTick(v, hasCurrency)}
                    width={hasCurrency ? 72 : 52}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip content={<SpeedyTooltip />} />
                {valueKeys.length > 1 && (
                    <Legend
                        wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                        formatter={(v) => <span className="text-gray-600 dark:text-gray-400">{fmtHeader(v)}</span>}
                    />
                )}
                {valueKeys.map((k, idx) => (
                    <Area
                        key={k}
                        type="monotone"
                        dataKey={k}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2.5}
                        fill={`url(#ag-${idx})`}
                        dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 0 }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: COLORS[idx % COLORS.length] }}
                        isAnimationActive={true}
                        animationBegin={idx * 100}
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );
};

// ─── Pie / Donut Chart ────────────────────────────────────
const RADIAN = Math.PI / 180;

const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
            {`${(percent * 100).toFixed(1)}%`}
        </text>
    );
};

const SpeedyPieChart = ({ data, nameKey, valueKey, sliceColors = null }) => (
    <ResponsiveContainer width="100%" height={300}>
        <PieChart>
            <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                cx="50%"
                cy="50%"
                outerRadius={108}
                innerRadius={42}
                paddingAngle={2}
                labelLine={false}
                label={renderPieLabel}
                isAnimationActive={true}
                animationBegin={0}
                animationDuration={900}
                animationEasing="ease-out"
            >
                {data.map((_, idx) => (
                    <Cell key={idx} fill={(sliceColors && sliceColors[idx % sliceColors.length]) || COLORS[idx % COLORS.length]} />
                ))}
            </Pie>
            <Tooltip
                content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0];
                    const val = entry.value;
                    return (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-lg p-3 text-xs min-w-[130px]">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.payload?.fill }} />
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{entry.name}</span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 tabular-nums">
                                {isCurrencyColumn(valueKey)
                                    ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : Number(val).toLocaleString('en-IN')}
                            </div>
                        </div>
                    );
                }}
            />
            <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span className="text-gray-600 dark:text-gray-400">{value.replace(/_/g, ' ')}</span>}
            />
        </PieChart>
    </ResponsiveContainer>
);

// ─── Distribution charts (computed from row-level data) ───
// Turns a flat list of rows into small side-by-side charts (e.g. overdue
// returns → by type / by courier / by days-overdue). Specs come from the
// template; aggregation happens here so the raw list stays the table below.
//   spec.groupBy → count rows per distinct value (optional spec.top = keep N)
//   spec.buckets → count rows whose numeric column falls in each range
const aggregateDistribution = (rows, spec) => {
    if (spec.buckets) {
        const { column, ranges, labels } = spec.buckets;
        const cols = spec.colors || [];
        // Attach each bucket's colour BEFORE dropping empty buckets, so the
        // severity ramp stays aligned even when some ranges have no rows
        // (otherwise a post-filter index shifts orange/red back to yellow).
        return ranges.map(([min, max], i) => ({
            label: labels[i],
            count: rows.reduce((acc, r) => {
                const v = Number(r[column]);
                return acc + (!isNaN(v) && v >= min && (max == null || v < max) ? 1 : 0);
            }, 0),
            _color: cols[i],
        })).filter(d => d.count > 0);
    }
    const map = new Map();
    rows.forEach(r => {
        const key = (r[spec.groupBy] ?? '').toString().trim() || 'Unknown';
        map.set(key, (map.get(key) || 0) + 1);
    });
    let arr = [...map.entries()]
        .map(([k, count]) => ({ [spec.groupBy]: k, count }))
        .sort((a, b) => b.count - a.count);
    if (spec.top) arr = arr.slice(0, spec.top);
    return arr;
};

// Vivid, well-separated categorical colours for distinct bars/slices when a
// spec doesn't supply its own palette.
const DIST_PALETTE = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'];

const DistributionCharts = ({ data, specs }) => {
    if (!Array.isArray(specs) || !specs.length || !data?.length) return null;
    const built = specs
        .map(spec => ({ spec, agg: aggregateDistribution(data, spec) }))
        .filter(({ agg }) => agg.length > 0);
    if (!built.length) return null;

    return (
        <div className={`grid gap-4 mb-5 sm:grid-cols-2 ${built.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
            {built.map(({ spec, agg }, i) => {
                const xKey = spec.buckets ? 'label' : spec.groupBy;
                const fallback = Array.isArray(spec.colors) && spec.colors.length ? spec.colors : DIST_PALETTE;
                // Prefer each row's own colour (buckets carry a severity-aligned
                // _color that survives dropping empty ranges); else cycle the
                // fallback palette so every category still differs.
                const colors = agg.map((r, idx) => r._color || fallback[idx % fallback.length]);
                return (
                    <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-3">
                        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1 pl-1">
                            {spec.title}
                        </div>
                        {spec.type === 'pie'
                            ? <SpeedyPieChart data={agg} nameKey={xKey} valueKey="count" sliceColors={colors} />
                            : <SpeedyBarChart data={agg} xKey={xKey} valueKeys={['count']} cellColors={colors} />}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Secondary dual-axis trend chart ──────────────────────
// For two metrics on incompatible scales (e.g. avg settlement ₹/unit and return
// count). Currency keys go on the left ₹ axis, the rest on the right axis, so
// both read honestly instead of one flattening the other.
const SpeedySecondaryChart = ({ data, xKey, keys, title }) => {
    const present = keys.filter(k => data.some(r => isNumeric(r[k])));
    if (!present.length) return null;
    const leftKeys  = present.filter(isCurrencyColumn);
    const rightKeys = present.filter(k => !isCurrencyColumn(k));
    const colorFor = (k) => COLORS[(keys.indexOf(k) + 3) % COLORS.length];

    return (
        <div className="mt-5">
            {title && (
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 pl-1">
                    {title}
                </div>
            )}
            <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.18)" vertical={false} />
                    <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: '#9ca3af' }}
                        angle={data.length > 6 ? -30 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'}
                        interval={0} tickLine={false} axisLine={false} />
                    {leftKeys.length > 0 && (
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }}
                            tickFormatter={(v) => fmtAxisTick(v, true)} width={64} tickLine={false} axisLine={false} />
                    )}
                    {rightKeys.length > 0 && (
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }}
                            tickFormatter={(v) => fmtAxisTick(v, false)} width={44} tickLine={false} axisLine={false} />
                    )}
                    <Tooltip content={<SpeedyTooltip />} cursor={{ stroke: 'rgba(139,92,246,0.25)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        formatter={(v) => <span className="text-gray-600 dark:text-gray-400">{fmtHeader(v)}</span>} />
                    {leftKeys.map(k => (
                        <Line key={k} yAxisId="left" type="monotone" dataKey={k} stroke={colorFor(k)}
                            strokeWidth={2.5} dot={{ r: 3, fill: colorFor(k), strokeWidth: 0 }}
                            activeDot={{ r: 5 }} isAnimationActive animationDuration={700} />
                    ))}
                    {rightKeys.map(k => (
                        <Line key={k} yAxisId="right" type="monotone" dataKey={k} stroke={colorFor(k)}
                            strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3, fill: colorFor(k), strokeWidth: 0 }}
                            activeDot={{ r: 5 }} isAnimationActive animationDuration={700} />
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

// ─── Per-month SKU breakdown (expandable, table view) ─────
// For each month: which SKUs made a profit (green) and which a loss (red) that
// month. Multiple months can stay open at once. Biggest-swing month opens first.
// monthlyBreakdown = { swingMonth, months: [{ month, totalLabel, total, gainers:[{sku,label}], losers:[...] }] }

// A clean two-column table (SKU · amount) for one profit/loss group.
const SkuGroupTable = ({ label, rows, positive }) => {
    if (!rows.length) return null;
    return (
        <div>
            <div className={`text-[10px] font-bold uppercase tracking-wide mb-1
                ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {positive ? '🟢' : '🔴'} {label} <span className="opacity-60">({rows.length})</span>
            </div>
            <table className="w-full text-[12px]">
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.sku + i}
                            className={`border-b border-gray-100 dark:border-gray-800/60 last:border-b-0
                                ${positive ? 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
                                           : 'hover:bg-red-50/50 dark:hover:bg-red-900/10'}`}>
                            <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{r.sku}</td>
                            <td className={`py-1.5 pl-2 text-right font-semibold tabular-nums whitespace-nowrap
                                ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {r.label}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const MonthRow = ({ m, open, onToggle }) => {
    const positiveTotal = Number(m.total) >= 0;
    return (
        <div className="border-b border-gray-100 dark:border-gray-800/70 last:border-b-0">
            <button type="button" onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                <AccordionIcon open={open} />
                <span className="font-semibold text-[13px] text-gray-800 dark:text-gray-200">{m.month}</span>
                <span className={`ml-auto text-[12px] font-semibold tabular-nums
                    ${positiveTotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {m.totalLabel}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-600 ml-1 tabular-nums">
                    {m.gainers.length}▲ {m.losers.length}▼
                </span>
            </button>
            {open && (
                <div className="px-4 pb-4 pt-1 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <SkuGroupTable label="Profit" rows={m.gainers} positive />
                    <SkuGroupTable label="Loss"   rows={m.losers}  positive={false} />
                    {m.gainers.length === 0 && m.losers.length === 0 && (
                        <p className="text-[11px] text-gray-400 dark:text-gray-600 pl-1 sm:col-span-2">No SKU-level data for this month.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const MonthlyBreakdown = ({ monthlyBreakdown }) => {
    // The chart branch renders this unconditionally, so it is also mounted for
    // results that carry no breakdown at all. Hooks MUST therefore run before
    // the empty-guard below: returning early first would change the hook order
    // between renders (react-hooks/rules-of-hooks) and break on the next result.
    const months      = monthlyBreakdown?.months || [];
    const defaultOpen = monthlyBreakdown?.swingMonth || months[0]?.month;

    // Multiple months open at once. Biggest-swing month open by default.
    const [openMonths, setOpenMonths] = React.useState(() => new Set(defaultOpen ? [defaultOpen] : []));

    // A new result reuses this same mounted component, so re-seed the open row
    // when the breakdown changes rather than leaving the old month expanded.
    React.useEffect(() => {
        setOpenMonths(new Set(defaultOpen ? [defaultOpen] : []));
    }, [defaultOpen]);

    const toggle = (month) => setOpenMonths(prev => {
        const next = new Set(prev);
        next.has(month) ? next.delete(month) : next.add(month);
        return next;
    });
    const allOpen = months.length > 0 && openMonths.size === months.length;
    const toggleAll = () => setOpenMonths(allOpen ? new Set() : new Set(months.map(m => m.month)));

    if (!months.length) return null;

    return (
        <div className="mb-5 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-900/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Per-month SKU breakdown
                </span>
                {/* Expand-all / collapse-all — makes it obvious the rows open */}
                <button type="button" onClick={toggleAll}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide
                        text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300
                        px-1.5 py-0.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    {allOpen
                        ? <><ChevronsDownUp size={12} /> Collapse all</>
                        : <><ChevronsUpDown size={12} /> Expand all</>}
                </button>
            </div>
            {months.map((m) => (
                <MonthRow key={m.month} m={m} open={openMonths.has(m.month)} onToggle={() => toggle(m.month)} />
            ))}
        </div>
    );
};

// ─── Empty State ──────────────────────────────────────────
const EmptyState = () => (
    <div className="py-10 text-center text-gray-400 dark:text-gray-500 text-sm flex flex-col items-center gap-2">
        <span className="text-2xl">📭</span>
        <span>No data returned for the selected filters.</span>
    </div>
);

const ComingSoonView = () => (
    <div className="py-10 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center border border-amber-200 dark:border-amber-800/40">
            <span className="text-3xl">🚧</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider border border-amber-200 dark:border-amber-800/50">
            Coming Soon
        </span>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
            This query requires additional data sources currently being integrated. It will be available soon.
        </p>
    </div>
);

// ─── Chart type label ─────────────────────────────────────
const ChartLabel = ({ type }) => {
    const labels = { bar: 'Bar Chart', 'stacked-bar': 'Stacked Bar Chart', line: 'Trend Chart', pie: 'Distribution' };
    if (!labels[type]) return null;
    return (
        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 pl-1">
            {labels[type]}
        </div>
    );
};

// ─── Main Renderer ────────────────────────────────────────
const ResponseRenderer = ({ data = [], format, chartType, chartKeys = null, highlightKey = null, secondaryChart = null, monthlyBreakdown = null, chartColors = null, chartAbsKeys = null, chartPnlPct = false, distributionCharts = null, showTotals = false }) => {
    if (format === 'coming_soon') return <ComingSoonView />;

    if (!data?.length) return <EmptyState />;

    if (format === 'table' || !format) {
        // Optional distribution charts (computed from the rows) above the list.
        return (
            <div>
                <DistributionCharts data={data} specs={distributionCharts} />
                <DataTable data={data} showTotals={showTotals} />
            </div>
        );
    }

    if (format === 'chart') {
        const keys = Object.keys(data[0] || {});
        let xKey      = keys[0];
        // Use the first non-null value to decide if a column is numeric — a
        // null in row 0 would otherwise drop legitimate numeric columns from
        // the chart (common with sparse data / outer joins).
        let valueKeys = keys.slice(1).filter((k) => {
            if (isIdentifierColumn(k)) return false;
            const firstNonNull = data.find(row => row[k] !== null && row[k] !== undefined);
            return firstNonNull ? isNumeric(firstNonNull[k]) : false;
        });

        // An explicit chartKeys list (from the template) restricts which columns
        // are PLOTTED — the rest still show in the detail table below. Used when
        // a response mixes incompatible scales (₹ vs counts vs per-unit), so the
        // chart stays readable. Ignored keys silently fall through to auto.
        if (Array.isArray(chartKeys) && chartKeys.length) {
            const restricted = chartKeys.filter(k => valueKeys.includes(k));
            if (restricted.length) valueKeys = restricted;
        }

        if (!valueKeys.length) return <DataTable data={data} />;

        // Parse all numeric value keys. Keys in chartAbsKeys are plotted as their
        // magnitude — e.g. ad spend is stored negative (a cost) but should rise as
        // a positive bar. The detail table below still shows the real signed value.
        const absSet = new Set(Array.isArray(chartAbsKeys) ? chartAbsKeys : []);
        let chartData = data.map((row) => {
            const parsedRow = { ...row };
            valueKeys.forEach((k) => {
                const num = Number(row[k]) || 0;
                parsedRow[k] = absSet.has(k) ? Math.abs(num) : num;
            });
            return parsedRow;
        });

        // ── Single-Row Edge Case (e.g. SELECT sum(sales), sum(profit)) ──
        if (chartData.length === 1) {
            const isXNumeric = isNumeric(chartData[0][xKey]);
            if (isXNumeric || (chartType === 'pie' && valueKeys.length > 0)) {
                const metrics = isXNumeric ? keys : valueKeys;
                const transposed = metrics
                    .map((k) => ({ metric: k, value: Number(chartData[0][k]) }))
                    .filter((r) => !isNaN(r.value) && (chartType !== 'pie' || r.value >= 0));

                if (transposed.length > 0) {
                    chartData = transposed;
                    xKey = 'metric';
                    valueKeys = ['value'];
                }
            }
        }

        const timeSeries = isTimeSeriesKey(xKey);

        // Secondary-chart keys must exist as numeric columns in the data.
        const secKeys = Array.isArray(secondaryChart?.keys)
            ? secondaryChart.keys.filter(k => keys.includes(k) && data.some(r => isNumeric(r[k])))
            : [];

        return (
            <div>
                {/* Structured "why" — per-month SKU breakdown — above the visuals */}
                <MonthlyBreakdown monthlyBreakdown={monthlyBreakdown} />

                <ChartLabel type={chartType} />
                {chartType === 'bar' && (
                    <SpeedyBarChart data={chartData} xKey={xKey} valueKeys={valueKeys} highlightKey={highlightKey} colors={chartColors} pnlPct={chartPnlPct} />
                )}
                {chartType === 'stacked-bar' && (
                    // Stack only quantity columns. Drop:
                    //   • Rollup columns (total_*) — would double the bar height
                    //   • Currency columns — wrong unit, often negative
                    //   • Percent columns — wrong unit
                    // Filtered columns still appear in the detail table below.
                    <SpeedyBarChart
                        data={chartData}
                        xKey={xKey}
                        valueKeys={valueKeys.filter((k) =>
                            !/^total[_ ]/i.test(k)
                            && !isCurrencyColumn(k)
                            && !isPctColumn(k)
                        )}
                        stacked
                    />
                )}
                {chartType === 'line' && (
                    // Always use area chart for line — looks much better with gradient fill
                    <SpeedyAreaChart data={chartData} xKey={xKey} valueKeys={valueKeys} />
                )}
                {chartType === 'pie' && (
                    <SpeedyPieChart data={chartData} nameKey={xKey} valueKey={valueKeys[0]} />
                )}
                {/* Secondary trend chart (e.g. avg settlement vs returns) */}
                {secKeys.length > 0 && (
                    <SpeedySecondaryChart data={chartData} xKey={xKey} keys={secKeys} title={secondaryChart.title} />
                )}
                {/* Detail table below chart */}
                <div className="mt-4">
                    <DataTable data={data} showTotals={showTotals} />
                </div>
            </div>
        );
    }

    // 'text' format — data will be empty, summary shown in parent
    return null;
};

export default ResponseRenderer;

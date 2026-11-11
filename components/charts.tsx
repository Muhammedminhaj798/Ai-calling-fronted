'use client';
// Two chart shapes cover every requirement: a day-by-day column chart and a ranked horizontal bar chart.
// Single hue (blue), thin rounded marks, recessive grid, hover tooltip; text uses text tokens, not series colour.
// Charts use Recharts 3 `responsive` sizing: the wrapper div fixes the height, the chart fills it (100% × 100%).
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts';

const SERIES = '#2a78d6';
const GRID = '#e2e8f0';
const TICK = { fontSize: 11, fill: '#64748b' };
const TOOLTIP = { contentStyle: { fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }, cursor: { fill: '#f1f5f9' } };

export function DayBars({ data, name }: { data: Array<{ day: string; count: number }>; name: string }) {
  const sparse = data.length > 10;
  return (
    <div className="h-55 w-full">
      <BarChart responsive width="100%" height="100%" data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={sparse ? 2 : 8}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(d: string) => d.slice(5)} interval={sparse ? Math.floor(data.length / 8) : 0} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...TOOLTIP} formatter={(v) => [v, name]} />
        <Bar dataKey="count" name={name} fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </div>
  );
}

export function RankedBars({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="w-full" style={{ height: Math.max(120, 36 * data.length + 24) }}>
      <BarChart responsive width="100%" height="100%" data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={120} tick={TICK} tickLine={false} axisLine={false} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="value" name="Count" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#334155' }} />
        </Bar>
      </BarChart>
    </div>
  );
}

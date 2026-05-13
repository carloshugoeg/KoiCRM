"use client"

import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface BarChartProps {
  data: { label: string; value: number; color?: string }[]
  formatter?: (value: number) => string
  height?: number
}

export function BarChart({ data, formatter, height = 220 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatter} />
        <Tooltip
          formatter={(v: any) => [formatter ? formatter(v) : v, ""]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? "#6366f1"} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}

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
import { formatCurrency } from "@/lib/intl/format"
import type { IntlSettings } from "@/lib/intl/format"

interface BarChartProps {
  data: { label: string; value: number; color?: string }[]
  intl?: IntlSettings
  height?: number
}

export function BarChart({ data, intl, height = 220 }: BarChartProps) {
  const fmt = intl ? (n: number) => formatCurrency(n, intl) : undefined
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
        <Tooltip
          formatter={(v) => [fmt ? fmt(v as number) : (v as number), ""]}
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

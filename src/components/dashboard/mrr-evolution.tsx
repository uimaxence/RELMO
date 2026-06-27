"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const config = {
  mrr: { label: "MRR", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function MrrEvolutionChart({
  data,
}: {
  data: { label: string; mrr: number }[];
}) {
  return (
    <ChartContainer config={config} className="h-[160px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs"
        />
        <YAxis hide />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => `${v} €`} />}
        />
        <Area
          dataKey="mrr"
          type="monotone"
          fill="var(--color-mrr)"
          fillOpacity={0.12}
          stroke="var(--color-mrr)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

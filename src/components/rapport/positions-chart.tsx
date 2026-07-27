"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Évolution de la position moyenne (mots-clés positionnés) mois par mois. L'axe
// est INVERSÉ : une position plus basse (1 = 1re place) apparaît plus haut, donc
// « la courbe qui monte = ça s'améliore ».
const config = {
  position: { label: "Position moyenne", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function PositionsChart({
  data,
}: {
  data: { label: string; position: number | null }[];
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
          tickFormatter={(v: string) => v.slice(0, 3)}
          className="text-xs"
        />
        <YAxis reversed hide domain={["dataMin - 1", "dataMax + 1"]} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => `position ${v}`} />}
        />
        <Area
          dataKey="position"
          type="monotone"
          connectNulls
          fill="var(--color-position)"
          fillOpacity={0.12}
          stroke="var(--color-position)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

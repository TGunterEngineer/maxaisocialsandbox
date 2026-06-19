import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function generateLast30DaysData() {
  const data = [];
  const today = new Date();
  // Simulate a realistic rating trend (hovering around 3.5–4.2)
  let rating = 3.6;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // Random walk with slight upward bias
    rating += (Math.random() - 0.45) * 0.3;
    rating = Math.max(2.5, Math.min(5, rating));
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rating: Math.round(rating * 10) / 10,
    });
  }
  return data;
}

export function RatingTrendChart() {
  const data = useMemo(() => generateLast30DaysData(), []);

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm min-h-[316px]">
      <h3 className="text-sm font-semibold text-foreground mb-1">
        Average Rating — Last 30 Days
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Daily average review rating trend
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            interval={4}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [`${value} ★`, "Avg Rating"]}
          />
          <Line
            type="monotone"
            dataKey="rating"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, fill: "hsl(var(--primary))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DataPoint {
  date: string;
  [key: string]: string | number;
}

interface TrendChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
  categories: string[];
  colors: string[];
}

export function TrendChart({ title, description, data, categories, colors }: TrendChartProps) {
  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg font-display">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {colors.map((color, index) => (
                <linearGradient key={index} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                borderRadius: '8px', 
                border: '1px solid hsl(var(--border))',
                boxShadow: 'var(--shadow-md)'
              }}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            {categories.map((category, index) => (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={colors[index]}
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#color${index})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

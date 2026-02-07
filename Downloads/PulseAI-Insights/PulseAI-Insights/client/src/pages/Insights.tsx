import { useGenerateInsights, useInsights } from "@/hooks/use-pulse-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lightbulb, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Insights() {
  const { data: insights = [], isLoading } = useInsights();
  const generateInsights = useGenerateInsights();
  const latestDate = insights[0]?.createdAt ? new Date(insights[0].createdAt) : new Date();
  const teamShifts = insights.filter((insight) => insight.type === "team_shift");
  const patterns = insights.filter((insight) => insight.type === "pattern");

  if (isLoading) return <div className="p-8">Loading insights...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-3">Weekly Intelligence</h1>
          <p className="text-muted-foreground text-lg">
            Key patterns and shifts detected for the week of {format(latestDate, 'MMMM do')}
          </p>
        </div>
        <Button
          onClick={() => generateInsights.mutate()}
          disabled={generateInsights.isPending}
        >
          {generateInsights.isPending ? "Clicking..." : "Click Team Insights"}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <TrendingUp className="w-5 h-5" /> Biggest Shifts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamShifts.length === 0 ? (
              <p className="text-blue-900/70 text-sm leading-relaxed">No team shifts logged yet.</p>
            ) : (
              <ul className="space-y-4">
                {teamShifts.slice(0, 2).map((shift) => (
                  <li key={shift.id} className="flex gap-3 items-start">
                    <span className="bg-blue-200 w-2 h-2 rounded-full mt-2" />
                    <div className="text-blue-900/80 text-sm leading-relaxed">
                      <div className="font-semibold text-blue-900">{shift.title}</div>
                      <p>{shift.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Lightbulb className="w-5 h-5" /> Emerging Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.length === 0 ? (
              <p className="text-amber-900/80 text-sm leading-relaxed">No patterns logged yet.</p>
            ) : (
              <div className="space-y-4">
                {patterns.slice(0, 2).map((pattern) => (
                  <div key={pattern.id} className="bg-white/50 p-3 rounded-lg border border-amber-200/50">
                    <div className="text-xs text-amber-800 font-semibold">{pattern.title}</div>
                    <p className="text-amber-900/80 text-sm leading-relaxed mt-1">
                      {pattern.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          Detailed Insight Log
        </h3>
        
        <div className="space-y-4">
          {insights?.map((insight) => (
            <div key={insight.id} className="group bg-card border border-border p-5 rounded-xl hover:border-primary/30 transition-all cursor-default">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">
                    {insight.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(insight.createdAt || new Date()), 'MMM d, h:mm a')}</span>
                </div>
                {insight.level === 'team' && <Badge variant="outline" className="text-xs">Team Level</Badge>}
              </div>
              
              <h4 className="font-bold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">{insight.title}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{insight.description}</p>
              
              <div className="mt-4 flex items-center text-primary text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                View Details <ArrowRight className="w-3 h-3 ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useRoute } from "wouter";
import { useEmployee, useEmployeeHistory, useEmployeeAlerts, useMlPrediction, useRunMlPredictions } from "@/hooks/use-pulse-data";
import { useSelectedEmployee } from "@/contexts/selected-employee";
import { useEffect, useState } from "react";
import { InfoCard } from "@/components/InfoCard";
import { TrendChart } from "@/components/TrendChart";
import { ExplainabilityPanel } from "@/components/ExplainabilityPanel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function EmployeeDetail() {
  const [, params] = useRoute("/employee/:id");
  const id = parseInt(params?.id || "0");
  
  const { data: employee, isLoading: empLoading } = useEmployee(id);
  const { data: history, isLoading: histLoading } = useEmployeeHistory(id);
  const { data: alerts } = useEmployeeAlerts(id);
  const { data: mlPrediction } = useMlPrediction(id);
  const runMl = useRunMlPredictions();
  const { setSelectedEmployeeId } = useSelectedEmployee();
  const [autoRequested, setAutoRequested] = useState(false);

  useEffect(() => {
    if (id) {
      setSelectedEmployeeId(id);
    }
  }, [id, setSelectedEmployeeId]);

  useEffect(() => {
    setAutoRequested(false);
  }, [id]);

  useEffect(() => {
    if (!id || autoRequested || runMl.isPending) return;
    if (mlPrediction === null) {
      setAutoRequested(true);
      runMl.mutate({ employeeId: id });
    }
  }, [id, mlPrediction, autoRequested, runMl]);

  if (empLoading || histLoading) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground">Loading profile...</div>;
  }

  if (!employee) return <div>Employee not found</div>;

  const latestHealth = history?.[0];
  const topFeatures = mlPrediction?.topFeatures ?? {};
  const explainabilityReasons = [];

  if (topFeatures.burnout?.length) {
    explainabilityReasons.push({
      text: `Burnout signals: ${topFeatures.burnout.join(", ")}`,
      impact: "negative" as const,
    });
  }

  if (topFeatures.performance?.length) {
    explainabilityReasons.push({
      text: `Performance signals: ${topFeatures.performance.join(", ")}`,
      impact: "neutral" as const,
    });
  }

  if (topFeatures.growth?.length) {
    explainabilityReasons.push({
      text: `Growth signals: ${topFeatures.growth.join(", ")}`,
      impact: "positive" as const,
    });
  }

  const confidenceScore = mlPrediction
    ? Math.max(
        mlPrediction.burnoutConfidence,
        mlPrediction.performanceConfidence,
        mlPrediction.growthConfidence
      )
    : 0;
  const confidenceLabel = confidenceScore >= 0.75 ? "High" : confidenceScore >= 0.5 ? "Medium" : "Low";
  const allFeatures = [
    ...(topFeatures.burnout || []),
    ...(topFeatures.performance || []),
    ...(topFeatures.growth || []),
  ];
  const summary =
    allFeatures.length > 0
      ? `Top signals from the last 4 weeks: ${Array.from(new Set(allFeatures)).join(", ")}.`
      : undefined;

  const chartData = history?.map(h => ({
    date: format(new Date(h.date), 'MMM d'),
    performance: h.performanceScore,
    engagement: h.engagementScore,
    workload: h.workloadScore
  })) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header Profile */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-background shadow-md">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {employee.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{employee.name}</h1>
            <p className="text-muted-foreground">{employee.role} • {employee.department}</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" /> Schedule 1:1
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <MessageSquare className="w-4 h-4" /> Send Kudos
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <InfoCard 
          label="Burnout Risk" 
          value={latestHealth?.burnoutRisk ?? "—"}
          className="border-t-4 border-t-blue-500"
        />
        <InfoCard 
          label="Engagement" 
          value={latestHealth?.engagementScore ?? "—"}
          className="border-t-4 border-t-green-500"
        />
        <InfoCard 
          label="Performance" 
          value={latestHealth?.performanceScore ?? "—"}
          className="border-t-4 border-t-purple-500"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <TrendChart 
              title="4-Week Performance Trend" 
              description="Monitoring workload impact on engagement"
              data={chartData}
              categories={['performance', 'engagement', 'workload']}
              colors={['#3b82f6', '#10b981', '#f59e0b']}
            />
          </div>

        </div>

        <div className="space-y-6">
          <ExplainabilityPanel 
            reasons={explainabilityReasons}
            confidence={confidenceLabel}
            summary={summary}
          />

          <div className="flex items-center justify-between">
            <h3 className="font-semibold">AI Recommendations</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runMl.mutate({ employeeId: id })}
              disabled={runMl.isPending || !id}
            >
              {runMl.isPending ? "Clicking..." : "Click"}
            </Button>
          </div>

          {mlPrediction && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Burnout Risk:</span>{" "}
                  {mlPrediction.burnoutRisk} ({Math.round(mlPrediction.burnoutConfidence * 100)}%)
                </div>
                <div>
                  <span className="font-medium text-foreground">Performance Trend:</span>{" "}
                  {mlPrediction.performanceTrend} ({Math.round(mlPrediction.performanceConfidence * 100)}%)
                </div>
                <div>
                  <span className="font-medium text-foreground">Growth Potential:</span>{" "}
                  {mlPrediction.growthPotential} ({Math.round(mlPrediction.growthConfidence * 100)}%)
                </div>
              </div>
              {mlPrediction.recommendations?.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-foreground space-y-1">
                  {mlPrediction.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              )}
              {mlPrediction.explanation && (
                <p className="text-sm text-muted-foreground">{mlPrediction.explanation}</p>
              )}
            </div>
          )}
          
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Active Alerts</h3>
            {alerts?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active alerts for this employee.</p>
            ) : (
              <ul className="space-y-3">
                {alerts?.map(alert => (
                  <li key={alert.id} className="text-sm p-3 bg-secondary/50 rounded-lg border border-border/50">
                    <span className="font-medium text-foreground block mb-1 capitalize">{alert.type.replace('_', ' ')}</span>
                    <span className="text-muted-foreground">{alert.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

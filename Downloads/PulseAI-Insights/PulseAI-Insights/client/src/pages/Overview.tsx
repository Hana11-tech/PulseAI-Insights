import { useTeamHealth, useActiveAlerts, useResolveAlert, useRunMlPredictions, useMlPredictions, useInsights } from "@/hooks/use-pulse-data";
import { InfoCard } from "@/components/InfoCard";
import { AlertCard } from "@/components/AlertCard";
import { TrendChart } from "@/components/TrendChart";
import { TransparencyNotice } from "@/components/TransparencyNotice";
import { Activity, BatteryWarning, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function Overview() {
  const { data: health, isLoading: healthLoading } = useTeamHealth();
  const { data: alerts, isLoading: alertsLoading } = useActiveAlerts();
  const { data: predictions = [] } = useMlPredictions();
  const { data: insights = [] } = useInsights();
  const resolveAlert = useResolveAlert();
  const runMl = useRunMlPredictions();
  const [refreshingEmployeeId, setRefreshingEmployeeId] = useState<number | null>(null);
  const latestInsight = insights.find((insight) => insight.level === "team") ?? insights[0];

  if (healthLoading || alertsLoading) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground animate-pulse">Analyzing team pulse...</div>;
  }

  if (!health) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Team Overview</h2>
          <p className="text-muted-foreground mt-1">
            Weekly pulse check for {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <InfoCard 
          label="Team Health" 
          value={`${health.healthScore}%`}
          icon={<Activity className="w-5 h-5" />}
        />
        <InfoCard 
          label="Burnout Risk" 
          value={health.burnoutRisk} 
          icon={<BatteryWarning className="w-5 h-5" />}
          className={health.burnoutRisk === 'High' ? 'border-red-200 bg-red-50/50' : ''}
        />
        <InfoCard 
          label="Growth Potential" 
          value={health.growthPotential} 
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <InfoCard 
          label="Engagement" 
          value={health.engagementHealth} 
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-bold text-lg">Latest Predictions Snapshot</h3>
          <span className="text-xs text-muted-foreground">
            {predictions.length} employees cached
          </span>
        </div>
        {predictions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No cached predictions yet.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {predictions.slice(0, 6).map((pred) => (
              <div key={pred.employeeId} className="border border-border/60 rounded-xl p-4">
                <div className="font-semibold text-sm">{pred.employeeName || `Employee ${pred.employeeId}`}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Burnout: <span className="text-foreground">{pred.burnoutRisk}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Performance: <span className="text-foreground">{pred.performanceTrend}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Growth: <span className="text-foreground">{pred.growthPotential}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Chart Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <TrendChart 
              title="Burnout vs Performance" 
              description="Correlation analysis over the last 30 days"
              data={health.trendData}
              categories={["burnout", "performance"]}
              colors={["#ef4444", "#3b82f6"]}
            />
          </div>

          {latestInsight && (
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 rounded-2xl border border-primary/20">
              <h3 className="font-display font-bold text-lg text-primary mb-2">{latestInsight.title}</h3>
              <p className="text-foreground/80">
                {latestInsight.description}
              </p>
            </div>
          )}
        </div>

        {/* Alerts Sidebar */}
        <div className="space-y-6">
          <h3 className="font-display font-bold text-xl px-1">Attention Required</h3>
          <div className="space-y-4">
            {alerts?.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-sm">
                No active alerts. Good job!
              </div>
            ) : (
              alerts?.map((alert) => (
                <AlertCard
                  key={alert.id}
                  type={alert.type}
                  employeeName={alert.employeeName}
                  reason={alert.reason}
                  confidence={alert.confidence}
                  isResolving={resolveAlert.isPending}
                  onAction={() => resolveAlert.mutate({ id: alert.id, action: 'reviewed' })}
                  onRefreshAi={() => {
                    setRefreshingEmployeeId(alert.employeeId);
                    runMl.mutate(
                      { employeeId: alert.employeeId },
                      { onSettled: () => setRefreshingEmployeeId(null) }
                    );
                  }}
                  isRefreshing={runMl.isPending && refreshingEmployeeId === alert.employeeId}
                />
              ))
            )}
          </div>
          
          <TransparencyNotice />
        </div>
      </div>
    </div>
  );
}

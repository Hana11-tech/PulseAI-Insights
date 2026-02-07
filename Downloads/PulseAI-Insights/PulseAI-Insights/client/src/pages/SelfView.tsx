import { TrendChart } from "@/components/TrendChart";
import { InfoCard } from "@/components/InfoCard";
import { TransparencyNotice } from "@/components/TransparencyNotice";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, TrendingUp, Users } from "lucide-react";
import { useSelectedEmployee } from "@/contexts/selected-employee";
import { useEmployee, useEmployeeHistory, useMlPrediction, useRunMlPredictions } from "@/hooks/use-pulse-data";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function SelfView() {
  const { selectedEmployeeId } = useSelectedEmployee();
  const { data: employee } = useEmployee(selectedEmployeeId || 0);
  const { data: history } = useEmployeeHistory(selectedEmployeeId || 0);
  const { data: mlPrediction } = useMlPrediction(selectedEmployeeId || 0);
  const runMl = useRunMlPredictions();
  const [, setLocation] = useLocation();
  const [autoRequested, setAutoRequested] = useState(false);

  useEffect(() => {
    setAutoRequested(false);
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployeeId || autoRequested || runMl.isPending) return;
    if (mlPrediction === null) {
      setAutoRequested(true);
      runMl.mutate({ employeeId: selectedEmployeeId });
    }
  }, [selectedEmployeeId, mlPrediction, autoRequested, runMl]);

  if (!selectedEmployeeId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-display font-bold mb-2">Select an Employee</h2>
          <p className="text-muted-foreground mb-4">
            Choose an employee to view their PulseAI predictions and coaching insights.
          </p>
          <Button onClick={() => setLocation("/employees")}>
            Go to Employees
          </Button>
        </div>
      </div>
    );
  }

  const displayName = employee?.name || `Employee ${selectedEmployeeId}`;
  const displayInitial = displayName.charAt(0).toUpperCase();

  const chartData =
    history?.slice(0, 8).reverse().map((h) => ({
      date: format(new Date(h.date), "MMM d"),
      growth: h.performanceScore,
      engagement: h.engagementScore,
    })) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* Personal Header */}
      <div className="bg-gradient-to-r from-primary/90 to-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-900/20">
        <div className="flex items-center gap-6">
          <Avatar className="w-20 h-20 border-4 border-white/20">
            <AvatarFallback className="bg-white/10 text-white text-2xl font-display font-bold">
              {displayInitial}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold mb-2">Hello, {displayName}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runMl.mutate({ employeeId: selectedEmployeeId })}
                disabled={runMl.isPending}
                className="border-white/30 text-white hover:text-primary-foreground"
              >
                {runMl.isPending ? "Clicking..." : "Click AI"}
              </Button>
            </div>
            <p className="text-blue-100 max-w-lg leading-relaxed">
              Here is your personal growth pulse. This data is private to you and designed to help you balance impact with wellbeing.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid md:grid-cols-3 gap-6">
        <InfoCard 
          label="Burnout Risk" 
          value={mlPrediction?.burnoutRisk || "—"} 
          icon={<Users className="w-5 h-5" />}
          className="border-t-4 border-t-red-500"
        />
        <InfoCard 
          label="Performance Trend" 
          value={mlPrediction?.performanceTrend || "—"} 
          icon={<TrendingUp className="w-5 h-5" />}
          className="border-t-4 border-t-primary"
        />
        <InfoCard 
          label="Growth Potential" 
          value={mlPrediction?.growthPotential || "—"} 
          icon={<BookOpen className="w-5 h-5" />}
          className="border-t-4 border-t-green-500"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <TrendChart 
            title="Growth & Engagement" 
            description="Your trend over recent weeks"
            data={chartData}
            categories={['growth', 'engagement']}
            colors={['#3b82f6', '#10b981']}
          />
        </div>

        <div className="space-y-6">
          {mlPrediction && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
              <h3 className="font-display font-bold text-lg text-foreground">AI Recommendations</h3>
              <div className="text-xs text-muted-foreground">
                Last updated:{" "}
                {mlPrediction.createdAt
                  ? new Date(mlPrediction.createdAt).toLocaleString()
                  : "Unknown"}
              </div>
              <ul className="space-y-2 text-sm">
                {(mlPrediction.recommendations || []).length === 0 ? (
                  <li className="text-xs text-muted-foreground">No recommendations available yet.</li>
                ) : (
                  (mlPrediction.recommendations || []).map((rec, idx) => (
                    <li key={idx} className="bg-secondary/40 rounded-lg p-3">
                      {rec}
                    </li>
                  ))
                )}
              </ul>
              {mlPrediction.explanation && (
                <p className="text-xs text-muted-foreground">{mlPrediction.explanation}</p>
              )}
            </div>
          )}
          
          <TransparencyNotice />
        </div>
      </div>
    </div>
  );
}

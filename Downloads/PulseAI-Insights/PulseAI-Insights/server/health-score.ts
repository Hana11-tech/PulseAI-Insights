import type { EmployeeWeeklyMetric, InsertHealthScore } from "@shared/schema";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const toPercent = (value: number) => {
  if (Number.isNaN(value)) return 0;
  return value <= 1.5 ? value * 100 : value;
};

export function computeHealthScoreFromMetric(metric: EmployeeWeeklyMetric): InsertHealthScore {
  const engagementScore = clamp(toPercent(metric.engagementScore));
  const collaborationScore = clamp(toPercent(metric.collaborationScore));

  const tasksAssigned = Math.max(0, metric.tasksAssigned);
  const tasksCompleted = Math.max(0, metric.tasksCompleted);
  const missedDeadlines = Math.max(0, metric.missedDeadlines);

  const taskCompletionRatio = tasksAssigned > 0 ? tasksCompleted / tasksAssigned : 0;
  const deadlineMissRate = tasksAssigned > 0 ? missedDeadlines / tasksAssigned : 0;

  // Heuristic scoring until a dedicated scoring model is introduced.
  const workloadScore = clamp(
    (tasksAssigned / 40) * 70 +
      (metric.meetingHours / 10) * 20 +
      (metric.stretchAssignments / 5) * 10
  );

  const performanceScore = clamp(
    taskCompletionRatio * 100 * 0.6 +
      engagementScore * 0.2 +
      collaborationScore * 0.2 -
      deadlineMissRate * 100 * 0.2
  );

  const burnoutRisk = clamp(
    workloadScore * 0.45 +
      deadlineMissRate * 100 * 0.25 +
      (100 - engagementScore) * 0.2 +
      (100 - collaborationScore) * 0.1
  );

  return {
    employeeId: metric.employeeId,
    burnoutRisk: Math.round(burnoutRisk),
    engagementScore: Math.round(engagementScore),
    performanceScore: Math.round(performanceScore),
    workloadScore: Math.round(workloadScore),
    date: metric.weekStart,
  };
}

export * from "./models/chat";

import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  email: text("email").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const healthScores = pgTable("health_scores", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  burnoutRisk: integer("burnout_risk").notNull(), // 0-100
  engagementScore: integer("engagement_score").notNull(), // 0-100
  performanceScore: integer("performance_score").notNull(), // 0-100
  workloadScore: integer("workload_score").notNull(), // 0-100
  date: timestamp("date").notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(), // 'burnout_risk', 'performance_decline', 'emerging_talent'
  reason: text("reason").notNull(),
  confidence: text("confidence").notNull(), // 'High', 'Medium', 'Low'
  status: text("status").notNull().default('active'), // 'active', 'dismissed', 'resolved'
  actionTaken: boolean("action_taken").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'team_shift', 'pattern', 'alert_summary'
  level: text("level").notNull(), // 'team', 'individual'
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeWeeklyMetrics = pgTable("employee_weekly_metrics", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  weekStart: timestamp("week_start").notNull(),
  tasksAssigned: integer("tasks_assigned").notNull(),
  tasksCompleted: integer("tasks_completed").notNull(),
  missedDeadlines: integer("missed_deadlines").notNull(),
  meetingHours: real("meeting_hours").notNull(),
  collaborationScore: real("collaboration_score").notNull(),
  engagementScore: real("engagement_score").notNull(),
  learningHours: real("learning_hours").notNull(),
  stretchAssignments: integer("stretch_assignments").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeeMlPredictions = pgTable("employee_ml_predictions", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  burnoutRisk: text("burnout_risk").notNull(),
  burnoutConfidence: real("burnout_confidence").notNull(),
  performanceTrend: text("performance_trend").notNull(),
  performanceConfidence: real("performance_confidence").notNull(),
  growthPotential: text("growth_potential").notNull(),
  growthConfidence: real("growth_confidence").notNull(),
  topFeatures: jsonb("top_features").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, joinedAt: true });
export const insertHealthScoreSchema = createInsertSchema(healthScores).omit({ id: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertInsightSchema = createInsertSchema(insights).omit({ id: true, createdAt: true });
export const insertEmployeeWeeklyMetricSchema = createInsertSchema(employeeWeeklyMetrics).omit({ id: true, createdAt: true });
export const insertEmployeeMlPredictionSchema = createInsertSchema(employeeMlPredictions).omit({ id: true, createdAt: true });

// Types
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type HealthScore = typeof healthScores.$inferSelect;
export type InsertHealthScore = z.infer<typeof insertHealthScoreSchema>;

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

export type Insight = typeof insights.$inferSelect;
export type InsertInsight = z.infer<typeof insertInsightSchema>;

export type EmployeeWeeklyMetric = typeof employeeWeeklyMetrics.$inferSelect;
export type InsertEmployeeWeeklyMetric = z.infer<typeof insertEmployeeWeeklyMetricSchema>;

export type EmployeeMlPrediction = typeof employeeMlPredictions.$inferSelect;
export type InsertEmployeeMlPrediction = z.infer<typeof insertEmployeeMlPredictionSchema>;

// Complex Response Types
export type EmployeeWithHealth = Employee & {
  latestHealth: HealthScore | null;
  alerts: Alert[];
};

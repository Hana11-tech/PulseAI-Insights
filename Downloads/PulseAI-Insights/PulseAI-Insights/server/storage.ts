import { db } from "./db";
import { 
  employees, healthScores, alerts, insights,
  type Employee, type InsertEmployee,
  type HealthScore, type InsertHealthScore,
  type Alert, type InsertAlert,
  type Insight, type InsertInsight,
  employeeWeeklyMetrics,
  employeeMlPredictions,
  type EmployeeWeeklyMetric, type InsertEmployeeWeeklyMetric,
  type EmployeeMlPrediction, type InsertEmployeeMlPrediction
} from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";

export interface IStorage {
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  
  // Health Scores
  getHealthScores(employeeId: number): Promise<HealthScore[]>;
  addHealthScore(score: InsertHealthScore): Promise<HealthScore>;
  upsertHealthScore(score: InsertHealthScore): Promise<HealthScore>;
  getLatestTeamHealth(): Promise<{
    burnoutRisk: number;
    engagementScore: number;
    performanceScore: number;
    workloadScore: number;
  }>;
  getTeamHealthTrend(days: number): Promise<HealthScore[]>;

  // Alerts
  getActiveAlerts(): Promise<(Alert & { employeeName: string })[]>;
  getEmployeeAlerts(employeeId: number): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: number): Promise<Alert | undefined>;

  // Insights
  getInsights(): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;

  // Weekly Metrics
  getWeeklyMetrics(employeeId: number): Promise<EmployeeWeeklyMetric[]>;
  getAllWeeklyMetrics(): Promise<EmployeeWeeklyMetric[]>;
  createWeeklyMetrics(metrics: InsertEmployeeWeeklyMetric[]): Promise<EmployeeWeeklyMetric[]>;

  // ML Predictions
  getLatestMlPredictions(): Promise<(EmployeeMlPrediction & { employeeName: string })[]>;
  getLatestMlPrediction(employeeId: number): Promise<EmployeeMlPrediction | undefined>;
  createMlPredictions(predictions: InsertEmployeeMlPrediction[]): Promise<EmployeeMlPrediction[]>;
}

export class DatabaseStorage implements IStorage {
  // --- Employees ---
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  // --- Health Scores ---
  async getHealthScores(employeeId: number): Promise<HealthScore[]> {
    return await db.select()
      .from(healthScores)
      .where(eq(healthScores.employeeId, employeeId))
      .orderBy(desc(healthScores.date));
  }

  async addHealthScore(score: InsertHealthScore): Promise<HealthScore> {
    const [newScore] = await db.insert(healthScores).values(score).returning();
    return newScore;
  }

  async upsertHealthScore(score: InsertHealthScore): Promise<HealthScore> {
    const [existing] = await db.select()
      .from(healthScores)
      .where(and(eq(healthScores.employeeId, score.employeeId), eq(healthScores.date, score.date)))
      .limit(1);

    if (existing) {
      const [updated] = await db.update(healthScores)
        .set({
          burnoutRisk: score.burnoutRisk,
          engagementScore: score.engagementScore,
          performanceScore: score.performanceScore,
          workloadScore: score.workloadScore,
          date: score.date,
        })
        .where(eq(healthScores.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(healthScores).values(score).returning();
    return created;
  }

  async getLatestTeamHealth() {
    // Simple average of the latest score for each employee
    // In a real app, this would be a complex query. 
    // For MVP, we'll fetch all latest scores and average them in JS for simplicity, 
    // or just fetch all scores from the last 7 days.
    
    // Approximation: Get average of all scores from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentScores = await db.select()
      .from(healthScores)
      .where(gte(healthScores.date, sevenDaysAgo));

    if (recentScores.length === 0) {
      return { burnoutRisk: 0, engagementScore: 0, performanceScore: 0, workloadScore: 0 };
    }

    const total = recentScores.reduce((acc, curr) => ({
      burnoutRisk: acc.burnoutRisk + curr.burnoutRisk,
      engagementScore: acc.engagementScore + curr.engagementScore,
      performanceScore: acc.performanceScore + curr.performanceScore,
      workloadScore: acc.workloadScore + curr.workloadScore,
    }), { burnoutRisk: 0, engagementScore: 0, performanceScore: 0, workloadScore: 0 });

    return {
      burnoutRisk: Math.round(total.burnoutRisk / recentScores.length),
      engagementScore: Math.round(total.engagementScore / recentScores.length),
      performanceScore: Math.round(total.performanceScore / recentScores.length),
      workloadScore: Math.round(total.workloadScore / recentScores.length),
    };
  }
  
  async getTeamHealthTrend(days: number): Promise<HealthScore[]> {
     // This is a simplified "team trend" by just returning all scores. 
     // The frontend/API can aggregate by day.
     const startDate = new Date();
     startDate.setDate(startDate.getDate() - days);
     
     return await db.select()
       .from(healthScores)
       .where(gte(healthScores.date, startDate))
       .orderBy(healthScores.date);
  }

  // --- Alerts ---
  async getActiveAlerts(): Promise<(Alert & { employeeName: string })[]> {
    const result = await db.select({
      id: alerts.id,
      employeeId: alerts.employeeId,
      type: alerts.type,
      reason: alerts.reason,
      confidence: alerts.confidence,
      status: alerts.status,
      actionTaken: alerts.actionTaken,
      createdAt: alerts.createdAt,
      employeeName: employees.name,
    })
    .from(alerts)
    .innerJoin(employees, eq(alerts.employeeId, employees.id))
    .where(eq(alerts.status, 'active'));
    
    return result;
  }

  async getEmployeeAlerts(employeeId: number): Promise<Alert[]> {
    return await db.select()
      .from(alerts)
      .where(eq(alerts.employeeId, employeeId));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [newAlert] = await db.insert(alerts).values(alert).returning();
    return newAlert;
  }

  async resolveAlert(id: number): Promise<Alert | undefined> {
    const [updated] = await db.update(alerts)
      .set({ status: 'resolved', actionTaken: true })
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  // --- Insights ---
  async getInsights(): Promise<Insight[]> {
    return await db.select().from(insights).orderBy(desc(insights.createdAt));
  }

  async createInsight(insight: InsertInsight): Promise<Insight> {
    const [newInsight] = await db.insert(insights).values(insight).returning();
    return newInsight;
  }

  // --- Weekly Metrics ---
  async getWeeklyMetrics(employeeId: number): Promise<EmployeeWeeklyMetric[]> {
    return await db.select()
      .from(employeeWeeklyMetrics)
      .where(eq(employeeWeeklyMetrics.employeeId, employeeId))
      .orderBy(desc(employeeWeeklyMetrics.weekStart));
  }

  async getAllWeeklyMetrics(): Promise<EmployeeWeeklyMetric[]> {
    return await db.select()
      .from(employeeWeeklyMetrics)
      .orderBy(desc(employeeWeeklyMetrics.weekStart));
  }

  async createWeeklyMetrics(metrics: InsertEmployeeWeeklyMetric[]): Promise<EmployeeWeeklyMetric[]> {
    if (metrics.length === 0) return [];
    return await db.insert(employeeWeeklyMetrics).values(metrics).returning();
  }

  // --- ML Predictions ---
  async getLatestMlPredictions(): Promise<(EmployeeMlPrediction & { employeeName: string })[]> {
    const predictions = await db.select()
      .from(employeeMlPredictions)
      .orderBy(desc(employeeMlPredictions.createdAt));

    const latestByEmployee = new Map<number, EmployeeMlPrediction>();
    for (const prediction of predictions) {
      if (!latestByEmployee.has(prediction.employeeId)) {
        latestByEmployee.set(prediction.employeeId, prediction);
      }
    }

    const employeeList = await db.select().from(employees);
    const employeeMap = new Map(employeeList.map((emp) => [emp.id, emp.name]));

    return Array.from(latestByEmployee.values()).map((prediction) => ({
      ...prediction,
      employeeName: employeeMap.get(prediction.employeeId) ?? "Employee",
    }));
  }

  async getLatestMlPrediction(employeeId: number): Promise<EmployeeMlPrediction | undefined> {
    const [prediction] = await db.select()
      .from(employeeMlPredictions)
      .where(eq(employeeMlPredictions.employeeId, employeeId))
      .orderBy(desc(employeeMlPredictions.createdAt))
      .limit(1);
    return prediction;
  }

  async createMlPredictions(predictions: InsertEmployeeMlPrediction[]): Promise<EmployeeMlPrediction[]> {
    if (predictions.length === 0) return [];
    return await db.insert(employeeMlPredictions).values(predictions).returning();
  }
}

export const storage = new DatabaseStorage();

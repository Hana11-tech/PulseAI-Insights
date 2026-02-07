import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { computeHealthScoreFromMetric } from "./health-score";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8001";

  // --- Employees ---
  app.get(api.employees.list.path, async (req, res) => {
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.post(api.employees.create.path, async (req, res) => {
    const { name, role, department, email } = req.body || {};
    if (!name || !role || !department || !email) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const created = await storage.createEmployee({ name, role, department, email });
    res.status(201).json(created);
  });

  app.get(api.employees.get.path, async (req, res) => {
    const employee = await storage.getEmployee(Number(req.params.id));
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  });

  app.get(api.employees.getHistory.path, async (req, res) => {
    const history = await storage.getHealthScores(Number(req.params.id));
    res.json(history);
  });

  app.get(api.employees.getAlerts.path, async (req, res) => {
    const alerts = await storage.getEmployeeAlerts(Number(req.params.id));
    res.json(alerts);
  });

  // --- Alerts ---
  app.get(api.alerts.list.path, async (req, res) => {
    const alerts = await storage.getActiveAlerts();
    res.json(alerts);
  });

  app.post(api.alerts.resolve.path, async (req, res) => {
    const alert = await storage.resolveAlert(Number(req.params.id));
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json(alert);
  });

  // --- Insights ---
  app.get(api.insights.list.path, async (req, res) => {
    const insights = await storage.getInsights();
    res.json(insights);
  });

  app.post(api.insights.generate.path, async (req, res) => {
    const predictions = await storage.getLatestMlPredictions();
    if (predictions.length === 0) {
      return res.status(400).json({ message: "No predictions available to summarize." });
    }

    const counts = predictions.reduce(
      (acc, pred) => {
        if (pred.burnoutRisk === "High") acc.highBurnout += 1;
        if (pred.performanceTrend === "Declining") acc.decliningPerformance += 1;
        if (pred.growthPotential === "High-Potential") acc.highPotential += 1;
        return acc;
      },
      { highBurnout: 0, decliningPerformance: 0, highPotential: 0 }
    );

    const featureCounts = {
      burnout: new Map<string, number>(),
      performance: new Map<string, number>(),
      growth: new Map<string, number>(),
    };

    for (const pred of predictions) {
      const top = pred.topFeatures || {};
      for (const key of Object.keys(featureCounts) as Array<keyof typeof featureCounts>) {
        const values = (top as any)[key] || [];
        values.forEach((value: string) => {
          featureCounts[key].set(value, (featureCounts[key].get(value) || 0) + 1);
        });
      }
    }

    const topFeatures = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([feature]) => feature);

    const payload = {
      total_employees: predictions.length,
      high_burnout_count: counts.highBurnout,
      declining_performance_count: counts.decliningPerformance,
      high_potential_count: counts.highPotential,
      top_burnout_features: topFeatures(featureCounts.burnout),
      top_performance_features: topFeatures(featureCounts.performance),
      top_growth_features: topFeatures(featureCounts.growth),
    };

    const mlResponse = await fetch(`${mlServiceUrl}/insights/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!mlResponse.ok) {
      const detail = await mlResponse.text();
      return res.status(502).json({ message: "ML service error", detail });
    }

    const mlData = await mlResponse.json();
    const generated = Array.isArray(mlData.insights) ? mlData.insights : [];
    if (generated.length === 0) {
      return res.status(200).json([]);
    }

    const createdInsights = [];
    for (const insight of generated) {
      createdInsights.push(
        await storage.createInsight({
          title: insight.title,
          description: insight.description,
          type: insight.type || "team_shift",
          level: insight.level || "team",
        })
      );
    }

    res.json(createdInsights);
  });

  // --- Weekly Metrics ---
  app.post(api.metrics.weekly.create.path, async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body : [req.body];
    const normalized = payload.map((item) => ({
      ...item,
      weekStart: item.weekStart ? new Date(item.weekStart) : item.weekStart,
    }));
    const created = await storage.createWeeklyMetrics(normalized);
    for (const metric of created) {
      await storage.upsertHealthScore(computeHealthScoreFromMetric(metric));
    }
    res.status(201).json(created);
  });

  app.post(api.metrics.weekly.importCsv.path, async (req, res) => {
    const { csvText, weekStartAnchor, createMissingEmployees } = req.body || {};
    if (!csvText || typeof csvText !== "string") {
      return res.status(400).json({ message: "csvText is required." });
    }

    const anchor = new Date(weekStartAnchor || "2025-01-06");
    if (Number.isNaN(anchor.getTime())) {
      return res.status(400).json({ message: "Invalid weekStartAnchor." });
    }

    const lines = csvText.split(/\r?\n/).filter((line: string) => line.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV has no data rows." });
    }

    const headers = lines[0].split(",").map((h: string) => h.trim());
    const idx = (name: string) => headers.indexOf(name);
    const required = [
      "employee_id",
      "week",
      "tasks_assigned",
      "tasks_completed",
      "missed_deadlines",
      "meeting_hours",
      "collaboration_score",
      "engagement_score",
      "learning_hours",
    ];

    for (const name of required) {
      if (idx(name) === -1) {
        return res.status(400).json({ message: `Missing required column: ${name}` });
      }
    }

    const stretchIdx = idx("stretch_assignments");

    const rows = lines.slice(1).map((line: string) => {
      const values = line.split(",").map((v) => v.trim());
      return {
        employeeKey: values[idx("employee_id")],
        week: Number(values[idx("week")]),
        tasksAssigned: Number(values[idx("tasks_assigned")]),
        tasksCompleted: Number(values[idx("tasks_completed")]),
        missedDeadlines: Number(values[idx("missed_deadlines")]),
        meetingHours: Number(values[idx("meeting_hours")]),
        collaborationScore: Number(values[idx("collaboration_score")]),
        engagementScore: Number(values[idx("engagement_score")]),
        learningHours: Number(values[idx("learning_hours")]),
        stretchAssignments: stretchIdx >= 0 ? Number(values[stretchIdx]) : undefined,
      };
    });

    const employees = await storage.getEmployees();
    const byId = new Map(employees.map((emp) => [String(emp.id), emp]));
    const byName = new Map(employees.map((emp) => [emp.name.toLowerCase(), emp]));
    const byEmail = new Map(employees.map((emp) => [emp.email.toLowerCase(), emp]));

    const employeeMap = new Map<string, number>();
    let employeesCreated = 0;

    for (const key of Array.from(new Set(rows.map((r) => r.employeeKey)))) {
      const trimmed = String(key).trim();
      if (byId.has(trimmed)) {
        employeeMap.set(trimmed, Number(trimmed));
        continue;
      }

      const keyLower = trimmed.toLowerCase();
      const nameMatch = byName.get(keyLower);
      if (nameMatch) {
        employeeMap.set(trimmed, nameMatch.id);
        continue;
      }

      const emailGuess = trimmed.includes("@")
        ? trimmed
        : `${keyLower}@pulseai.local`;
      const emailMatch = byEmail.get(emailGuess.toLowerCase());
      if (emailMatch) {
        employeeMap.set(trimmed, emailMatch.id);
        continue;
      }

      if (createMissingEmployees === false) {
        return res.status(400).json({ message: `Unknown employee: ${trimmed}` });
      }

      const created = await storage.createEmployee({
        name: trimmed.includes("@") ? trimmed.split("@")[0] : `Employee ${trimmed}`,
        role: "Team Member",
        department: "Operations",
        email: emailGuess.toLowerCase(),
      });
      employeesCreated += 1;
      employeeMap.set(trimmed, created.id);
      byId.set(String(created.id), created);
      byName.set(created.name.toLowerCase(), created);
      byEmail.set(created.email.toLowerCase(), created);
    }

    const records = rows.map((row) => {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() + (row.week - 1) * 7);
      const stretchAssignments =
        typeof row.stretchAssignments === "number" && !Number.isNaN(row.stretchAssignments)
          ? row.stretchAssignments
          : Math.max(0, Math.min(3, Math.round((row.tasksAssigned - 15) / 5)));

      return {
        employeeId: employeeMap.get(row.employeeKey)!,
        weekStart: date,
        tasksAssigned: row.tasksAssigned,
        tasksCompleted: row.tasksCompleted,
        missedDeadlines: row.missedDeadlines,
        meetingHours: row.meetingHours,
        collaborationScore: row.collaborationScore,
        engagementScore: row.engagementScore,
        learningHours: row.learningHours,
        stretchAssignments,
      };
    });

    const inserted = await storage.createWeeklyMetrics(records);
    let healthScoresUpserted = 0;
    for (const metric of inserted) {
      await storage.upsertHealthScore(computeHealthScoreFromMetric(metric));
      healthScoresUpserted += 1;
    }

    res.json({
      insertedMetrics: inserted.length,
      employeesCreated,
      healthScoresUpserted,
    });
  });

  app.get(api.metrics.weekly.listByEmployee.path, async (req, res) => {
    const metrics = await storage.getWeeklyMetrics(Number(req.params.employeeId));
    res.json(metrics);
  });

  // --- ML Predictions ---
  async function buildPayloadForEmployee(employeeId: number) {
    const metrics = await storage.getWeeklyMetrics(employeeId);
    const window = metrics.slice(0, 4).reverse();
    if (window.length < 4) return null;
    return {
      employee_id: employeeId,
      weeks: window.map((week) => ({
        week_start: week.weekStart,
        tasks_assigned: week.tasksAssigned,
        tasks_completed: week.tasksCompleted,
        missed_deadlines: week.missedDeadlines,
        meeting_hours: week.meetingHours,
        collaboration_score: week.collaborationScore,
        engagement_score: week.engagementScore,
        learning_hours: week.learningHours,
        stretch_assignments: week.stretchAssignments,
      })),
    };
  }

  async function runMlBatch(batchPayload: any[]) {
    const now = Date.now();
    const cacheTtlMs = parseInt(process.env.ML_PREDICTION_CACHE_TTL_MS || "300000", 10);
    const recentlyCached: any[] = [];
    const toPredict: any[] = [];

    for (const payload of batchPayload) {
      const cached = await storage.getLatestMlPrediction(payload.employee_id);
      if (cached?.createdAt) {
        const ageMs = now - new Date(cached.createdAt).getTime();
        if (ageMs < cacheTtlMs) {
          recentlyCached.push(cached);
          continue;
        }
      }
      toPredict.push(payload);
    }

    if (toPredict.length === 0) {
      return { ok: true, processed: 0, saved: 0, skipped: recentlyCached.length };
    }
    const mlResponse = await fetch(`${mlServiceUrl}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees: toPredict }),
    });

    if (!mlResponse.ok) {
      const detail = await mlResponse.text();
      return { ok: false, detail };
    }

    const mlData = await mlResponse.json();
    const predictions = (mlData.results || []).map((result: any) => ({
      employeeId: result.employee_id,
      windowStart: new Date(result.window_start),
      windowEnd: new Date(result.window_end),
      burnoutRisk: result.burnout_risk,
      burnoutConfidence: result.burnout_confidence,
      performanceTrend: result.performance_trend,
      performanceConfidence: result.performance_confidence,
      growthPotential: result.growth_potential,
      growthConfidence: result.growth_confidence,
      topFeatures: {
        burnout: result.burnout_top_features || [],
        performance: result.performance_top_features || [],
        growth: result.growth_top_features || [],
      },
      recommendations: result.recommendations || [],
      explanation: result.explanation || "",
    }));

    const saved = await storage.createMlPredictions(predictions);
    return { ok: true, processed: predictions.length, saved: saved.length, skipped: recentlyCached.length };
  }

  app.post(api.ml.predict.path, async (req, res) => {
    const employeeIdParam = req.query.employeeId;
    if (employeeIdParam) {
      const employeeId = Number(employeeIdParam);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const payload = await buildPayloadForEmployee(employeeId);
      if (!payload) {
        return res.json({ processed: 0, skipped: 1, predictionsSaved: 0 });
      }

      const result = await runMlBatch([payload]);
      if (!result.ok) {
        return res.status(502).json({ message: "ML service error", detail: result.detail });
      }

      return res.json({ processed: result.processed, skipped: 0, predictionsSaved: result.saved });
    }

    const employees = await storage.getEmployees();
    let skipped = 0;

    const batchPayload = [];
    for (const employee of employees) {
      const payload = await buildPayloadForEmployee(employee.id);
      if (!payload) {
        skipped++;
        continue;
      }
      batchPayload.push(payload);
    }

    if (batchPayload.length === 0) {
      return res.json({ processed: 0, skipped, predictionsSaved: 0 });
    }

    const result = await runMlBatch(batchPayload);
    if (!result.ok) {
      return res.status(502).json({ message: "ML service error", detail: result.detail });
    }

    res.json({ processed: result.processed, skipped: skipped + (result.skipped || 0), predictionsSaved: result.saved });
  });

  app.post(api.ml.predictOne.path, async (req, res) => {
    const employeeId = Number(req.params.employeeId);
    const employee = await storage.getEmployee(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const payload = await buildPayloadForEmployee(employeeId);
    if (!payload) {
      return res.json({ processed: 0, skipped: 1, predictionsSaved: 0 });
    }

    const result = await runMlBatch([payload]);
    if (!result.ok) {
      return res.status(502).json({ message: "ML service error", detail: result.detail });
    }

    res.json({ processed: result.processed, skipped: result.skipped || 0, predictionsSaved: result.saved });
  });

  app.get(api.ml.predictions.list.path, async (req, res) => {
    const predictions = await storage.getLatestMlPredictions();
    res.json(predictions);
  });

  app.get(api.ml.predictions.get.path, async (req, res) => {
    const prediction = await storage.getLatestMlPrediction(Number(req.params.employeeId));
    if (!prediction) return res.status(404).json({ message: "Prediction not found" });
    res.json(prediction);
  });

  // --- Team Health ---
  app.get(api.team.health.path, async (req, res) => {
    const health = await storage.getLatestTeamHealth();
    const trendRaw = await storage.getTeamHealthTrend(14); // Last 2 weeks
    
    // Aggregating trend data by day for the chart
    const trendMap = new Map<string, { count: number, burnout: number, performance: number }>();
    
    trendRaw.forEach(h => {
      const dateStr = new Date(h.date).toISOString().split('T')[0];
      const existing = trendMap.get(dateStr) || { count: 0, burnout: 0, performance: 0 };
      existing.count++;
      existing.burnout += h.burnoutRisk;
      existing.performance += h.performanceScore;
      trendMap.set(dateStr, existing);
    });

    const trendData = Array.from(trendMap.entries()).map(([date, data]) => ({
      date,
      burnout: Math.round(data.burnout / data.count),
      performance: Math.round(data.performance / data.count),
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Determine status strings based on scores
    let burnoutRisk = "Low";
    if (health.burnoutRisk > 70) burnoutRisk = "High";
    else if (health.burnoutRisk > 40) burnoutRisk = "Medium";

    let growthPotential = "Steady";
    if (health.performanceScore > 80 && health.engagementScore > 80) growthPotential = "Emerging";
    else if (health.performanceScore < 50) growthPotential = "Stalled";

    let engagementHealth = "Balanced";
    if (health.workloadScore > 80) engagementHealth = "Overloaded";
    else if (health.engagementScore < 40) engagementHealth = "Disconnected";

    res.json({
      healthScore: Math.round((health.engagementScore + health.performanceScore) / 2),
      burnoutRisk,
      growthPotential,
      engagementHealth,
      trendData
    });
  });

  app.post(api.team.recompute.path, async (req, res) => {
    const allMetrics = await storage.getAllWeeklyMetrics();
    const updated = [];
    for (const metric of allMetrics) {
      updated.push(await storage.upsertHealthScore(computeHealthScoreFromMetric(metric)));
    }
    res.json({ updated: updated.length });
  });

  if (process.env.SEED_DEMO_DATA === "1") {
    seedDatabase();
  }

  return httpServer;
}

async function seedDatabase() {
  const existingEmployees = await storage.getEmployees();
  if (existingEmployees.length > 0) return;

  console.log("Seeding database...");

  const employeesData = [
    { name: "Alice Chen", role: "Senior Engineer", department: "Engineering", email: "alice@pulse.ai" },
    { name: "Bob Smith", role: "Product Manager", department: "Product", email: "bob@pulse.ai" },
    { name: "Charlie Kim", role: "Designer", department: "Design", email: "charlie@pulse.ai" },
    { name: "Diana Prince", role: "Engineer", department: "Engineering", email: "diana@pulse.ai" },
    { name: "Evan Wright", role: "Data Scientist", department: "Data", email: "evan@pulse.ai" },
  ];

  const createdEmployees = [];
  for (const emp of employeesData) {
    createdEmployees.push(await storage.createEmployee(emp));
  }

  // Generate 30 days of history for each employee
  const now = new Date();
  for (const emp of createdEmployees) {
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Simulate some trends
      let baseBurnout = 20;
      let basePerformance = 80;
      
      if (emp.name === "Diana Prince" && i < 10) {
        // Diana has increasing burnout recently
        baseBurnout = 20 + (10 - i) * 5; 
        basePerformance = 80 - (10 - i) * 2;
      }

      await storage.addHealthScore({
        employeeId: emp.id,
        burnoutRisk: Math.min(100, Math.max(0, baseBurnout + Math.floor(Math.random() * 10 - 5))),
        engagementScore: Math.min(100, Math.max(0, 75 + Math.floor(Math.random() * 20 - 10))),
        performanceScore: Math.min(100, Math.max(0, basePerformance + Math.floor(Math.random() * 10 - 5))),
        workloadScore: Math.min(100, Math.max(0, 60 + Math.floor(Math.random() * 20 - 10))),
        date: date,
      });
    }
  }

  // Create Alerts
  const diana = createdEmployees.find(e => e.name === "Diana Prince");
  if (diana) {
    await storage.createAlert({
      employeeId: diana.id,
      type: "Burnout Risk",
      reason: "Workload has increased by 40% in the last 2 weeks while engagement dropped.",
      confidence: "High",
      status: "active",
    });
  }

  const evan = createdEmployees.find(e => e.name === "Evan Wright");
  if (evan) {
    await storage.createAlert({
      employeeId: evan.id,
      type: "Emerging Talent",
      reason: "Consistently high performance and peer recognition over the last month.",
      confidence: "Medium",
      status: "active",
    });
  }

  // Create Insights
  await storage.createInsight({
    title: "Engineering Team Workload Spike",
    description: "The engineering team's average workload score has increased by 15% this week due to the upcoming release.",
    type: "team_shift",
    level: "team",
  });

  await storage.createInsight({
    title: "Meeting Overload Detected",
    description: "3 employees are spending >20 hours in meetings per week, correlating with lower focus time.",
    type: "pattern",
    level: "team",
  });

  console.log("Database seeded successfully!");
}

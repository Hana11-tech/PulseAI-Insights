import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { asc, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { employees, employeeWeeklyMetrics, healthScores } from "../shared/schema";
import { computeHealthScoreFromMetric } from "../server/health-score";

type CsvRow = {
  employeeKey: string;
  week: number;
  tasksAssigned: number;
  tasksCompleted: number;
  missedDeadlines: number;
  meetingHours: number;
  collaborationScore: number;
  engagementScore: number;
  learningHours: number;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CSV_PATH =
  process.env.CSV_PATH || path.resolve(ROOT, "synthetic_employee_burnout_balanced.csv");
const WEEK_START_ANCHOR = process.env.WEEK_START_ANCHOR || "2025-01-06";
const CLEAR_EXISTING = process.env.CLEAR_EXISTING === "1";

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
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
      throw new Error(`Missing required column in CSV: ${name}`);
    }
  }

  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const values = line.split(",").map((v) => v.trim());
    if (values.length < headers.length) continue;
    rows.push({
      employeeKey: values[idx("employee_id")],
      week: Number(values[idx("week")]),
      tasksAssigned: Number(values[idx("tasks_assigned")]),
      tasksCompleted: Number(values[idx("tasks_completed")]),
      missedDeadlines: Number(values[idx("missed_deadlines")]),
      meetingHours: Number(values[idx("meeting_hours")]),
      collaborationScore: Number(values[idx("collaboration_score")]),
      engagementScore: Number(values[idx("engagement_score")]),
      learningHours: Number(values[idx("learning_hours")]),
    });
  }
  return rows;
}

function resolveWeekStart(weekNumber: number, anchor: Date) {
  const date = new Date(anchor);
  date.setDate(anchor.getDate() + (weekNumber - 1) * 7);
  return date;
}

function computeStretchAssignments(tasksAssigned: number): number {
  const raw = Math.round((tasksAssigned - 15) / 5);
  return Math.max(0, Math.min(3, raw));
}

async function ensureEmployees(employeeKeys: string[]) {
  const existing = await db.select().from(employees).orderBy(asc(employees.id));
  if (existing.length < employeeKeys.length) {
    const missingKeys = employeeKeys.slice(existing.length);
    if (missingKeys.length > 0) {
      await db
        .insert(employees)
        .values(
          missingKeys.map((key) => ({
            name: `Employee ${key}`,
            role: "Team Member",
            department: "Operations",
            email: `${key.toLowerCase()}@pulseai.local`,
          }))
        )
        .returning();
    }
  }

  const finalEmployees = await db.select().from(employees).orderBy(asc(employees.id));
  const map = new Map<string, number>();
  employeeKeys.forEach((key, index) => {
    const emp = finalEmployees[index];
    if (!emp) throw new Error(`No employee available for ${key}`);
    map.set(key, emp.id);
  });

  return map;
}

async function main() {
  const text = await fs.readFile(CSV_PATH, "utf-8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.log("No rows found in CSV. Nothing to import.");
    return;
  }

  const employeeKeys = Array.from(new Set(rows.map((r) => r.employeeKey))).sort();
  const employeeMap = await ensureEmployees(employeeKeys);

  if (CLEAR_EXISTING) {
    const ids = Array.from(employeeMap.values());
    await db.delete(employeeWeeklyMetrics).where(inArray(employeeWeeklyMetrics.employeeId, ids));
    await db.delete(healthScores).where(inArray(healthScores.employeeId, ids));
  }

  const anchor = new Date(WEEK_START_ANCHOR);
  if (Number.isNaN(anchor.getTime())) {
    throw new Error(`Invalid WEEK_START_ANCHOR: ${WEEK_START_ANCHOR}`);
  }

  const records = rows.map((row) => ({
    employeeId: employeeMap.get(row.employeeKey)!,
    weekStart: resolveWeekStart(row.week, anchor),
    tasksAssigned: row.tasksAssigned,
    tasksCompleted: row.tasksCompleted,
    missedDeadlines: row.missedDeadlines,
    meetingHours: row.meetingHours,
    collaborationScore: row.collaborationScore,
    engagementScore: row.engagementScore,
    learningHours: row.learningHours,
    stretchAssignments: computeStretchAssignments(row.tasksAssigned),
  }));

  const inserted = await db.insert(employeeWeeklyMetrics).values(records).returning();
  const healthRecords = inserted.map((metric) => computeHealthScoreFromMetric(metric));
  if (healthRecords.length > 0) {
    await db.insert(healthScores).values(healthRecords);
  }

  console.log(`Imported ${inserted.length} weekly metric rows.`);
  console.log("Employee mapping (CSV ID -> DB ID):");
  for (const [key, id] of employeeMap.entries()) {
    console.log(`  ${key} -> ${id}`);
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});

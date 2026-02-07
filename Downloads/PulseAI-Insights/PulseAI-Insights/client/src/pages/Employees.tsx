import { useMemo, useState } from "react";
import { useCreateEmployee, useCreateWeeklyMetrics, useEmployees, useImportWeeklyCsv, useMlPredictions, useRunMlPredictions } from "@/hooks/use-pulse-data";
import { useSelectedEmployee } from "@/contexts/selected-employee";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export default function Employees() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: predictions = [] } = useMlPredictions();
  const runMl = useRunMlPredictions();
  const createEmployee = useCreateEmployee();
  const createWeeklyMetrics = useCreateWeeklyMetrics();
  const importCsv = useImportWeeklyCsv();
  const { selectedEmployeeId, setSelectedEmployeeId } = useSelectedEmployee();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    department: "",
    email: "",
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [weekAnchor, setWeekAnchor] = useState("2025-01-06");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [weekInputs, setWeekInputs] = useState(
    Array.from({ length: 4 }).map(() => ({
      tasksAssigned: "",
      tasksCompleted: "",
      missedDeadlines: "",
      meetingHours: "",
      collaborationScore: "",
      engagementScore: "",
      learningHours: "",
      stretchAssignments: "",
    }))
  );

  const predictionMap = useMemo(() => {
    const map = new Map<number, (typeof predictions)[number]>();
    predictions.forEach((pred) => map.set(pred.employeeId, pred));
    return map;
  }, [predictions]);

  const filtered = useMemo(() => {
    if (!query.trim()) return employees;
    const q = query.trim().toLowerCase();
    return employees.filter((emp) => {
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q)
      );
    });
  }, [employees, query]);

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading employees...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">Employees</h2>
          <p className="text-muted-foreground mt-1">
            Select an employee to view cached predictions and refresh insights.
          </p>
        </div>
        <Input
          placeholder="Search by name, role, department, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full md:max-w-xs"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-lg">Add Employee + 4 Weeks Metrics</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <Input
              placeholder="Name"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            />
            <Input
              placeholder="Role"
              value={newEmployee.role}
              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
            />
            <Input
              placeholder="Department"
              value={newEmployee.department}
              onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
            />
          </div>
          <Input
            placeholder="Week 1 start date (YYYY-MM-DD)"
            value={weekAnchor}
            onChange={(e) => setWeekAnchor(e.target.value)}
          />
          <div className="space-y-4">
            {weekInputs.map((week, index) => (
              <div key={index} className="border border-border/60 rounded-xl p-4 bg-secondary/10">
                <div className="text-sm font-semibold text-foreground mb-3">Week {index + 1}</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="text-xs text-muted-foreground">
                    Tasks assigned
                    <Input
                      type="number"
                      placeholder="e.g. 22"
                      value={week.tasksAssigned}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].tasksAssigned = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Tasks completed
                    <Input
                      type="number"
                      placeholder="e.g. 20"
                      value={week.tasksCompleted}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].tasksCompleted = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Missed deadlines
                    <Input
                      type="number"
                      placeholder="e.g. 1"
                      value={week.missedDeadlines}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].missedDeadlines = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Meeting hours
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 6.5"
                      value={week.meetingHours}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].meetingHours = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Collaboration score (0-1)
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.78"
                      value={week.collaborationScore}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].collaborationScore = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Engagement score (0-1)
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.84"
                      value={week.engagementScore}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].engagementScore = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Learning hours
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 3.0"
                      value={week.learningHours}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].learningHours = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Stretch assignments
                    <Input
                      type="number"
                      placeholder="e.g. 1"
                      value={week.stretchAssignments}
                      onChange={(e) => {
                        const updated = [...weekInputs];
                        updated[index].stretchAssignments = e.target.value;
                        setWeekInputs(updated);
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={async () => {
              setImportResult(null);
              setCreateResult(null);
              const anchor = new Date(weekAnchor);
              if (Number.isNaN(anchor.getTime())) {
                setCreateResult("Invalid week 1 date.");
                return;
              }
              if (!newEmployee.name || !newEmployee.role || !newEmployee.department || !newEmployee.email) {
                setCreateResult("Please fill all employee fields.");
                return;
              }

              const numericWeeks = weekInputs.map((week) => ({
                tasksAssigned: Number(week.tasksAssigned),
                tasksCompleted: Number(week.tasksCompleted),
                missedDeadlines: Number(week.missedDeadlines),
                meetingHours: Number(week.meetingHours),
                collaborationScore: Number(week.collaborationScore),
                engagementScore: Number(week.engagementScore),
                learningHours: Number(week.learningHours),
                stretchAssignments: Number(week.stretchAssignments),
              }));

              if (numericWeeks.some((week) => Object.values(week).some((value) => Number.isNaN(value)))) {
                setCreateResult("Please enter all weekly metrics as numbers.");
                return;
              }

              const createdEmployee = await createEmployee.mutateAsync(newEmployee);
              const metricsPayload = numericWeeks.map((week, index) => {
                const weekStart = new Date(anchor);
                weekStart.setDate(anchor.getDate() + index * 7);
                return {
                  employeeId: createdEmployee.id,
                  weekStart: weekStart.toISOString(),
                  tasksAssigned: week.tasksAssigned,
                  tasksCompleted: week.tasksCompleted,
                  missedDeadlines: week.missedDeadlines,
                  meetingHours: week.meetingHours,
                  collaborationScore: week.collaborationScore,
                  engagementScore: week.engagementScore,
                  learningHours: week.learningHours,
                  stretchAssignments: week.stretchAssignments,
                };
              });

              await createWeeklyMetrics.mutateAsync(metricsPayload);
              const result = await runMl.mutateAsync({ employeeId: createdEmployee.id });

              setSelectedEmployeeId(createdEmployee.id);
              setNewEmployee({ name: "", role: "", department: "", email: "" });
              setWeekInputs(
                Array.from({ length: 4 }).map(() => ({
                  tasksAssigned: "",
                  tasksCompleted: "",
                  missedDeadlines: "",
                  meetingHours: "",
                  collaborationScore: "",
                  engagementScore: "",
                  learningHours: "",
                  stretchAssignments: "",
                }))
              );
              setCreateResult(
                `Employee created. Predictions saved: ${result.predictionsSaved ?? 0}.`
              );
              setLocation("/me");
            }}
            disabled={createEmployee.isPending || createWeeklyMetrics.isPending || runMl.isPending}
          >
            {createEmployee.isPending || createWeeklyMetrics.isPending || runMl.isPending
              ? "Clicking..."
              : "Click Add + Predict"}
          </Button>
          {createResult && (
            <div className="text-xs text-muted-foreground">{createResult}</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-lg">Import Weekly Metrics (CSV)</h3>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
          />
          <Input
            placeholder="Week start anchor (YYYY-MM-DD)"
            value={weekAnchor}
            onChange={(e) => setWeekAnchor(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!csvFile) return;
              setImportResult(null);
              const text = await csvFile.text();
              importCsv.mutate(
                { csvText: text, weekStartAnchor: weekAnchor },
                {
                  onSuccess: (result) => {
                    setImportResult(
                      `Imported ${result.insertedMetrics} rows, created ${result.employeesCreated} employees.`
                    );
                  },
                }
              );
            }}
            disabled={importCsv.isPending || !csvFile}
          >
            {importCsv.isPending ? "Clicking..." : "Click Import CSV"}
          </Button>
          {importResult && (
            <div className="text-xs text-muted-foreground">{importResult}</div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-sm">
            No employees matched your search.
          </div>
        ) : (
          filtered.map((emp) => {
            const prediction = predictionMap.get(emp.id);
            const isSelected = emp.id === selectedEmployeeId;
            const updatedAt = prediction?.createdAt
              ? new Date(prediction.createdAt).toLocaleString()
              : "No prediction yet";

            return (
              <div
                key={emp.id}
                className={cn(
                  "bg-card border border-border rounded-2xl p-5 shadow-sm transition-all",
                  isSelected && "border-primary/50 shadow-primary/10"
                )}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{emp.name}</h3>
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {emp.role} • {emp.department} • {emp.email}
                    </p>
                    <p className="text-xs text-muted-foreground">Last updated: {updatedAt}</p>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>Burnout</span>
                      <span className="text-sm font-semibold text-foreground">
                        {prediction?.burnoutRisk ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>Performance</span>
                      <span className="text-sm font-semibold text-foreground">
                        {prediction?.performanceTrend ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col text-xs text-muted-foreground">
                      <span>Growth</span>
                      <span className="text-sm font-semibold text-foreground">
                        {prediction?.growthPotential ?? "—"}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRefreshingId(emp.id);
                        runMl.mutate(
                          { employeeId: emp.id },
                          { onSettled: () => setRefreshingId(null) }
                        );
                      }}
                      disabled={refreshingId === emp.id}
                    >
                      {refreshingId === emp.id ? "Clicking..." : "Click AI"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                        setLocation("/me");
                      }}
                    >
                      View My Pulse
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                        setLocation(`/employee/${emp.id}`);
                      }}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

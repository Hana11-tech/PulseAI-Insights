import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type Alert } from "@shared/schema";

// --- EMPLOYEES ---
export function useEmployees() {
  return useQuery({
    queryKey: [api.employees.list.path],
    queryFn: async () => {
      const res = await fetch(api.employees.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return api.employees.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; role: string; department: string; email: string }) => {
      const res = await fetch(api.employees.create.path, {
        method: api.employees.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create employee");
      return api.employees.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });
}

export function useEmployee(id: number) {
  return useQuery({
    queryKey: [api.employees.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.employees.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) throw new Error("Employee not found");
      if (!res.ok) throw new Error("Failed to fetch employee");
      return api.employees.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useEmployeeHistory(id: number) {
  return useQuery({
    queryKey: [api.employees.getHistory.path, id],
    queryFn: async () => {
      const url = buildUrl(api.employees.getHistory.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return api.employees.getHistory.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useEmployeeAlerts(id: number) {
  return useQuery({
    queryKey: [api.employees.getAlerts.path, id],
    queryFn: async () => {
      const url = buildUrl(api.employees.getAlerts.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return api.employees.getAlerts.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// --- ALERTS ---
export function useActiveAlerts() {
  return useQuery({
    queryKey: [api.alerts.list.path],
    queryFn: async () => {
      const res = await fetch(api.alerts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return api.alerts.list.responses[200].parse(await res.json());
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const url = buildUrl(api.alerts.resolve.path, { id });
      const res = await fetch(url, {
        method: api.alerts.resolve.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to resolve alert");
      return api.alerts.resolve.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.alerts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.employees.getAlerts.path] });
    },
  });
}

// --- INSIGHTS ---
export function useInsights() {
  return useQuery({
    queryKey: [api.insights.list.path],
    queryFn: async () => {
      const res = await fetch(api.insights.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch insights");
      return api.insights.list.responses[200].parse(await res.json());
    },
  });
}

export function useGenerateInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.insights.generate.path, {
        method: api.insights.generate.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate insights");
      return api.insights.generate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.insights.list.path] });
    },
  });
}

// --- TEAM HEALTH ---
export function useTeamHealth() {
  return useQuery({
    queryKey: [api.team.health.path],
    queryFn: async () => {
      const res = await fetch(api.team.health.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch team health");
      return api.team.health.responses[200].parse(await res.json());
    },
  });
}

// --- ML Predictions ---
export function useMlPredictions() {
  return useQuery({
    queryKey: [api.ml.predictions.list.path],
    queryFn: async () => {
      const res = await fetch(api.ml.predictions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ML predictions");
      return api.ml.predictions.list.responses[200].parse(await res.json());
    },
  });
}

export function useMlPrediction(employeeId: number) {
  return useQuery({
    queryKey: [api.ml.predictions.get.path, employeeId],
    queryFn: async () => {
      const url = buildUrl(api.ml.predictions.get.path, { employeeId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch ML prediction");
      return api.ml.predictions.get.responses[200].parse(await res.json());
    },
    enabled: !!employeeId,
  });
}

export function useRunMlPredictions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId }: { employeeId?: number } = {}) => {
      const path = employeeId
        ? buildUrl(api.ml.predictOne.path, { employeeId })
        : api.ml.predict.path;
      const res = await fetch(path, {
        method: api.ml.predict.method,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to run ML predictions");
      const schema = employeeId
        ? api.ml.predictOne.responses[200]
        : api.ml.predict.responses[200];
      return schema.parse(await res.json());
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.ml.predictions.list.path] });
      if (variables?.employeeId) {
        queryClient.invalidateQueries({
          queryKey: [api.ml.predictions.get.path, variables.employeeId],
        });
      }
    },
  });
}

export function useCreateWeeklyMetrics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employeeId: number;
      weekStart: string;
      tasksAssigned: number;
      tasksCompleted: number;
      missedDeadlines: number;
      meetingHours: number;
      collaborationScore: number;
      engagementScore: number;
      learningHours: number;
      stretchAssignments: number;
    }[]) => {
      const res = await fetch(api.metrics.weekly.create.path, {
        method: api.metrics.weekly.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create weekly metrics");
      return api.metrics.weekly.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.metrics.weekly.listByEmployee.path] });
      queryClient.invalidateQueries({ queryKey: [api.team.health.path] });
    },
  });
}

export function useImportWeeklyCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { csvText: string; weekStartAnchor?: string; createMissingEmployees?: boolean }) => {
      const res = await fetch(api.metrics.weekly.importCsv.path, {
        method: api.metrics.weekly.importCsv.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to import CSV");
      return api.metrics.weekly.importCsv.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.metrics.weekly.listByEmployee.path] });
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.team.health.path] });
    },
  });
}

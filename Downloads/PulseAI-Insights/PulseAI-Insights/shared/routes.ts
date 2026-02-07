import { z } from 'zod';
import { 
  insertEmployeeSchema, 
  insertHealthScoreSchema, 
  insertAlertSchema, 
  insertInsightSchema,
  employees,
  healthScores,
  alerts,
  insights,
  employeeWeeklyMetrics,
  employeeMlPredictions
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

const weeklyMetricSchema = z.object({
  employeeId: z.number(),
  weekStart: z.string(),
  tasksAssigned: z.number(),
  tasksCompleted: z.number(),
  missedDeadlines: z.number(),
  meetingHours: z.number(),
  collaborationScore: z.number(),
  engagementScore: z.number(),
  learningHours: z.number(),
  stretchAssignments: z.number(),
});

const mlPredictionSchema = z.object({
  employeeId: z.number(),
  employeeName: z.string().optional(),
  windowStart: z.string(),
  windowEnd: z.string(),
  burnoutRisk: z.string(),
  burnoutConfidence: z.number(),
  performanceTrend: z.string(),
  performanceConfidence: z.number(),
  growthPotential: z.string(),
  growthConfidence: z.number(),
  topFeatures: z.record(z.array(z.string())),
  recommendations: z.array(z.string()),
  explanation: z.string(),
  createdAt: z.string().optional(),
});

export const api = {
  employees: {
    list: {
      method: 'GET' as const,
      path: '/api/employees' as const,
      responses: {
        200: z.array(z.custom<typeof employees.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/employees' as const,
      input: insertEmployeeSchema,
      responses: {
        201: z.custom<typeof employees.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/employees/:id' as const,
      responses: {
        200: z.custom<typeof employees.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    getHistory: {
      method: 'GET' as const,
      path: '/api/employees/:id/history' as const,
      responses: {
        200: z.array(z.custom<typeof healthScores.$inferSelect>()),
      },
    },
    getAlerts: {
      method: 'GET' as const,
      path: '/api/employees/:id/alerts' as const,
      responses: {
        200: z.array(z.custom<typeof alerts.$inferSelect>()),
      },
    },
  },
  alerts: {
    list: {
      method: 'GET' as const,
      path: '/api/alerts' as const, // All active alerts for manager
      responses: {
        200: z.array(z.custom<typeof alerts.$inferSelect & { employeeName: string }>()),
      },
    },
    resolve: {
      method: 'POST' as const,
      path: '/api/alerts/:id/resolve' as const,
      input: z.object({ action: z.string() }), // Just for logging what happened
      responses: {
        200: z.custom<typeof alerts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  insights: {
    list: {
      method: 'GET' as const,
      path: '/api/insights' as const,
      responses: {
        200: z.array(z.custom<typeof insights.$inferSelect>()),
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/insights/generate' as const,
      responses: {
        200: z.array(z.custom<typeof insights.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
  },
  team: {
    health: {
      method: 'GET' as const,
      path: '/api/team/health' as const,
      responses: {
        200: z.object({
          healthScore: z.number(),
          burnoutRisk: z.string(), // Low, Medium, High
          growthPotential: z.string(), // Emerging, Steady, Stalled
          engagementHealth: z.string(), // Balanced, Overloaded, Disconnected
          trendData: z.array(z.object({
            date: z.string(),
            burnout: z.number(),
            performance: z.number(),
          })),
        }),
      },
    },
    recompute: {
      method: 'POST' as const,
      path: '/api/team/health/recompute' as const,
      responses: {
        200: z.object({
          updated: z.number(),
        }),
      },
    },
  },
  metrics: {
    weekly: {
      create: {
        method: 'POST' as const,
        path: '/api/metrics/weekly' as const,
        input: z.union([weeklyMetricSchema, z.array(weeklyMetricSchema)]),
        responses: {
          201: z.array(z.custom<typeof employeeWeeklyMetrics.$inferSelect>()),
        },
      },
      importCsv: {
        method: 'POST' as const,
        path: '/api/metrics/weekly/import-csv' as const,
        input: z.object({
          csvText: z.string(),
          weekStartAnchor: z.string().optional(),
          createMissingEmployees: z.boolean().optional(),
        }),
        responses: {
          200: z.object({
            insertedMetrics: z.number(),
            employeesCreated: z.number(),
            healthScoresUpserted: z.number(),
          }),
        },
      },
      listByEmployee: {
        method: 'GET' as const,
        path: '/api/metrics/weekly/:employeeId' as const,
        responses: {
          200: z.array(z.custom<typeof employeeWeeklyMetrics.$inferSelect>()),
        },
      },
    },
  },
  ml: {
    predict: {
      method: 'POST' as const,
      path: '/api/ml/predict' as const,
      responses: {
        200: z.object({
          processed: z.number(),
          skipped: z.number(),
          predictionsSaved: z.number(),
        }),
      },
    },
    predictOne: {
      method: 'POST' as const,
      path: '/api/ml/predict/:employeeId' as const,
      responses: {
        200: z.object({
          processed: z.number(),
          skipped: z.number(),
          predictionsSaved: z.number(),
        }),
        404: errorSchemas.notFound,
      },
    },
    predictions: {
      list: {
        method: 'GET' as const,
        path: '/api/ml/predictions' as const,
        responses: {
          200: z.array(mlPredictionSchema),
        },
      },
      get: {
        method: 'GET' as const,
        path: '/api/ml/predictions/:employeeId' as const,
        responses: {
          200: mlPredictionSchema,
          404: errorSchemas.notFound,
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

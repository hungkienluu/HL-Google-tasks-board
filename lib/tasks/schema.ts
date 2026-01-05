import { z } from "zod";

export const urgencyLevels = ["high", "medium", "low"] as const;
export type UrgencyLevel = (typeof urgencyLevels)[number];

export const routingListKeys = [
  "default",
  "family",
  "homeImprovement",
  "homeMaintenance",
  "square"
] as const;

export type RoutingListKey = (typeof routingListKeys)[number];

export const ParsedIntentSchema = z.object({
  targetList: z.enum(routingListKeys),
  urgency: z.enum(urgencyLevels)
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  status: z.enum(["needsAction", "completed"]).default("needsAction"),
  position: z.string().optional(),
  due: z.string().optional(),
  updated: z.string().optional(),
  listId: z.string(),
  targetList: z.enum(routingListKeys),
  urgency: z.enum(urgencyLevels)
});

export type Task = z.infer<typeof TaskSchema>;

export type ListRoutingRule = {
  key: RoutingListKey;
  label: string;
  tasklistId?: string;
  matchers: (string | RegExp)[];
};

export const listRoutingCatalog: ListRoutingRule[] = [
  {
    key: "family",
    label: "Family",
    tasklistId: process.env.FAMILY_TASKLIST_ID,
    matchers: ["family", /👨‍👩‍👧‍👦/i, /👪/]
  },
  {
    key: "homeImprovement",
    label: "Home Improvement",
    tasklistId: process.env.HOME_IMPROVEMENT_TASKLIST_ID,
    matchers: ["home improvement", /🛠️/]
  },
  {
    key: "homeMaintenance",
    label: "Home Maintenance",
    tasklistId: process.env.HOME_MAINTENANCE_TASKLIST_ID,
    matchers: ["home maintenance", /🧽/, /🧰/]
  },
  {
    key: "square",
    label: "Square",
    tasklistId: process.env.SQUARE_TASKLIST_ID,
    matchers: ["square", /🏢/]
  }
];

export const urgencyKeywords: Record<UrgencyLevel, (string | RegExp)[]> = {
  high: ["this week", /🔥/, /urgent/i, /today/i],
  medium: ["next week", /soon/i, /upcoming/i],
  low: ["later", /someday/i, /eventually/i, /🧊/]
};

export type TaskListSummary = {
  id: string;
  title: string;
  isDefault?: boolean;
};

export type TaskListWithTasks = TaskListSummary & { tasks: Task[] };

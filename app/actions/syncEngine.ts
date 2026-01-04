"use server";

import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { describeIntent, parseTaskIntent } from "@/lib/tasks/parser";
import { listRoutingCatalog, type Task, type TaskListSummary, type TaskListWithTasks } from "@/lib/tasks/schema";

const DEFAULT_LIST_ID = process.env.DEFAULT_TASKLIST_ID ?? "@default";

type ResolvedListMap = Map<string, string>;
type Tasklist = { id?: string | null; title?: string | null };

async function listAllTasklists(tasksClient: Awaited<ReturnType<typeof getAuthorizedTasksClient>>) {
  const available: Tasklist[] = [];
  let pageToken: string | undefined;

  do {
    const response = await tasksClient.tasklists.list({ pageToken });
    available.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return available;
}

function normalizeDueDate(due?: string | null) {
  if (!due) return undefined;

  const [datePart] = due.split("T");
  if (!datePart) return undefined;

  const normalized = new Date(`${datePart}T00:00:00.000Z`);
  return Number.isNaN(normalized.getTime()) ? undefined : normalized.toISOString();
}

function normalizeCompletedTimestamp(completed?: string | null) {
  if (!completed) return new Date().toISOString();

  const parsed = new Date(completed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function resolveTasklists(tasksClient: Awaited<ReturnType<typeof getAuthorizedTasksClient>>) {
  const available = await listAllTasklists(tasksClient);
  const normalizedTitle = (value?: string | null) => value?.trim().toLowerCase();
  const matchesList = (list: Tasklist, candidate?: string | null) =>
    !!candidate && (list.id === candidate || normalizedTitle(list.title) === normalizedTitle(candidate));

  const resolved: ResolvedListMap = new Map();
  for (const rule of listRoutingCatalog) {
    const envId = rule.tasklistId;
    const matched = available.find((list) => matchesList(list, envId) || matchesList(list, rule.label));
    if (matched?.id) {
      resolved.set(rule.key, matched.id);
    }
  }

  const defaultMatch = available.find(
    (list) => matchesList(list, DEFAULT_LIST_ID) || matchesList(list, "My Tasks") || list.id === "@default"
  );
  if (!defaultMatch?.id) {
    throw new Error(
      "Unable to resolve your default Google Tasks list. Set DEFAULT_TASKLIST_ID to a valid list ID or ensure your account has a 'My Tasks' list."
    );
  }
  resolved.set("default", defaultMatch.id);
  return { resolved, available };
}

export type TaskSnapshot = {
  id: string;
  title: string;
  status: Task["status"];
  due?: string;
  updated?: string;
  notes?: string;
};

async function getAuthorizedTasksClient() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken
  });

  return google.tasks({ version: "v1", auth: oauth2Client });
}

export async function syncDefaultList(): Promise<{ moved: number; inspected: number }> {
  const tasksClient = await getAuthorizedTasksClient();
  const { resolved } = await resolveTasklists(tasksClient);
  const defaultListId = resolved.get("default") ?? DEFAULT_LIST_ID;
  const tasksResponse = await tasksClient.tasks.list({ tasklist: defaultListId });
  const tasks = tasksResponse.data.items ?? [];

  let moved = 0;
  for (const task of tasks) {
    if (!task.id || !task.title) continue;

    const intent = parseTaskIntent(task.title);
    const destinationListId = resolved.get(intent.targetList);

    if (!destinationListId || destinationListId === defaultListId) continue;

    const notes = [task.notes ?? "", describeIntent(intent)].filter(Boolean).join("\n");

    try {
      await tasksClient.tasks.insert({
        tasklist: destinationListId,
        requestBody: {
          title: task.title,
          notes,
          status: task.status,
          due: normalizeDueDate(task.due),
          completed: task.status === "completed" ? normalizeCompletedTimestamp(task.completed) : undefined
        }
      });

      await tasksClient.tasks.delete({
        tasklist: defaultListId,
        task: task.id
      });

      moved += 1;
    } catch (error) {
      console.error(`Failed to move task '${task.title}' to list ${destinationListId}`, error);
      continue;
    }
  }

  revalidatePath("/");
  return { moved, inspected: tasks.length };
}

export async function bulkArchiveCompleted(): Promise<number> {
  const tasksClient = await getAuthorizedTasksClient();
  const { resolved } = await resolveTasklists(tasksClient);
  let archived = 0;

  for (const listRule of listRoutingCatalog) {
    const listId = resolved.get(listRule.key);
    if (listId) {
      await tasksClient.tasks.clear({ tasklist: listId });
      archived += 1;
    }
  }

  const defaultListId = resolved.get("default") ?? DEFAULT_LIST_ID;
  await tasksClient.tasks.clear({ tasklist: defaultListId });
  revalidatePath("/");
  return archived;
}

export async function quickAddTask(title: string, notes?: string, listKey?: string) {
  const tasksClient = await getAuthorizedTasksClient();
  const { resolved } = await resolveTasklists(tasksClient);
  const intent = parseTaskIntent(title);
  const targetKey = (listKey ?? intent.targetList) as typeof intent.targetList;
  const targetListId = resolved.get(targetKey) ?? DEFAULT_LIST_ID;

  await tasksClient.tasks.insert({
    tasklist: targetListId,
    requestBody: {
      title,
      notes: [notes ?? "", describeIntent({ targetList: targetKey, urgency: intent.urgency })]
        .filter(Boolean)
        .join("\n"),
      status: "needsAction"
    }
  });

  revalidatePath("/");
}

export async function moveTasksToList(destinationListId: string, tasksToMove: Task[]): Promise<{ moved: number }> {
  if (!destinationListId) {
    throw new Error("Destination list is required");
  }

  const tasksClient = await getAuthorizedTasksClient();
  const { available } = await resolveTasklists(tasksClient);
  const destinationExists = available.some((list) => list.id === destinationListId);

  if (!destinationExists) {
    throw new Error(`Destination list ${destinationListId} could not be found`);
  }

  let moved = 0;

  for (const task of tasksToMove) {
    if (!task.id || !task.title || !task.listId) continue;

    await tasksClient.tasks.insert({
      tasklist: destinationListId,
      requestBody: {
        title: task.title,
        notes: task.notes,
        status: task.status,
        due: normalizeDueDate(task.due),
        completed: task.status === "completed" ? new Date().toISOString() : undefined
      }
    });

    await tasksClient.tasks.delete({
      tasklist: task.listId,
      task: task.id
    });

    moved += 1;
  }

  revalidatePath("/");
  return { moved };
}

export async function fetchTasklists(): Promise<TaskListSummary[]> {
  const tasksClient = await getAuthorizedTasksClient();
  const { available } = await resolveTasklists(tasksClient);
  return (available ?? []).map((list) => ({
    id: list.id!,
    title: list.title ?? "Untitled list",
    isDefault: (list.id === DEFAULT_LIST_ID || list.title?.toLowerCase() === "my tasks") ?? false
  }));
}

export async function fetchTasklistsWithTasks(listIds?: string[]): Promise<TaskListWithTasks[]> {
  const tasksClient = await getAuthorizedTasksClient();
  const { available } = await resolveTasklists(tasksClient);
  const filtered = (available ?? []).filter((list) => !listIds || listIds.includes(list.id!));

  const results: TaskListWithTasks[] = [];
  for (const list of filtered) {
    if (!list.id) continue;
    const response = await tasksClient.tasks.list({ tasklist: list.id });
    const items = response.data.items ?? [];
    const tasks = items
      .filter((item) => item.id && item.title)
      .map((item) => {
        const parsed = parseTaskIntent(item.title ?? "");
        return {
          id: item.id!,
          title: item.title!,
          notes: item.notes ?? undefined,
          status: (item.status as Task["status"]) ?? "needsAction",
          due: item.due ?? undefined,
          updated: item.updated ?? undefined,
          listId: list.id!,
          targetList: parsed.targetList,
          urgency: parsed.urgency
        };
      });

    results.push({
      id: list.id,
      title: list.title ?? "Untitled list",
      isDefault: (list.id === DEFAULT_LIST_ID || list.title?.toLowerCase() === "my tasks") ?? false,
      tasks
    });
  }

  return results;
}

export async function fetchDefaultTaskSnapshot(limit = 10): Promise<{ tasks: TaskSnapshot[]; error?: string }> {
  try {
    const tasksClient = await getAuthorizedTasksClient();
    const { resolved } = await resolveTasklists(tasksClient);
    const defaultListId = resolved.get("default") ?? DEFAULT_LIST_ID;
    const response = await tasksClient.tasks.list({
      tasklist: defaultListId,
      maxResults: limit,
      showCompleted: true,
      showHidden: true
    });

    const items = response.data.items ?? [];
    const tasks: TaskSnapshot[] = items
      .filter((item) => item.id && item.title)
      .map((item) => ({
        id: item.id!,
        title: item.title!,
        status: (item.status as Task["status"]) ?? "needsAction",
        due: item.due ?? undefined,
        updated: item.updated ?? undefined,
        notes: item.notes ?? undefined
      }));

    return { tasks };
  } catch (error) {
    console.error("Failed to fetch default task snapshot", error);
    return {
      tasks: [],
      error: "Unable to load your default Google Tasks list. Check your connection and permissions."
    };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { describeIntent, getTasklistIdFromKey, parseTaskIntent } from "@/lib/tasks/parser";
import { listRoutingCatalog, type Task } from "@/lib/tasks/schema";

const DEFAULT_LIST_ID = process.env.DEFAULT_TASKLIST_ID ?? "@default";

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
  const tasksResponse = await tasksClient.tasks.list({ tasklist: DEFAULT_LIST_ID });
  const tasks = tasksResponse.data.items ?? [];

  let moved = 0;
  for (const task of tasks) {
    if (!task.id || !task.title) continue;

    const intent = parseTaskIntent(task.title);
    const destinationListId = getTasklistIdFromKey(intent.targetList);

    if (!destinationListId || destinationListId === DEFAULT_LIST_ID) continue;

    const notes = [task.notes ?? "", describeIntent(intent)].filter(Boolean).join("\n");

    await tasksClient.tasks.insert({
      tasklist: destinationListId,
      requestBody: {
        title: task.title,
        notes,
        status: task.status,
        due: task.due,
        completed: task.completed
      }
    });

    await tasksClient.tasks.delete({
      tasklist: DEFAULT_LIST_ID,
      task: task.id
    });

    moved += 1;
  }

  revalidatePath("/");
  return { moved, inspected: tasks.length };
}

export async function bulkArchiveCompleted(): Promise<number> {
  const tasksClient = await getAuthorizedTasksClient();
  let archived = 0;

  for (const listRule of listRoutingCatalog) {
    await tasksClient.tasks.clear({ tasklist: listRule.tasklistId });
    archived += 1;
  }

  await tasksClient.tasks.clear({ tasklist: DEFAULT_LIST_ID });
  revalidatePath("/");
  return archived;
}

export async function quickAddTask(title: string, notes?: string, listKey?: string) {
  const tasksClient = await getAuthorizedTasksClient();
  const intent = parseTaskIntent(title);
  const targetKey = (listKey ?? intent.targetList) as typeof intent.targetList;
  const targetListId = getTasklistIdFromKey(targetKey) ?? DEFAULT_LIST_ID;

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

export async function fetchTasksByList(): Promise<Record<string, Task[]>> {
  const tasksClient = await getAuthorizedTasksClient();
  const lists: Record<string, Task[]> = {};

  for (const listRule of listRoutingCatalog) {
    const response = await tasksClient.tasks.list({ tasklist: listRule.tasklistId });
    const items = response.data.items ?? [];
    lists[listRule.key] = items
      .filter((item) => item.id && item.title)
      .map((item) => ({
        id: item.id!,
        title: item.title!,
        notes: item.notes ?? undefined,
        status: (item.status as Task["status"]) ?? "needsAction",
        due: item.due ?? undefined,
        updated: item.updated ?? undefined,
        listId: listRule.tasklistId,
        targetList: listRule.key,
        urgency: parseTaskIntent(item.title).urgency
      }));
  }

  return lists;
}

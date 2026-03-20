import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const addTask = createTool({
  id: "addTask",
  description: "Google Tasksに新しいタスクを追加する",
  inputSchema: z.object({
    title: z.string().describe("タスク名"),
    notes: z.string().optional().describe("メモ・詳細"),
    due: z.string().optional().describe("締切日 (YYYY-MM-DD)"),
  }),
  outputSchema: z.object({ id: z.string(), title: z.string() }),
  execute: async ({ context }) => {
    const token = await getAccessToken();
    const taskListId = process.env.GOOGLE_TASK_LIST_ID || "@default";

    const body: Record<string, string> = { title: context.title };
    if (context.notes) body.notes = context.notes;
    if (context.due) body.due = new Date(context.due).toISOString();

    const res = await fetch(`${TASKS_API}/lists/${taskListId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`addTask failed: ${res.status} ${await res.text()}`);
    }

    const task = (await res.json()) as { id: string; title: string };
    return { id: task.id, title: task.title };
  },
});

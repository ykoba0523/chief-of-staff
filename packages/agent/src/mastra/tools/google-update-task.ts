import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const updateTask = createTool({
  id: "updateTask",
  description:
    "Google Tasksのタスクを更新する（タイトル・メモ・締切・完了状態）",
  inputSchema: z.object({
    taskId: z.string().describe("タスクID"),
    title: z.string().optional().describe("新しいタスク名"),
    notes: z.string().optional().describe("新しいメモ"),
    due: z.string().optional().describe("新しい締切日 (YYYY-MM-DD)"),
    completed: z.boolean().optional().describe("trueで完了にする"),
  }),
  outputSchema: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const token = await getAccessToken();
    const taskListId = process.env.GOOGLE_TASK_LIST_ID || "@default";

    const body: Record<string, unknown> = {};
    if (context.title) body.title = context.title;
    if (context.notes) body.notes = context.notes;
    if (context.due) body.due = new Date(context.due).toISOString();
    if (context.completed !== undefined) {
      body.status = context.completed ? "completed" : "needsAction";
    }

    const res = await fetch(
      `${TASKS_API}/lists/${taskListId}/tasks/${context.taskId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(`updateTask failed: ${res.status} ${await res.text()}`);
    }

    const task = (await res.json()) as {
      id: string;
      title: string;
      status: string;
    };
    return { id: task.id, title: task.title, status: task.status };
  },
});

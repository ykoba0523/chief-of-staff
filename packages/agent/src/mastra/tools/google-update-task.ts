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
    notes: z.string(),
    status: z.string(),
  }),
  execute: async ({ context }) => {
    const token = await getAccessToken();
    const taskListId = process.env.GOOGLE_TASK_LIST_ID || "@default";
    const taskUrl = `${TASKS_API}/lists/${taskListId}/tasks/${context.taskId}`;

    // 1. 既存タスクを取得
    const getRes = await fetch(taskUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!getRes.ok) {
      throw new Error(`getTask failed: ${getRes.status} ${await getRes.text()}`);
    }
    const existing = (await getRes.json()) as Record<string, unknown>;

    // 2. 変更をマージ
    if (context.title) existing.title = context.title;
    if (context.notes !== undefined) existing.notes = context.notes;
    if (context.due) existing.due = new Date(context.due).toISOString();
    if (context.completed !== undefined) {
      existing.status = context.completed ? "completed" : "needsAction";
    }

    // 3. PUT で全体を送信
    const putRes = await fetch(taskUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(existing),
    });

    if (!putRes.ok) {
      throw new Error(`updateTask failed: ${putRes.status} ${await putRes.text()}`);
    }

    const task = (await putRes.json()) as {
      id: string;
      title: string;
      notes: string;
      status: string;
    };
    return { id: task.id, title: task.title, notes: task.notes ?? "", status: task.status };
  },
});

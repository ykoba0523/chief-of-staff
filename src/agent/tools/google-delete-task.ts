import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const deleteTask = createTool({
  id: "deleteTask",
  description: "Google Tasksのタスクを削除する（不要になったタスクを完全に削除）",
  inputSchema: z.object({
    taskId: z.string().describe("タスクID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deletedTaskId: z.string(),
  }),
  execute: async ({ context }) => {
    const token = await getAccessToken();
    const taskListId = process.env.GOOGLE_TASK_LIST_ID || "@default";
    const taskUrl = `${TASKS_API}/lists/${taskListId}/tasks/${context.taskId}`;

    const res = await fetch(taskUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`deleteTask failed: ${res.status} ${await res.text()}`);
    }

    return { success: true, deletedTaskId: context.taskId };
  },
});

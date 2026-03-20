import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const getTasks = createTool({
  id: "getTasks",
  description: "Google Tasksからタスク一覧を取得する",
  inputSchema: z.object({}),
  outputSchema: z.object({ tasks: z.array(z.any()) }),
  execute: async () => {
    const token = await getAccessToken();
    const taskListId = process.env.GOOGLE_TASK_LIST_ID || "@default";

    const res = await fetch(
      `${TASKS_API}/lists/${taskListId}/tasks?showCompleted=false&showHidden=false`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      throw new Error(`getTasks failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { items?: any[] };
    const tasks = (data.items || []).map((t) => ({
      id: t.id,
      title: t.title,
      notes: t.notes || "",
      due: t.due || null,
      status: t.status,
    }));

    return { tasks };
  },
});

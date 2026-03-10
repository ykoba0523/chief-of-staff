import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getNotionClient, getDatabaseId } from "./notion-client";

const taskSchema = z.object({
  id: z.string(),
  タスク名: z.string(),
  ステータス: z.string().nullable(),
  優先度: z.string().nullable(),
  予定日: z.string().nullable(),
  締切日: z.string().nullable(),
  完了日: z.string().nullable(),
  メモ: z.string().nullable(),
});

export const getTasks = createTool({
  id: "get-tasks",
  description:
    "Notionのタスク管理DBからタスク一覧を取得する。ステータスや予定日でフィルタリング可能。",
  inputSchema: z.object({
    status: z
      .enum(["今日やる", "進行中", "完了", "保留"])
      .optional()
      .describe("フィルタするステータス"),
    date: z
      .string()
      .optional()
      .describe("フィルタする予定日 (YYYY-MM-DD形式)"),
  }),
  outputSchema: z.object({
    tasks: z.array(taskSchema),
  }),
  execute: async ({ context }) => {
    const notion = getNotionClient();
    const databaseId = getDatabaseId();

    const filter: any[] = [];
    if (context.status) {
      filter.push({
        property: "ステータス",
        select: { equals: context.status },
      });
    }
    if (context.date) {
      filter.push({
        property: "予定日",
        date: { equals: context.date },
      });
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      filter:
        filter.length > 0
          ? { and: filter }
          : undefined,
      sorts: [
        { property: "優先度", direction: "ascending" },
        { property: "予定日", direction: "ascending" },
      ],
    });

    const tasks = response.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        タスク名: props.タスク名?.title?.[0]?.plain_text ?? "",
        ステータス: props.ステータス?.select?.name ?? null,
        優先度: props.優先度?.select?.name ?? null,
        予定日: props.予定日?.date?.start ?? null,
        締切日: props.締切日?.date?.start ?? null,
        完了日: props.完了日?.date?.start ?? null,
        メモ: props.メモ?.rich_text?.[0]?.plain_text ?? null,
      };
    });

    return { tasks };
  },
});

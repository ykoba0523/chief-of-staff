import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getNotionClient, getDatabaseId } from "./notion-client";

export const addTask = createTool({
  id: "add-task",
  description:
    "Notionのタスク管理DBに新しいタスクを追加する。タスク名は必須、その他はオプション。",
  inputSchema: z.object({
    タスク名: z.string().describe("タスクの名前"),
    ステータス: z
      .enum(["今日やる", "進行中", "完了", "保留"])
      .optional()
      .default("今日やる")
      .describe("タスクのステータス"),
    優先度: z
      .enum(["高", "中", "低"])
      .optional()
      .default("中")
      .describe("タスクの優先度"),
    予定日: z
      .string()
      .optional()
      .describe("予定日 (YYYY-MM-DD形式)"),
    締切日: z
      .string()
      .optional()
      .describe("締切日 (YYYY-MM-DD形式)"),
    メモ: z
      .string()
      .optional()
      .describe("メモ・補足情報"),
  }),
  outputSchema: z.object({
    id: z.string(),
    url: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const notion = getNotionClient();
    const databaseId = getDatabaseId();

    const properties: any = {
      タスク名: {
        title: [{ text: { content: context.タスク名 } }],
      },
    };

    if (context.ステータス) {
      properties.ステータス = { select: { name: context.ステータス } };
    }
    if (context.優先度) {
      properties.優先度 = { select: { name: context.優先度 } };
    }
    if (context.予定日) {
      properties.予定日 = { date: { start: context.予定日 } };
    }
    if (context.締切日) {
      properties.締切日 = { date: { start: context.締切日 } };
    }
    if (context.メモ) {
      properties.メモ = {
        rich_text: [{ text: { content: context.メモ } }],
      };
    }

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });

    return {
      id: response.id,
      url: (response as any).url,
      message: `タスク「${context.タスク名}」を追加しました`,
    };
  },
});

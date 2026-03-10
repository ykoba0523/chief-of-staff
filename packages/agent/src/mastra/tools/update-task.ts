import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getNotionClient } from "./notion-client";

export const updateTask = createTool({
  id: "update-task",
  description:
    "Notionのタスクを更新する。ステータス変更、予定日変更、完了処理などに使う。",
  inputSchema: z.object({
    id: z.string().describe("更新するタスクのNotion Page ID"),
    ステータス: z
      .enum(["今日やる", "進行中", "完了", "保留"])
      .optional()
      .describe("新しいステータス"),
    優先度: z
      .enum(["高", "中", "低"])
      .optional()
      .describe("新しい優先度"),
    予定日: z
      .string()
      .optional()
      .describe("新しい予定日 (YYYY-MM-DD形式)"),
    締切日: z
      .string()
      .optional()
      .describe("新しい締切日 (YYYY-MM-DD形式)"),
    完了日: z
      .string()
      .optional()
      .describe("完了日 (YYYY-MM-DD形式)"),
    メモ: z
      .string()
      .optional()
      .describe("新しいメモ"),
  }),
  outputSchema: z.object({
    id: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const notion = getNotionClient();

    const properties: any = {};

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
    if (context.完了日) {
      properties.完了日 = { date: { start: context.完了日 } };
    }
    if (context.メモ) {
      properties.メモ = {
        rich_text: [{ text: { content: context.メモ } }],
      };
    }

    // ステータスが「完了」で完了日が未指定なら今日の日付を自動設定
    if (context.ステータス === "完了" && !context.完了日) {
      const today = new Date().toISOString().split("T")[0];
      properties.完了日 = { date: { start: today } };
    }

    await notion.pages.update({
      page_id: context.id,
      properties,
    });

    return {
      id: context.id,
      message: "タスクを更新しました",
    };
  },
});

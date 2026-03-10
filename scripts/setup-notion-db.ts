/**
 * Notion タスク DB 作成スクリプト
 * 実行: npx tsx scripts/setup-notion-db.ts
 */
import { Client } from "@notionhq/client";
import "dotenv/config";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const parentPageId = process.env.NOTION_PARENT_PAGE_ID!;

async function createTaskDatabase() {
  const response = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "タスク管理" } }],
    properties: {
      タスク名: {
        title: {},
      },
      ステータス: {
        select: {
          options: [
            { name: "今日やる", color: "blue" },
            { name: "進行中", color: "yellow" },
            { name: "完了", color: "green" },
            { name: "保留", color: "gray" },
          ],
        },
      },
      優先度: {
        select: {
          options: [
            { name: "高", color: "red" },
            { name: "中", color: "yellow" },
            { name: "低", color: "gray" },
          ],
        },
      },
      予定日: {
        date: {},
      },
      締切日: {
        date: {},
      },
      完了日: {
        date: {},
      },
      メモ: {
        rich_text: {},
      },
    },
  });

  console.log("タスク DB を作成しました！");
  console.log(`Database ID: ${response.id}`);
  console.log(`URL: ${response.url}`);
  console.log("");
  console.log("この Database ID を .env の NOTION_DATABASE_ID に設定してください:");
  console.log(`NOTION_DATABASE_ID=${response.id}`);
}

createTaskDatabase().catch((error) => {
  console.error("エラーが発生しました:", error.message);
  process.exit(1);
});

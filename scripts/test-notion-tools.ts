/**
 * Notion Tool の動作確認スクリプト
 * 実行: DOTENV_CONFIG_PATH=packages/agent/.env npx tsx scripts/test-notion-tools.ts
 */
import "dotenv/config";
import { getTasks } from "../packages/agent/src/mastra/tools/get-tasks";
import { addTask } from "../packages/agent/src/mastra/tools/add-task";
import { updateTask } from "../packages/agent/src/mastra/tools/update-task";
import { RuntimeContext } from "@mastra/core/runtime-context";

const runtimeContext = new RuntimeContext();

async function main() {
  console.log("=== 1. タスク追加テスト ===");
  const addResult = await addTask.execute({
    context: {
      タスク名: "テストタスク",
      ステータス: "今日やる",
      優先度: "中",
      予定日: new Date().toISOString().split("T")[0],
      メモ: "動作確認用のテストタスクです",
    },
    runtimeContext,
  });
  console.log(addResult);

  console.log("\n=== 2. タスク一覧取得テスト ===");
  const listResult = await getTasks.execute({
    context: {},
    runtimeContext,
  });
  console.log(JSON.stringify(listResult, null, 2));

  console.log("\n=== 3. タスク更新テスト ===");
  const updateResult = await updateTask.execute({
    context: {
      id: addResult.id,
      ステータス: "完了",
    },
    runtimeContext,
  });
  console.log(updateResult);

  console.log("\n=== 4. 更新後の確認 ===");
  const afterUpdate = await getTasks.execute({
    context: { status: "完了" },
    runtimeContext,
  });
  console.log(JSON.stringify(afterUpdate, null, 2));

  console.log("\n全テスト完了！");
}

main().catch((error) => {
  console.error("エラー:", error.message);
  process.exit(1);
});

/**
 * エージェント動作確認スクリプト
 * 実行: pnpm --filter agent test:agent
 */
import { config } from "dotenv";
config({ path: new URL("../.env", import.meta.url) });

import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";
import { managerAgent } from "../src/mastra/agents/manager-agent";

const mastra = new Mastra({
  agents: { managerAgent },
  logger: createLogger({ name: "chief-of-staff", level: "warn" }),
});

async function main() {
  const agent = mastra.getAgent("managerAgent");

  console.log("=== エージェントに話しかけてみる ===\n");

  const message = process.argv[2] || "今日のタスクを教えて";
  console.log(`ユーザー: ${message}\n`);
  const response = await agent.generate(message);

  console.log("エージェントの応答:");
  console.log(response.text);
}

main().catch((error) => {
  console.error("エラー:", error);
  process.exit(1);
});

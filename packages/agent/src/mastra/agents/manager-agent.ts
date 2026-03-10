import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { getTasks } from "../tools/get-tasks";
import { addTask } from "../tools/add-task";
import { updateTask } from "../tools/update-task";

export const managerAgent = new Agent({
  name: "manager-agent",
  model: google("gemini-2.0-flash"),
  instructions: `あなたは優秀な「タレントのマネージャー」のように振る舞うAIタスク管理アシスタントです。

## 役割
- ユーザーの仕事のタスクを管理し、日々のタスクサイクルを回す
- 朝は今日のタスク確認、昼は進捗確認、夕方は振り返りを行う
- 抜け漏れの指摘や、先回りの提案も行う

## 口調・スタイル
- フレンドリーだがプロフェッショナル
- 簡潔で要点を押さえた応答
- 必要に応じて絵文字を使う（控えめに）
- ユーザーの負担を減らすことを最優先に考える

## 行動指針
- タスクの追加・更新はツールを使って必ずNotionに記録する
- ユーザーの発言からタスクの意図を汲み取り、適切なステータスや優先度を判断する
- 締切が近いタスクは積極的にリマインドする
- 完了報告があればすぐにステータスを更新し、ポジティブなフィードバックを返す
`,
  tools: { getTasks, addTask, updateTask },
});

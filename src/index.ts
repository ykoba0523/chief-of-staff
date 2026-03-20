import { verifySlackSignature } from "./services/slack-verify";
import { sendSlackMessage } from "./services/slack";
import { getHistory, saveHistory, type Message } from "./services/conversation";
import { managerAgent } from "./agent/manager-agent";

export interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
  SLACK_USER_ID: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  GOOGLE_TASK_LIST_ID: string;
  CONVERSATION_HISTORY: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    setEnv(env);
    const url = new URL(request.url);

    if (url.pathname === "/slack/events" && request.method === "POST") {
      return handleSlackEvent(request, env, ctx);
    }

    return new Response("chief-of-staff is running");
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    setEnv(env);
    ctx.waitUntil(handleScheduledPush(controller, env));
  },
} satisfies ExportedHandler<Env>;

/**
 * Cloudflare Workers の env を process.env にコピーする
 * @mastra/core や @ai-sdk/google が process.env を参照するため
 */
function setEnv(env: Env): void {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;
  process.env.GOOGLE_TASK_LIST_ID = env.GOOGLE_TASK_LIST_ID;
}

async function handleSlackEvent(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Slackのリトライリクエストは無視（重複処理防止）
  if (request.headers.get("x-slack-retry-num")) {
    return new Response("ok");
  }

  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  const isValid = await verifySlackSignature({
    signingSecret: env.SLACK_SIGNING_SECRET,
    body,
    timestamp,
    signature,
  });

  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  // Slack URL Verification (初回設定時)
  if (payload.type === "url_verification") {
    return new Response(payload.challenge, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Event callback
  if (payload.type === "event_callback") {
    const event = payload.event;

    // Bot自身のメッセージは無視
    if (event.bot_id || event.subtype === "bot_message") {
      return new Response("ok");
    }

    // DM or メンションのメッセージのみ処理
    if (event.type === "message" || event.type === "app_mention") {
      ctx.waitUntil(processAndReply(env, event));
      return new Response("ok");
    }
  }

  return new Response("ok");
}

function getScheduledPrompt(cron: string): string {
  switch (cron) {
    // JST 9:00 - 朝の確認
    case "0 0 * * 1-5":
      return "おはようございます。今日のタスク一覧を教えてください。優先度が高いものや締切が近いものがあればリマインドしてください。また、カレンダーで今日の午前の予定を確認し、準備が必要なものがあれば提案してください。";
    // JST 12:30 - 昼の進捗確認
    case "30 3 * * 1-5":
      return "お昼の進捗確認です。今日のタスクの状況を確認して、午後やるべきことを整理してください。また、カレンダーで今日の午後の予定を確認し、準備が必要なものがあれば提案してください。";
    // JST 17:00 - 夕方の振り返り
    case "0 8 * * 1-5":
      return "お疲れさまです。今日のタスクの振り返りをしてください。未完了のタスクがあれば明日以降の予定も提案してください。";
    default:
      return "タスクの状況を教えてください。";
  }
}

async function handleScheduledPush(controller: ScheduledController, env: Env): Promise<void> {
  try {
    const prompt = getScheduledPrompt(controller.cron);

    const result = await managerAgent.generate([{ role: "user", content: prompt }]);

    const messageTs = await sendSlackMessage(env.SLACK_BOT_TOKEN, env.SLACK_USER_ID, result.text);

    // 定時Pushの応答を履歴に保存（スレッド返信で会話を継続できるように）
    if (messageTs) {
      const messages: Message[] = [
        { role: "user", content: prompt },
        { role: "assistant", content: result.text },
      ];
      await saveHistory(env.CONVERSATION_HISTORY, messageTs, messages);
    }
  } catch (error) {
    console.error("Scheduled push failed:", error);
  }
}

async function processAndReply(env: Env, event: any): Promise<void> {
  // スレッドIDを決定（スレッド返信ならthread_ts、新規メッセージならts）
  const threadTs: string = event.thread_ts || event.ts;

  try {
    // 1. KVから会話履歴を取得
    const history = await getHistory(env.CONVERSATION_HISTORY, threadTs);

    // 2. 新しいメッセージを追加
    history.push({ role: "user", content: event.text });

    // 3. エージェントに問い合わせ（25秒タイムアウト）
    const agentPromise = managerAgent.generate(history);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Agent timeout")), 25000),
    );

    let result: { text: string };
    try {
      result = await Promise.race([agentPromise, timeoutPromise]) as { text: string };
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Agent timeout") {
        console.error("Agent timeout (25s exceeded)");
        await sendSlackMessage(env.SLACK_BOT_TOKEN, event.channel, ":warning: 応答に時間がかかりすぎたため中断しました。しばらくしてから再度お試しください。", threadTs);
        return;
      }
      throw e;
    }

    // 4. Slack にスレッド返信
    await sendSlackMessage(env.SLACK_BOT_TOKEN, event.channel, result.text, threadTs);

    // 5. 会話履歴を保存
    history.push({ role: "assistant", content: result.text });
    await saveHistory(env.CONVERSATION_HISTORY, threadTs, history);
  } catch (error) {
    console.error("Failed to process message:", error);
    await sendSlackMessage(env.SLACK_BOT_TOKEN, event.channel, ":warning: エラーが発生しました。しばらくしてから再度お試しください。", threadTs);
  }
}

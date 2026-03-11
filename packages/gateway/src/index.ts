import { verifySlackSignature } from "./slack-verify";

export interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
  SLACK_USER_ID: string;
  MASTRA_API_URL: string;
  MASTRA_SHARED_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/slack/events" && request.method === "POST") {
      return handleSlackEvent(request, env, ctx);
    }

    return new Response("chief-of-staff gateway is running");
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduledPush(controller, env));
  },
} satisfies ExportedHandler<Env>;

async function handleSlackEvent(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      // Slack は 3秒以内にレスポンスを返さないとリトライするため、
      // 非同期で処理して即座に 200 を返す
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
      return "おはようございます。今日のタスク一覧を教えてください。優先度が高いものや締切が近いものがあればリマインドしてください。";
    // JST 12:30 - 昼の進捗確認
    case "30 3 * * 1-5":
      return "お昼の進捗確認です。今日のタスクの状況を確認して、午後やるべきことを整理してください。";
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

    const agentResponse = await fetch(`${env.MASTRA_API_URL}/api/agents/managerAgent/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.MASTRA_SHARED_SECRET}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!agentResponse.ok) {
      console.error("Scheduled push - Agent API error:", agentResponse.status, await agentResponse.text());
      return;
    }

    const result = await agentResponse.json<{ text: string }>();
    await sendSlackMessage(env.SLACK_BOT_TOKEN, env.SLACK_USER_ID, result.text);
  } catch (error) {
    console.error("Scheduled push failed:", error);
  }
}

async function processAndReply(env: Env, event: any): Promise<void> {
  try {
    // 1. エージェントに問い合わせ
    const agentResponse = await fetch(`${env.MASTRA_API_URL}/api/agents/managerAgent/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.MASTRA_SHARED_SECRET}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: event.text },
        ],
      }),
    });

    if (!agentResponse.ok) {
      console.error("Agent API error:", agentResponse.status, await agentResponse.text());
      return;
    }

    const result = await agentResponse.json<{ text: string }>();

    // 2. Slack に返信
    await sendSlackMessage(env.SLACK_BOT_TOKEN, event.channel, result.text);
  } catch (error) {
    console.error("Failed to process message:", error);
  }
}

async function sendSlackMessage(token: string, channel: string, text: string): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text }),
  });

  if (!response.ok) {
    console.error("Slack API error:", response.status, await response.text());
  }

  const result = await response.json<{ ok: boolean; error?: string }>();
  if (!result.ok) {
    console.error("Slack API returned error:", result.error);
  }
}

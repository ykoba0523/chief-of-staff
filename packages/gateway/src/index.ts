import { verifySlackSignature } from "./slack-verify";

export interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
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

  // Phase 6 で実装: 定時Push
  // async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // },
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

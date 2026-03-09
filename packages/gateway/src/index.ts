export interface Env {
  SLACK_SIGNING_SECRET: string;
  MASTRA_API_URL: string;
  MASTRA_SHARED_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/slack/events" && request.method === "POST") {
      // Phase 5 で実装: Slack Event 受信 → Agent へ転送
      return new Response("Not implemented", { status: 501 });
    }

    return new Response("chief-of-staff gateway is running");
  },

  // Phase 6 で実装: 定時Push
  // async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // },
} satisfies ExportedHandler<Env>;

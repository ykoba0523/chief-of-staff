export async function sendSlackMessage(
  token: string,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<string | null> {
  const body: Record<string, string> = { channel, text };
  if (threadTs) body.thread_ts = threadTs;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error("Slack API error:", response.status, await response.text());
    return null;
  }

  const result = await response.json<{ ok: boolean; error?: string; ts?: string }>();
  if (!result.ok) {
    console.error("Slack API returned error:", result.error);
    return null;
  }

  return result.ts ?? null;
}

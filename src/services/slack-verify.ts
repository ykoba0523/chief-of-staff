/**
 * Slack リクエストの署名検証
 * Web Crypto API を使用（Cloudflare Workers 互換）
 */
export async function verifySlackSignature({
  signingSecret,
  body,
  timestamp,
  signature,
}: {
  signingSecret: string;
  body: string;
  timestamp: string;
  signature: string;
}): Promise<boolean> {
  // タイムスタンプが5分以上前ならリプレイ攻撃の可能性
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 60 * 5) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(sigBasestring));
  const computedSignature = `v0=${Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  return computedSignature === signature;
}

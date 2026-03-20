export type Message = { role: "user" | "assistant"; content: string };

const MAX_HISTORY = 20;
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30日

export async function getHistory(kv: KVNamespace, threadTs: string): Promise<Message[]> {
  const data = await kv.get<Message[]>(`thread:${threadTs}`, "json");
  if (!data) return [];
  return data.slice(-MAX_HISTORY);
}

export async function saveHistory(kv: KVNamespace, threadTs: string, messages: Message[]): Promise<void> {
  await kv.put(`thread:${threadTs}`, JSON.stringify(messages), { expirationTtl: TTL_SECONDS });
}

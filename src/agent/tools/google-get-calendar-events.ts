import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const getCalendarEvents = createTool({
  id: "getCalendarEvents",
  description:
    "Googleカレンダーから予定を取得する。デフォルトは今日の予定を返す。",
  inputSchema: z.object({
    timeMin: z
      .string()
      .optional()
      .describe("取得開始日時 (ISO8601)。省略時は今日の0:00 JST"),
    timeMax: z
      .string()
      .optional()
      .describe("取得終了日時 (ISO8601)。省略時は今日の23:59 JST"),
    maxResults: z
      .number()
      .optional()
      .default(20)
      .describe("最大取得件数（デフォルト20）"),
  }),
  outputSchema: z.object({ events: z.array(z.any()) }),
  execute: async ({ context }) => {
    const token = await getAccessToken();

    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
    );
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const timeMin = context.timeMin || todayStart.toISOString();
    const timeMax = context.timeMax || todayEnd.toISOString();
    const maxResults = context.maxResults || 20;

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: String(maxResults),
      singleEvents: "true",
      orderBy: "startTime",
    });

    const res = await fetch(
      `${CALENDAR_API}/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok) {
      throw new Error(
        `getCalendarEvents failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as { items?: any[] };
    const events = (data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || "",
      start: e.start?.dateTime || e.start?.date || null,
      end: e.end?.dateTime || e.end?.date || null,
      location: e.location || "",
      description: e.description || "",
      attendees: (e.attendees || []).map((a: any) => ({
        email: a.email || "",
        displayName: a.displayName || "",
        self: a.self || false,
      })),
    }));

    return { events };
  },
});

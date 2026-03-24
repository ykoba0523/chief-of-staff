import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const addCalendarEvent = createTool({
  id: "addCalendarEvent",
  description: "Googleカレンダーに新しい予定を追加する",
  inputSchema: z.object({
    summary: z.string().describe("予定のタイトル"),
    startDateTime: z.string().describe("開始日時 (ISO8601形式、例: 2026-03-22T14:00:00+09:00)"),
    endDateTime: z.string().describe("終了日時 (ISO8601形式、例: 2026-03-22T15:00:00+09:00)"),
    location: z.string().optional().describe("場所"),
    description: z.string().optional().describe("説明・メモ"),
    roomCalendarId: z.string().optional().describe("予約する会議室のカレンダーID"),
  }),
  outputSchema: z.object({
    id: z.string(),
    summary: z.string(),
    start: z.string(),
    end: z.string(),
  }),
  execute: async ({ context }) => {
    const token = await getAccessToken();

    const body: Record<string, unknown> = {
      summary: context.summary,
      start: { dateTime: context.startDateTime, timeZone: "Asia/Tokyo" },
      end: { dateTime: context.endDateTime, timeZone: "Asia/Tokyo" },
    };
    if (context.location) body.location = context.location;
    if (context.description) body.description = context.description;
    if (context.roomCalendarId) {
      body.attendees = [{ email: context.roomCalendarId, resource: true }];
    }

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`addCalendarEvent failed: ${res.status} ${await res.text()}`);
    }

    const event = (await res.json()) as {
      id: string;
      summary: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
    };

    return {
      id: event.id,
      summary: event.summary || "",
      start: event.start.dateTime || event.start.date || "",
      end: event.end.dateTime || event.end.date || "",
    };
  },
});

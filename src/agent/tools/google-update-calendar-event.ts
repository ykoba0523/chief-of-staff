import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const updateCalendarEvent = createTool({
  id: "updateCalendarEvent",
  description: "Googleカレンダーの予定を更新する（タイトル・日時・場所・説明）",
  inputSchema: z.object({
    eventId: z.string().describe("イベントID"),
    summary: z.string().optional().describe("新しいタイトル"),
    startDateTime: z.string().optional().describe("新しい開始日時 (ISO8601形式)"),
    endDateTime: z.string().optional().describe("新しい終了日時 (ISO8601形式)"),
    location: z.string().optional().describe("新しい場所"),
    description: z.string().optional().describe("新しい説明"),
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
    const eventUrl = `${CALENDAR_API}/calendars/primary/events/${context.eventId}`;

    // 1. 既存イベントを取得
    const getRes = await fetch(eventUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!getRes.ok) {
      throw new Error(`getCalendarEvent failed: ${getRes.status} ${await getRes.text()}`);
    }
    const existing = (await getRes.json()) as Record<string, unknown>;

    // 2. 変更をマージ
    if (context.summary) existing.summary = context.summary;
    if (context.startDateTime) existing.start = { dateTime: context.startDateTime, timeZone: "Asia/Tokyo" };
    if (context.endDateTime) existing.end = { dateTime: context.endDateTime, timeZone: "Asia/Tokyo" };
    if (context.location !== undefined) existing.location = context.location;
    if (context.description !== undefined) existing.description = context.description;
    if (context.roomCalendarId) {
      const existingAttendees = (existing.attendees as any[] || []).filter(
        (a: any) => !a.resource,
      );
      existing.attendees = [
        ...existingAttendees,
        { email: context.roomCalendarId, resource: true },
      ];
    }

    // 3. PUT で全体を送信
    const putRes = await fetch(eventUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(existing),
    });

    if (!putRes.ok) {
      throw new Error(`updateCalendarEvent failed: ${putRes.status} ${await putRes.text()}`);
    }

    const event = (await putRes.json()) as {
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

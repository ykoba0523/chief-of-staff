import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const deleteCalendarEvent = createTool({
  id: "deleteCalendarEvent",
  description: "Googleカレンダーの予定を削除する",
  inputSchema: z.object({
    eventId: z.string().describe("イベントID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    deletedEventId: z.string(),
  }),
  execute: async ({ context }) => {
    const token = await getAccessToken();
    const eventUrl = `${CALENDAR_API}/calendars/primary/events/${context.eventId}`;

    const res = await fetch(eventUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`deleteCalendarEvent failed: ${res.status} ${await res.text()}`);
    }

    return { success: true, deletedEventId: context.eventId };
  },
});

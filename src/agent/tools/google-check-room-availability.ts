import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getAccessToken } from "./google-client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface MeetingRoom {
  name: string;
  calendarId: string;
}

function getMeetingRooms(): MeetingRoom[] {
  const raw = process.env.MEETING_ROOMS;
  if (!raw) {
    throw new Error(
      "MEETING_ROOMS 環境変数が設定されていません。会議室情報をJSON配列で設定してください。",
    );
  }
  return JSON.parse(raw) as MeetingRoom[];
}

export const checkRoomAvailability = createTool({
  id: "checkRoomAvailability",
  description:
    "指定した時間帯における会議室の空き状況を確認する。会議室名を指定すれば特定の会議室のみ、省略すれば全会議室を対象に検索する。",
  inputSchema: z.object({
    timeMin: z.string().describe("検索開始日時 (ISO8601)"),
    timeMax: z.string().describe("検索終了日時 (ISO8601)"),
    roomNames: z
      .array(z.string())
      .optional()
      .describe("検索対象の会議室名リスト。省略時は全会議室を対象とする"),
  }),
  outputSchema: z.object({
    availableRooms: z.array(
      z.object({ name: z.string(), calendarId: z.string() }),
    ),
    unavailableRooms: z.array(
      z.object({
        name: z.string(),
        calendarId: z.string(),
        busyPeriods: z.array(
          z.object({ start: z.string(), end: z.string() }),
        ),
      }),
    ),
    notFoundRoomNames: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const allRooms = getMeetingRooms();

    let targetRooms: MeetingRoom[];
    const notFoundRoomNames: string[] = [];

    if (context.roomNames && context.roomNames.length > 0) {
      targetRooms = [];
      for (const name of context.roomNames) {
        const found = allRooms.find((r) => r.name === name);
        if (found) {
          targetRooms.push(found);
        } else {
          notFoundRoomNames.push(name);
        }
      }
    } else {
      targetRooms = allRooms;
    }

    if (targetRooms.length === 0) {
      return {
        availableRooms: [],
        unavailableRooms: [],
        notFoundRoomNames,
      };
    }

    const token = await getAccessToken();

    const res = await fetch(`${CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: context.timeMin,
        timeMax: context.timeMax,
        timeZone: "Asia/Tokyo",
        items: targetRooms.map((r) => ({ id: r.calendarId })),
      }),
    });

    if (!res.ok) {
      throw new Error(
        `checkRoomAvailability failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as {
      calendars: Record<
        string,
        { busy: { start: string; end: string }[]; errors?: any[] }
      >;
    };

    const availableRooms: { name: string; calendarId: string }[] = [];
    const unavailableRooms: {
      name: string;
      calendarId: string;
      busyPeriods: { start: string; end: string }[];
    }[] = [];

    for (const room of targetRooms) {
      const calendar = data.calendars[room.calendarId];
      const busy = calendar?.busy || [];

      if (busy.length === 0) {
        availableRooms.push({ name: room.name, calendarId: room.calendarId });
      } else {
        unavailableRooms.push({
          name: room.name,
          calendarId: room.calendarId,
          busyPeriods: busy.map((b) => ({ start: b.start, end: b.end })),
        });
      }
    }

    return { availableRooms, unavailableRooms, notFoundRoomNames };
  },
});

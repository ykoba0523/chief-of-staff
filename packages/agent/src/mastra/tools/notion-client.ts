import { Client } from "@notionhq/client";

export function getNotionClient() {
  return new Client({ auth: process.env.NOTION_API_KEY });
}

export function getDatabaseId() {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID is not set");
  return id;
}

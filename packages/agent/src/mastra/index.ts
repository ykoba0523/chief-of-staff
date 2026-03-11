import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";
import { managerAgent } from "./agents/manager-agent";

export const mastra = new Mastra({
  agents: { managerAgent },
  logger: createLogger({ name: "chief-of-staff", level: "info" }),
});

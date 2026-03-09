import { Mastra, PinoLogger } from "@mastra/core";
import { managerAgent } from "./agents/manager-agent";

export const mastra = new Mastra({
  agents: { managerAgent },
  logger: new PinoLogger({ name: "chief-of-staff", level: "info" }),
});

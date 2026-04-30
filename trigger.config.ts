import { defineConfig } from "@trigger.dev/sdk/v3";
import { ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_fexygvvinpllpdadijva",
  runtime: "node",
  logLevel: "log",
  maxDuration: 10800,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 2000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
  build: {
    extensions: [ffmpeg()],
  },
});

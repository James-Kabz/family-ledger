import { config as loadEnv } from "dotenv";

import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

const migrateUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(migrateUrl
    ? {
        datasource: {
          url: migrateUrl,
        },
      }
    : {}),
});

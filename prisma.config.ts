import { config as loadEnv } from "dotenv";

import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

const migrateUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrateUrl) {
  throw new Error("Set DIRECT_URL (preferred) or DATABASE_URL before running Prisma CLI commands.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: migrateUrl,
  },
});

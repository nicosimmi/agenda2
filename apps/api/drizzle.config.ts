import { defineConfig } from "drizzle-kit";

// Solo para generar migraciones (pnpm db:generate); no necesita conexión.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});

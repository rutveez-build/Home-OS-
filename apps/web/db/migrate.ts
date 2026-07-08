import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

config({ path: ".env.local" });

// Migration URL resolution. DDL can't run through a pooler, so prefer the
// non-pooling URL when available.
//   - DATABASE_URL_MIGRATIONS  → explicit override
//   - POSTGRES_URL_NON_POOLING → Vercel Postgres direct connection
//   - DATABASE_URL             → Railway / generic
//   - POSTGRES_URL             → fallback
const url =
  process.env.DATABASE_URL_MIGRATIONS ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

if (!url) {
  console.warn(
    "[migrate] No DATABASE_URL / POSTGRES_URL set — skipping (build can continue)."
  );
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = postgres(url!, { max: 1, prepare: false });
  const db = drizzle(sql);
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
  console.log("Done ✓");
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

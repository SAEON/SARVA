import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../src/db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "..", "migrations");

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS sarva;
    CREATE TABLE IF NOT EXISTS sarva.schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function run() {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureMigrationTable(client);

    for (const file of files) {
      const applied = await client.query(
        "SELECT 1 FROM sarva.schema_migrations WHERE id = $1",
        [file]
      );

      if (applied.rowCount > 0) {
        console.log(`Skipping ${file}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO sarva.schema_migrations (id) VALUES ($1)", [file]);
      console.log(`Applied ${file}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});

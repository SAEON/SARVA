import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

if (
  ["localhost", "127.0.0.1"].includes(process.env.DB_HOST) &&
  Number(process.env.DB_PORT || 5432) === 5432
) {
  throw new Error(
    "Refusing to connect to local PostgreSQL on port 5432. Use the Docker database via DB_PORT=5433 from the host, or DB_HOST=db inside Docker."
  );
}

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

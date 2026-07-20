import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { checkLibraryLinks } from "../src/services/linkChecker.js";

function argValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const result = await checkLibraryLinks({
    limit: argValue("limit", process.env.LINK_CHECK_LIMIT || 100),
    staleDays: argValue("stale-days", process.env.LINK_CHECK_STALE_DAYS || 30),
    includeAll: process.argv.includes("--all"),
  });

  console.log(JSON.stringify(result.summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

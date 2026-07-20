import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { syncCatalogue } from "../src/services/catalogueSync.js";

function flagValue(name) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : null;
}

const maxPages = flagValue("--max-pages");

syncCatalogue({
  maxPages: maxPages ? Number(maxPages) : null,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

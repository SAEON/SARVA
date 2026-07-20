import "dotenv/config";
import { pool } from "../src/db/pool.js";
import { refreshCatalogueEssentialVariables } from "../src/services/catalogueEssentialVariables.js";

refreshCatalogueEssentialVariables()
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

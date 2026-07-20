import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { siteRouter } from "./routes/site.js";
import { navRouter } from "./routes/nav.js";
import { glossaryRouter } from "./routes/glossary.js";
import { externalServicesRouter } from "./routes/externalServices.js";
import { resourcesRouter } from "./routes/resources.js";
import { authRouter } from "./routes/auth.js";
import { nationalPolicyRouter } from "./routes/nationalPolicy.js";
import { catalogueRouter } from "./routes/catalogue.js";
import { rainfallRouter } from "./routes/rainfall.js";
import { forecastRiskRouter } from "./routes/forecastRisk.js";
import { libraryAdminRouter } from "./routes/libraryAdmin.js";
import { alertsRouter } from "./routes/alerts.js";
import { municipalProfilesRouter } from "./routes/municipalProfiles.js";
import { startCatalogueSyncScheduler } from "./services/catalogueSync.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());



app.get("/", (req, res) => res.json({ name: "sarva-api", status: "ok" }));
app.use("/api", healthRouter);
app.use("/api/site", siteRouter);
app.use("/api/nav", navRouter);
app.use("/api", glossaryRouter);
app.use("/api", resourcesRouter);
app.use("/api", nationalPolicyRouter);
app.use("/api", catalogueRouter);
app.use("/api", authRouter);
app.use("/api", externalServicesRouter);
app.use("/api", alertsRouter);
app.use("/api", rainfallRouter);
app.use("/api", forecastRiskRouter);
app.use("/api", municipalProfilesRouter);
app.use("/api", libraryAdminRouter);


app.use("/public", express.static(path.join(__dirname, "..", "public")));

const port = Number(process.env.PORT || 5050);
app.listen(port, () => {
  console.log(`API running http://localhost:${port}`);

  if (process.env.CATALOGUE_SYNC_ENABLED !== "false") {
    startCatalogueSyncScheduler({
      runOnStart: process.env.CATALOGUE_SYNC_ON_START === "true",
      staleAfterHours: Number(process.env.CATALOGUE_SYNC_STALE_HOURS || 26),
    });
  }
});

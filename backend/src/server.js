import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";
import { siteRouter } from "./routes/site.js";
import { navRouter } from "./routes/nav.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());



app.get("/", (req, res) => res.json({ name: "sarva-api", status: "ok" }));
app.use("/api", healthRouter);
app.use("/api/site", siteRouter);
app.use("/api/nav", navRouter);


app.use("/public", express.static(path.join(__dirname, "..", "public")));

const port = Number(process.env.PORT || 5050);
app.listen(port, () => console.log(`API running http://localhost:${port}`));
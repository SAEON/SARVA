import { Router } from "express";
import { checkLibraryLinks } from "../services/linkChecker.js";
import { requireAdmin } from "../utils/authSession.js";

export const libraryAdminRouter = Router();

function parseBoolean(value) {
  return ["1", "true", "yes"].includes(String(value || "").toLowerCase());
}

libraryAdminRouter.post("/library/check-links", requireAdmin, async (req, res) => {
  try {
    const result = await checkLibraryLinks({
      limit: req.body?.limit ?? req.query.limit,
      staleDays: req.body?.staleDays ?? req.query.staleDays,
      includeAll: parseBoolean(req.body?.includeAll ?? req.query.includeAll),
    });

    res.json({ status: "ok", data: result });
  } catch (error) {
    console.error("Failed to bulk check library links:", error);
    res.status(500).json({ status: "error", message: "Unable to bulk check library links" });
  }
});

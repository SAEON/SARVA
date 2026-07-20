import crypto from "crypto";

function authSecret() {
  return process.env.AUTH_SECRET || process.env.DB_PASSWORD || "sarva-dev-auth-secret";
}

function verifyToken(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", authSecret())
    .update(encoded)
    .digest("base64url");

  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function requireAdmin(req, res, next) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.roles?.includes("admin")) {
    return res.status(403).json({ status: "error", message: "Admin access required" });
  }

  req.authUser = payload;
  next();
}

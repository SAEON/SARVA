import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db/pool.js";

export const authRouter = Router();

const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authSecret() {
  return process.env.AUTH_SECRET || process.env.DB_PASSWORD || "sarva-dev-auth-secret";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", authSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
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

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, storedHash) {
  const { hash } = hashPassword(password, salt);
  return (
    storedHash.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(hash))
  );
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    roles: row.roles || [],
  };
}

async function getUserById(userId) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        COALESCE(
          json_agg(
            json_build_object('name', r.name, 'label', r.label)
            ORDER BY r.name
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM sarva.app_user u
      LEFT JOIN sarva.app_user_role ur ON ur.user_id = u.id
      LEFT JOIN sarva.auth_role r ON r.id = ur.role_id
      WHERE u.id = $1
        AND u.is_active = true
      GROUP BY u.id
    `,
    [userId]
  );

  return result.rows[0] || null;
}

function tokenFor(user) {
  const now = Math.floor(Date.now() / 1000);
  return signPayload({
    sub: String(user.id),
    email: user.email,
    roles: user.roles.map((role) => role.name),
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
}

authRouter.get("/auth/roles", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, label, description
      FROM sarva.auth_role
      ORDER BY
        CASE name
          WHEN 'viewer' THEN 1
          WHEN 'contributor' THEN 2
          WHEN 'admin' THEN 3
          ELSE 4
        END,
        label
    `);

    res.json({ status: "ok", data: result.rows });
  } catch (error) {
    console.error("Failed to load roles:", error);
    res.status(500).json({ status: "error", message: "Unable to load roles" });
  }
});

authRouter.post("/auth/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const displayName = String(req.body.displayName || req.body.display_name || "").trim();
  const password = String(req.body.password || "");

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ status: "error", message: "Enter a valid email address" });
  }

  if (displayName.length < 2) {
    return res.status(400).json({ status: "error", message: "Display name is required" });
  }

  if (password.length < 4) {
    return res.status(400).json({ status: "error", message: "Password must be at least 4 characters" });
  }

  const roleName = "viewer";
  const { salt, hash } = hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const role = await client.query("SELECT id FROM sarva.auth_role WHERE name = $1", [roleName]);
    if (role.rowCount === 0) {
      throw new Error("Default role is not configured");
    }

    const inserted = await client.query(
      `
        INSERT INTO sarva.app_user (email, display_name, password_hash, password_salt)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [email, displayName, hash, salt]
    );

    await client.query(
      "INSERT INTO sarva.app_user_role (user_id, role_id) VALUES ($1, $2)",
      [inserted.rows[0].id, role.rows[0].id]
    );

    await client.query("COMMIT");

    const user = await getUserById(inserted.rows[0].id);
    res.status(201).json({ status: "ok", data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({ status: "error", message: "An account with this email already exists" });
    }

    console.error("Registration failed:", error);
    res.status(500).json({ status: "error", message: "Unable to register account" });
  } finally {
    client.release();
  }
});

authRouter.post("/auth/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  try {
    const credentials = await pool.query(
      `
        SELECT id, password_hash, password_salt
        FROM sarva.app_user
        WHERE lower(email) = $1
          AND is_active = true
      `,
      [email]
    );

    const row = credentials.rows[0];
    if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) {
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    await pool.query("UPDATE sarva.app_user SET last_login_at = now() WHERE id = $1", [row.id]);

    const user = await getUserById(row.id);
    res.json({ status: "ok", data: { user: publicUser(user), token: tokenFor(user) } });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(500).json({ status: "error", message: "Unable to log in" });
  }
});

authRouter.get("/auth/me", async (req, res) => {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  try {
    const payload = verifyToken(token);
    if (!payload?.sub) {
      return res.status(401).json({ status: "error", message: "Not authenticated" });
    }

    const user = await getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ status: "error", message: "Not authenticated" });
    }

    res.json({ status: "ok", data: { user: publicUser(user) } });
  } catch (error) {
    console.error("Auth check failed:", error);
    res.status(401).json({ status: "error", message: "Not authenticated" });
  }
});

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function passwordRecord(username, password) {
  if (!/^[a-zA-Z0-9._-]{2,64}$/.test(username)) throw Error('Use a username of 2–64 letters, numbers, dots, underscores or hyphens.');
  if (password.length < 16 || password.length > 256) throw Error('Use a password of 16–256 characters.');
  const salt = randomBytes(16).toString('hex');
  return { username, salt, digest: scryptSync(password, salt, 64).toString('hex') };
}
export function verify(record, username, password) {
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 256) return false;
  const user = createHash('sha256').update(username).digest();
  const expected = createHash('sha256').update(record.username).digest();
  const digest = scryptSync(password, record.salt, 64);
  return timingSafeEqual(user, expected) && timingSafeEqual(digest, Buffer.from(record.digest, 'hex'));
}

export function sessions({ ttl = 2 * 60 * 60 * 1000, clock = Date.now } = {}) {
  const entries = new Map();
  const key = value => createHash('sha256').update(value).digest('hex');
  return {
    issue() {
      for (const [id, expiry] of entries) if (expiry <= clock()) entries.delete(id);
      if (entries.size >= 1000) entries.delete(entries.keys().next().value);
      const token = randomBytes(32).toString('base64url');
      entries.set(key(token), clock() + ttl);
      return token;
    },
    valid(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) return false;
      const id = key(token), expiry = entries.get(id);
      if (!expiry || expiry <= clock()) { entries.delete(id); return false; }
      return true;
    },
    revoke(token) { if (token) entries.delete(key(token)); },
  };
}

export function limiter({ limit = 10, windowMs = 15 * 60 * 1000, clock = Date.now } = {}) {
  const buckets = new Map();
  return ip => {
    const now = clock();
    if (buckets.size > 10000) {
      for (const [key, value] of buckets) if (now >= value.until) buckets.delete(key);
      if (buckets.size > 10000) return false;
    }
    let bucket = buckets.get(ip);
    if (!bucket || now >= bucket.until) { bucket = { count: 0, until: now + windowMs }; buckets.set(ip, bucket); }
    bucket.count++;
    return bucket.count <= limit;
  };
}

CREATE TABLE IF NOT EXISTS sarva.passkey_identity (
 user_id bigint NOT NULL REFERENCES sarva.app_user(id) ON DELETE CASCADE,
 rp_id text NOT NULL,user_handle bytea NOT NULL,
 PRIMARY KEY(user_id,rp_id),UNIQUE(rp_id,user_handle)
);
CREATE TABLE IF NOT EXISTS sarva.account_passkey (
 rp_id text NOT NULL,credential_id text NOT NULL,
 user_id bigint NOT NULL REFERENCES sarva.app_user(id) ON DELETE CASCADE,
 public_key bytea NOT NULL,counter bigint NOT NULL CHECK(counter>=0),
 transports jsonb NOT NULL DEFAULT '[]',device_type text,backed_up boolean NOT NULL DEFAULT false,
 label text NOT NULL DEFAULT 'My passkey',created_at timestamptz NOT NULL DEFAULT now(),last_used_at timestamptz,
 PRIMARY KEY(rp_id,credential_id)
);
CREATE INDEX IF NOT EXISTS account_passkey_user_idx ON sarva.account_passkey(user_id,rp_id);
CREATE TABLE IF NOT EXISTS sarva.passkey_challenge (
 token_hash text PRIMARY KEY,challenge text NOT NULL,purpose text NOT NULL CHECK(purpose IN ('register','authenticate')),
 user_id bigint REFERENCES sarva.app_user(id) ON DELETE CASCADE,rp_id text NOT NULL,origin text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes'
);
CREATE INDEX IF NOT EXISTS passkey_challenge_expiry_idx ON sarva.passkey_challenge(expires_at);

CREATE TABLE sarva.cgc_work (
 id bigserial PRIMARY KEY,title text NOT NULL,description text NOT NULL,centres text[] NOT NULL,kind text NOT NULL,publication_year integer,
 authors text NOT NULL DEFAULT '',citation text NOT NULL DEFAULT '',licence text NOT NULL DEFAULT '',source_url text NOT NULL DEFAULT '',evidence_url text NOT NULL DEFAULT '',data_access text NOT NULL DEFAULT 'not-stated',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','changes-requested','archived')),review_note text NOT NULL DEFAULT '',created_by bigint REFERENCES sarva.app_user(id),revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),file_key text,file_name text,file_type text,file_size integer,file_sha256 text);
CREATE INDEX cgc_work_public ON sarva.cgc_work(status,publication_year DESC,id DESC);
CREATE TABLE sarva.cgc_work_event(id bigserial PRIMARY KEY,work_id bigint NOT NULL REFERENCES sarva.cgc_work(id),actor_id bigint REFERENCES sarva.app_user(id),action text NOT NULL,note text NOT NULL DEFAULT '',revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now());

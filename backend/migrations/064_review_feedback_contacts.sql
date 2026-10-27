ALTER TABLE sarva.review_issue
 ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '';
ALTER TABLE sarva.review_issue DROP CONSTRAINT IF EXISTS review_issue_kind_check;
ALTER TABLE sarva.review_issue ADD CONSTRAINT review_issue_kind_check
 CHECK(kind IN ('bug','update','comment','feedback','question'));

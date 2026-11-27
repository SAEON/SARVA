-- New activity only; no historical badge flood. Delivery and source writes are atomic.
CREATE TABLE sarva.account_notification (
 id bigserial PRIMARY KEY,
 recipient_id bigint NOT NULL REFERENCES sarva.app_user(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('issue','registration','reply')),
 source_id bigint NOT NULL,
 issue_id bigint REFERENCES sarva.review_issue(id) ON DELETE CASCADE,
 user_id bigint REFERENCES sarva.app_user(id) ON DELETE CASCADE,
 event_id bigint REFERENCES sarva.review_issue_event(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(recipient_id,kind,source_id)
);
CREATE INDEX account_notification_unread ON sarva.account_notification(recipient_id,id DESC) WHERE read_at IS NULL;
CREATE FUNCTION sarva.notify_account_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='app_user' THEN
  INSERT INTO sarva.account_notification(recipient_id,kind,source_id,user_id)
   SELECT DISTINCT u.id,'registration',NEW.id,NEW.id FROM sarva.app_user u
   JOIN sarva.app_user_role ur ON ur.user_id=u.id JOIN sarva.auth_role r ON r.id=ur.role_id
   WHERE u.is_active AND r.name='admin' AND u.id<>NEW.id;
 ELSIF TG_TABLE_NAME='review_issue' THEN
  INSERT INTO sarva.account_notification(recipient_id,kind,source_id,issue_id)
   SELECT DISTINCT u.id,'issue',NEW.id,NEW.id FROM sarva.app_user u
   JOIN sarva.app_user_role ur ON ur.user_id=u.id JOIN sarva.auth_role r ON r.id=ur.role_id
   WHERE u.is_active AND r.name='admin' AND u.id<>NEW.created_by;
 ELSIF NEW.event_type IN ('reply','review') THEN
  INSERT INTO sarva.account_notification(recipient_id,kind,source_id,issue_id,event_id)
   SELECT i.created_by,'reply',NEW.id,i.id,NEW.id FROM sarva.review_issue i
   JOIN sarva.app_user u ON u.id=i.created_by
   WHERE i.id=NEW.issue_id AND i.deleted_at IS NULL AND u.is_active AND i.created_by<>NEW.actor_user_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_registration_notice AFTER INSERT ON sarva.app_user FOR EACH ROW EXECUTE FUNCTION sarva.notify_account_activity();
CREATE TRIGGER account_issue_notice AFTER INSERT ON sarva.review_issue FOR EACH ROW EXECUTE FUNCTION sarva.notify_account_activity();
CREATE TRIGGER account_reply_notice AFTER INSERT ON sarva.review_issue_event FOR EACH ROW EXECUTE FUNCTION sarva.notify_account_activity();

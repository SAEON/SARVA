INSERT INTO sarva.auth_role(name,label,description) VALUES
 ('cgc-admin','CGC admin','Review, publish and manage CGC work only. Does not grant platform user management or analytics access.'),
 ('cgc-user','CGC user','Submit and edit own CGC work and upload files for review. Does not grant publishing or platform administration.')
ON CONFLICT(name) DO NOTHING;

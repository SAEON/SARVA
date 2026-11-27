-- Additive options only; existing preferences and submissions are retained.
ALTER TABLE sarva.cgc_member_preference DROP CONSTRAINT cgc_member_preference_centre_check;
ALTER TABLE sarva.cgc_member_preference ADD CONSTRAINT cgc_member_preference_centre_check CHECK(centre IN ('spu','ufs','ufh','ul','wsu','nwu','univen'));

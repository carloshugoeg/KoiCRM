-- Follow-up notes are now free text, not catalog-backed reason keys.
ALTER TABLE "FollowUp" RENAME COLUMN "reasonKey" TO "note";
ALTER TABLE "FollowUp" ALTER COLUMN "note" DROP NOT NULL;

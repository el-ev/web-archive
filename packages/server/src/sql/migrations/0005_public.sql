-- Migration number: 0005 	 2026-03-23
ALTER TABLE folders ADD COLUMN isPublic INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_folders_isPublic ON folders(isPublic);

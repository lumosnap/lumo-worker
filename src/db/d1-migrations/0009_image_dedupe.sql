-- Merge images that a repeated confirm added twice, then forbid it with a unique index.
-- Totals are recounted for every album and profile (also repairs drift from racing counters).
-- Survivor = highest id per (album, source hash), rows without a hash by (album, b2 key): a
-- retried confirm's last row is the one whose id the desktop stored.
-- Links on a loser move to the survivor. Storage objects are never deleted here: loser keys no
-- survivor uses go to orphan_b2_keys for a reviewed cleanup later (a key may be shared).

-- One window pass (a correlated min() per row is O(n^2) per album and hits D1's time limit).
-- NULLs partition together: hashed rows group by hash, hashless rows by key.
CREATE TABLE `_dup` AS
  SELECT id AS loser,
    max(id) OVER (PARTITION BY album_id, source_image_hash,
                  CASE WHEN source_image_hash IS NULL THEN b2_file_name END) AS keep
  FROM images;
--> statement-breakpoint
DELETE FROM `_dup` WHERE loser = keep;
--> statement-breakpoint
INSERT OR IGNORE INTO favorites (album_id, image_id, client_name, notes, created_at)
  SELECT f.album_id, d.keep, f.client_name, f.notes, f.created_at FROM favorites f JOIN `_dup` d ON f.image_id = d.loser;
--> statement-breakpoint
-- the client already starred the survivor: keep the loser's note if the survivor has none
UPDATE favorites SET notes = (SELECT f2.notes FROM favorites f2 JOIN `_dup` d ON f2.image_id = d.loser
    WHERE d.keep = favorites.image_id AND f2.client_name = favorites.client_name AND f2.notes IS NOT NULL LIMIT 1)
  WHERE notes IS NULL AND image_id IN (SELECT keep FROM `_dup`);
--> statement-breakpoint
INSERT OR IGNORE INTO set_images (album_id, set_id, image_id, position)
  SELECT s.album_id, s.set_id, d.keep, s.position FROM set_images s JOIN `_dup` d ON s.image_id = d.loser;
--> statement-breakpoint
INSERT OR IGNORE INTO image_people (album_id, person_id, image_id)
  SELECT p.album_id, p.person_id, d.keep FROM image_people p JOIN `_dup` d ON p.image_id = d.loser;
--> statement-breakpoint
UPDATE album_sets SET cover_image_id = (SELECT keep FROM `_dup` WHERE loser = cover_image_id)
  WHERE cover_image_id IN (SELECT loser FROM `_dup`);
--> statement-breakpoint
UPDATE album_people SET cover_image_id = (SELECT keep FROM `_dup` WHERE loser = cover_image_id)
  WHERE cover_image_id IN (SELECT loser FROM `_dup`);
--> statement-breakpoint
-- Key lookups: the orphan check below, and the shared-key check on every image delete
CREATE INDEX IF NOT EXISTS `images_album_b2_key_idx` ON `images` (`album_id`, `b2_file_name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `images_album_thumb_key_idx` ON `images` (`album_id`, `thumbnail_b2_file_name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `orphan_b2_keys` (
  `key` text PRIMARY KEY NOT NULL,
  `is_secondary` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `_lk` AS
  SELECT i.album_id, i.b2_file_name AS key FROM images i JOIN `_dup` d ON i.id = d.loser
  UNION
  SELECT i.album_id, i.thumbnail_b2_file_name FROM images i JOIN `_dup` d ON i.id = d.loser
  WHERE i.thumbnail_b2_file_name IS NOT NULL;
--> statement-breakpoint
DELETE FROM images WHERE id IN (SELECT loser FROM `_dup`);
--> statement-breakpoint
INSERT OR IGNORE INTO orphan_b2_keys (key, is_secondary)
  SELECT k.key, a.is_secondary_storage FROM `_lk` k JOIN albums a ON a.id = k.album_id
  WHERE NOT EXISTS (SELECT 1 FROM images s WHERE s.album_id = k.album_id AND s.b2_file_name = k.key)
    AND NOT EXISTS (SELECT 1 FROM images s WHERE s.album_id = k.album_id AND s.thumbnail_b2_file_name = k.key);
--> statement-breakpoint
UPDATE albums SET
  total_images = (SELECT count(*) FROM images WHERE album_id = albums.id),
  total_size = (SELECT coalesce(sum(file_size), 0) FROM images WHERE album_id = albums.id);
--> statement-breakpoint
UPDATE profiles SET total_images = (SELECT count(*) FROM images i JOIN albums a ON a.id = i.album_id WHERE a.user_id = profiles.user_id);
--> statement-breakpoint
DROP TABLE `_dup`;
--> statement-breakpoint
DROP TABLE `_lk`;
--> statement-breakpoint
CREATE UNIQUE INDEX `images_album_hash_uq` ON `images` (`album_id`, `source_image_hash`) WHERE `source_image_hash` IS NOT NULL;

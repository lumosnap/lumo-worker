ALTER TABLE `images` ADD `captured_at` integer;
ALTER TABLE `images` ADD `burst_id` text;
ALTER TABLE `images` ADD `is_burst_cover` integer;
ALTER TABLE `images` ADD `moment_id` text;
ALTER TABLE `images` ADD `phash` text;
ALTER TABLE `images` ADD `sharpness` real;
ALTER TABLE `images` ADD `thumbhash` text;
CREATE INDEX `images_captured_at_idx` ON `images` (`album_id`,`captured_at`);

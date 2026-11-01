CREATE TABLE `album_sets` (
	`album_id` text(25) NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`cover_image_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`album_id`, `id`),
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `album_sets_album_position_idx` ON `album_sets` (`album_id`,`position`);
CREATE TABLE `set_images` (
	`album_id` text(25) NOT NULL,
	`set_id` text NOT NULL,
	`image_id` integer NOT NULL,
	`position` integer,
	PRIMARY KEY(`album_id`, `set_id`, `image_id`),
	FOREIGN KEY (`album_id`,`set_id`) REFERENCES `album_sets`(`album_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `set_images_image_id_idx` ON `set_images` (`image_id`);

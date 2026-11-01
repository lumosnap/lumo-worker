CREATE TABLE `album_people` (
	`album_id` text(25) NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`cover_image_id` integer,
	`box` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`album_id`, `id`),
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `album_people_album_position_idx` ON `album_people` (`album_id`,`position`);
CREATE TABLE `image_people` (
	`album_id` text(25) NOT NULL,
	`person_id` text NOT NULL,
	`image_id` integer NOT NULL,
	PRIMARY KEY(`album_id`, `person_id`, `image_id`),
	FOREIGN KEY (`album_id`,`person_id`) REFERENCES `album_people`(`album_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `image_people_image_id_idx` ON `image_people` (`image_id`);
CREATE TABLE `client_people` (
	`album_id` text(25) NOT NULL,
	`client_name` text NOT NULL,
	`person_id` text,
	PRIMARY KEY(`album_id`, `client_name`),
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`,`person_id`) REFERENCES `album_people`(`album_id`,`id`) ON UPDATE no action ON DELETE cascade
);

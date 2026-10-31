CREATE TABLE `album_people` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text(25) NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`cover_image_id` integer,
	`box` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cover_image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `album_people_album_position_idx` ON `album_people` (`album_id`,`position`);
CREATE TABLE `image_people` (
	`person_id` text NOT NULL,
	`image_id` integer NOT NULL,
	PRIMARY KEY(`person_id`, `image_id`),
	FOREIGN KEY (`person_id`) REFERENCES `album_people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `image_people_image_id_idx` ON `image_people` (`image_id`);
CREATE TABLE `client_people` (
	`album_id` text(25) NOT NULL,
	`client_name` text NOT NULL,
	`person_id` text,
	PRIMARY KEY(`album_id`, `client_name`),
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `album_people`(`id`) ON UPDATE no action ON DELETE set null
);

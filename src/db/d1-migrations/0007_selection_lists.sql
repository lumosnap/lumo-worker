CREATE TABLE `selection_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text(25) NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`max_picks` integer,
	`deadline` integer,
	`set_limits` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `selection_lists_album_position_idx` ON `selection_lists` (`album_id`,`position`);
CREATE TABLE `list_picks` (
	`list_id` text NOT NULL,
	`image_id` integer NOT NULL,
	`client_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`list_id`, `image_id`, `client_name`),
	FOREIGN KEY (`list_id`) REFERENCES `selection_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `list_picks_list_client_idx` ON `list_picks` (`list_id`,`client_name`);
CREATE TABLE `list_submissions` (
	`list_id` text NOT NULL,
	`client_name` text NOT NULL,
	`submitted_at` integer NOT NULL,
	PRIMARY KEY(`list_id`, `client_name`),
	FOREIGN KEY (`list_id`) REFERENCES `selection_lists`(`id`) ON UPDATE no action ON DELETE cascade
);

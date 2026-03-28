CREATE TABLE `deviceCode` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`last_polled_at` integer,
	`client_id` text,
	`scope` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deviceCode_device_code_unique` ON `deviceCode` (`device_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `deviceCode_user_code_unique` ON `deviceCode` (`user_code`);--> statement-breakpoint
CREATE INDEX `deviceCode_userCode_idx` ON `deviceCode` (`user_code`);--> statement-breakpoint
CREATE INDEX `deviceCode_deviceCode_idx` ON `deviceCode` (`device_code`);--> statement-breakpoint
CREATE INDEX `deviceCode_userId_idx` ON `deviceCode` (`user_id`);--> statement-breakpoint
CREATE INDEX `deviceCode_status_idx` ON `deviceCode` (`status`);--> statement-breakpoint
CREATE INDEX `deviceCode_expiresAt_idx` ON `deviceCode` (`expires_at`);

-- Optimistic versions for the wholesale sets/people replaces (a stale push from another computer
-- gets 409 instead of wiping newer edits). write_token marks which request holds a batch's write.
ALTER TABLE `albums` ADD `sets_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `albums` ADD `people_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `albums` ADD `write_token` text;

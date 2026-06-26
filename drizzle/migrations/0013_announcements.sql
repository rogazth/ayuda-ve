CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`contact` text,
	`url` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `announcements_status_created` ON `announcements` (`status`,`created_at`);

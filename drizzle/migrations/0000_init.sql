CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`zone` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`confirms` integer DEFAULT 0 NOT NULL,
	`flags` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_lat_lng` ON `reports` (`lat`,`lng`);
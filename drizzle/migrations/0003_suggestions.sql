CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`contact` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

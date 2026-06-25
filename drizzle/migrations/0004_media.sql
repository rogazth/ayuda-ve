CREATE TABLE `media` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL,
  `key` text NOT NULL,
  `content_type` text NOT NULL,
  `width` integer NOT NULL,
  `height` integer NOT NULL,
  `position` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE CASCADE
);

CREATE TABLE `report_confirms` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL,
  `ip` text NOT NULL,
  `ua` text NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE CASCADE
);

CREATE INDEX `report_confirms_report_ip` ON `report_confirms` (`report_id`, `ip`);

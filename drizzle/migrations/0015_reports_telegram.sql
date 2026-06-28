-- Espejo a Telegram (@ayudave_reportes): el cron del Worker postea cada reporte
-- nuevo creado por usuarios (external_source IS NULL) una sola vez. notified_at
-- se estampa tras el 200 de Telegram → idempotente, con retry gratis cada tick.
-- Backfill: marca lo existente como ya enviado para no inundar el canal en el deploy.
ALTER TABLE `reports` ADD `notified_at` integer;
--> statement-breakpoint
UPDATE `reports` SET `notified_at` = unixepoch() WHERE `notified_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `reports_unnotified` ON `reports` (`created_at`) WHERE `notified_at` IS NULL AND `external_source` IS NULL;

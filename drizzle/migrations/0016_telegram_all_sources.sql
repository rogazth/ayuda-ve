-- El espejo a Telegram ahora incluye scrapers (no solo submissions de usuario).
-- El índice parcial de la cola se amplía: deja de filtrar por external_source IS NULL
-- para que el cron también encuentre los reportes scrapeados pendientes de envío.
DROP INDEX `reports_unnotified`;
--> statement-breakpoint
CREATE INDEX `reports_unnotified` ON `reports` (`created_at`) WHERE `notified_at` IS NULL;

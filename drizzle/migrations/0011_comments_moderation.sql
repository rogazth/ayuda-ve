-- Comentarios de la comunidad: auto-publican + flags (5 = oculto), autor libre
-- opcional, e ipHash para throttle anti-spam. Índice (report_id, created_at) para
-- listar por reporte en orden cronológico.
ALTER TABLE `comments` ADD `author_name` text;
ALTER TABLE `comments` ADD `status` text DEFAULT 'visible' NOT NULL;
ALTER TABLE `comments` ADD `flags` integer DEFAULT 0 NOT NULL;
ALTER TABLE `comments` ADD `ip_hash` text;
CREATE INDEX IF NOT EXISTS `comments_report` ON `comments` (`report_id`, `created_at`);

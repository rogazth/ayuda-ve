-- Auditoría de moderación: flag/hide/approve/reject sobre cualquier entidad, con
-- hash de IP/UA (no PII). flagReport/flagComment escriben aquí en vez del hack viejo.
CREATE TABLE `moderation_events` (
  `id` text PRIMARY KEY NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `action` text NOT NULL,
  `reason` text,
  `ip_hash` text,
  `ua_hash` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE INDEX `moderation_events_entity` ON `moderation_events` (`entity_type`, `entity_id`);

-- Limpia el hack previo: los motivos de flag se guardaban como filas '[reporte] …'
-- en comments. Ya no se usan (con el default status='visible' serían visibles).
DELETE FROM `comments` WHERE `text` LIKE '[reporte]%';

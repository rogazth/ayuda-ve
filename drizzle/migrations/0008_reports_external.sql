-- Origen externo para reportes scrapeados. (source, id) único = idempotencia
-- del cron: cada corrida hace upsert en vez de duplicar. NULLs distintos en
-- SQLite, así que las filas creadas por usuarios (ambos null) no colisionan.
ALTER TABLE reports ADD COLUMN external_source TEXT;
ALTER TABLE reports ADD COLUMN external_id TEXT;
CREATE UNIQUE INDEX reports_external ON reports (external_source, external_id);

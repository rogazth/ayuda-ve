-- Índice por created_at: el feed cronológico ordena y pagina por fecha. Hasta
-- ahora solo existía el índice (lat,lng) para el bbox del mapa.
CREATE INDEX IF NOT EXISTS reports_created ON reports (created_at);

-- Caché de geocoding: texto libre → lat/lng (Nominatim). Una consulta por texto
-- único para siempre (esquiva el rate-limit). lat null = miss cacheado.
CREATE TABLE geocache (
  query TEXT PRIMARY KEY,
  lat REAL,
  lng REAL,
  precision TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

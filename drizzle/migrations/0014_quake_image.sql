-- Infografía estática de sismos: el admin renderiza mapa+heatmap+markers con
-- Playwright, sube el PNG a R2 y POSTea la key a /internal/quake-image. El mapa
-- vivo deja de pintar sismos; el drawer muestra <img src=image_key>.
ALTER TABLE `quake_snapshot` ADD `image_key` text;
--> statement-breakpoint
ALTER TABLE `quake_snapshot` ADD `image_updated_at` integer;

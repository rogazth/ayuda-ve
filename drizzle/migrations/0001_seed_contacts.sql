-- Custom SQL migration file, put your code below! --
-- Seed de contactos oficiales por zona (bootstrap mínimo).
-- ponytail: números por verificar con fuente local antes de lanzar. Se omiten
-- los gaps (policía Maracaibo/Valencia/Maracay, H. Central Maracay) y el número
-- obsoleto de la Policía Metropolitana de Caracas (disuelta en 2011).
INSERT INTO contacts (id, zone, category, name, phone, source, source_url, status) VALUES
-- Barquisimeto (Lara)
(lower(hex(randomblob(16))), 'Lara', 'bomberos', 'Bomberos de Iribarren', '0251-231-7475', 'oficial', 'https://gelvez.com.ve/barquisimeto/emergencias.html', 'visible'),
(lower(hex(randomblob(16))), 'Lara', 'policia', 'Policía del Estado Lara (PoliLara)', '0251-231-0111', 'oficial', 'https://gelvez.com.ve/barquisimeto/emergencias.html', 'visible'),
(lower(hex(randomblob(16))), 'Lara', 'policia', 'CICPC Barquisimeto', '0251-237-0511', 'oficial', 'https://gelvez.com.ve/barquisimeto/emergencias.html', 'visible'),
(lower(hex(randomblob(16))), 'Lara', 'hospital', 'Hospital Central Antonio María Pineda', '0251-251-9498', 'oficial', 'https://www.hcudamp.gob.ve/', 'visible'),
(lower(hex(randomblob(16))), 'Lara', 'hospital', 'Hospital Pediátrico Agustín Zubillaga', '0251-252-6835', 'oficial', 'https://gelvez.com.ve/barquisimeto/emergencias.html', 'visible'),
(lower(hex(randomblob(16))), 'Lara', 'proteccion_civil', 'Servicio de Emergencias Lara (SEL 171)', '0251-232-2729', 'oficial', 'http://sel171.gob.ve', 'visible'),
-- Caracas (Distrito Capital)
(lower(hex(randomblob(16))), 'Distrito Capital', 'bomberos', 'Bomberos del Distrito Capital', '0212-545-4545', 'oficial', 'https://noticiahoy.es/numeros-de-emergencia-caracas-2024.php', 'visible'),
(lower(hex(randomblob(16))), 'Distrito Capital', 'policia', 'CICPC', '0212-571-3533', 'oficial', 'https://noticiahoy.es/numeros-de-emergencia-caracas-2024.php', 'visible'),
(lower(hex(randomblob(16))), 'Distrito Capital', 'hospital', 'Hospital Universitario de Caracas', '0212-508-6111', 'oficial', 'https://noticiahoy.es/numeros-de-emergencia-caracas-2024.php', 'visible'),
-- Maracaibo (Zulia)
(lower(hex(randomblob(16))), 'Zulia', 'bomberos', 'Bomberos de Maracaibo', '0261-722-6426', 'oficial', 'https://rescateoccidente.org/directorio-de-emergencias/', 'visible'),
(lower(hex(randomblob(16))), 'Zulia', 'hospital', 'Hospital Universitario de Maracaibo (SAHUM)', '0261-752-4815', 'oficial', 'https://rescateoccidente.org/directorio-de-emergencias/', 'visible'),
-- Valencia (Carabobo)
(lower(hex(randomblob(16))), 'Carabobo', 'bomberos', 'Bomberos de Valencia', '0241-824-1851', 'oficial', 'http://www.bomberosvalencia.gob.ve/', 'visible'),
(lower(hex(randomblob(16))), 'Carabobo', 'hospital', 'Ciudad Hospitalaria Dr. Enrique Tejera (CHET)', '0241-867-7111', 'oficial', 'https://www.doctores.com.ve/hospitales/ciudad-hospitalaria-dr-enrique-tejera', 'visible'),
-- Maracay (Aragua)
(lower(hex(randomblob(16))), 'Aragua', 'bomberos', 'Bomberos de Aragua', '0424-345-6408', 'oficial', 'https://efectococuyo.com/la-humanidad/numeros-de-emergencia-de-bomberos-y-proteccion-civil/', 'visible'),
(lower(hex(randomblob(16))), 'Aragua', 'proteccion_civil', 'Protección Civil Aragua', '0243-247-1778', 'oficial', 'https://www.pcivil.gob.ve/aragua/', 'visible'),
(lower(hex(randomblob(16))), 'Aragua', 'proteccion_civil', 'Línea 171 Aragua', '0243-244-0016', 'oficial', 'https://efectococuyo.com/la-humanidad/numeros-de-emergencia-de-bomberos-y-proteccion-civil/', 'visible');

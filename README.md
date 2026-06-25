# AyudaVE

> Reportes ciudadanos de emergencia para Venezuela. Anónimo, colaborativo y pensado para funcionar cuando todo lo demás falla.

**Estado:** 🚧 En construcción.

AyudaVE nació de la emergencia del terremoto: una app web donde cualquiera, sin registrarse, puede reportar y encontrar ayuda en un mapa — heridos, derrumbes, cortes de servicios, albergues y puntos de apoyo. Sobre los reportes ciudadanos hay una **capa sembrada** (números de emergencia y hospitales de OpenStreetMap) para que sea útil desde el primer minuto, aun sin reportes.

## Filosofía

- **Útil en el peor escenario.** Red 2G, batería al 10%, Android viejo. Lo simple gana; cada feature pelea su lugar.
- **Sin fricción, anónimo.** Sin login ni cuentas. Reportar toma 20 segundos.
- **La comunidad verifica, no un moderador.** Los datos se confirman o se marcan como falsos con contadores; no dependemos de aprobar uno por uno.
- **Útil desde vacío.** Números de emergencia y hospitales sembrados desde el día 1.
- **Abierto.** Cualquiera puede correrlo, forkearlo o mejorarlo.

## Cómo funciona

Mapa fullscreen con tu ubicación → pins de reportes cercanos → click para ver el detalle (confirmar, marcar, comentar) → botón "+" para crear un reporte anónimo.

Tipos de reporte:
🔴 heridos · 🟠 derrumbe/daño · 🟡 corte de servicios · 🔵 albergue/ayuda · ⚪ otro

## Stack

TanStack Start · Cloudflare D1 + Drizzle · Cloudflare R2 · Pages + Workers · Leaflet + OpenStreetMap.

Todo en el edge de Cloudflare, sin API keys de mapas.

## Correr local

```
git clone https://github.com/rogazth/ayuda-ve
cd ayuda-ve
```

## Colaborar

Toda ayuda suma. Abre un issue o manda un PR, sin proceso pesado.

## Licencia

[MIT](LICENSE).

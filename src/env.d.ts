// MAPBOX_TOKEN es un runtime secret (.dev.vars en local, `wrangler secret` en
// prod). No lo conoce `wrangler types`, así que lo declaramos a mano. Augmenta
// Cloudflare.Env (lo que tipa el `env` de 'cloudflare:workers'); sobrevive a
// regenerar worker-configuration.d.ts.
declare namespace Cloudflare {
  interface Env {
    MAPBOX_TOKEN: string
    // Ingest interno (admin Laravel → /internal/*). Secret + var; el middleware
    // falla cerrado si faltan. INGEST_ALLOWED_IPS es CSV de IPs del VPS.
    INGEST_SERVICE_KEY?: string
    INGEST_ALLOWED_IPS?: string
  }
}

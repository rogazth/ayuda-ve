// MAPBOX_TOKEN es un runtime secret (.dev.vars en local, `wrangler secret` en
// prod). No lo conoce `wrangler types`, así que lo declaramos a mano. Augmenta
// Cloudflare.Env (lo que tipa el `env` de 'cloudflare:workers'); sobrevive a
// regenerar worker-configuration.d.ts.
declare namespace Cloudflare {
  interface Env {
    MAPBOX_TOKEN: string
  }
}

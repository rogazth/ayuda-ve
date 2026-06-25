import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:workers'
import * as schema from './schema'

// `env` se inyecta por request en el runtime de Cloudflare; por eso getDb()
// se llama dentro de cada handler, no en el scope del módulo.
export function getDb() {
  return drizzle(env.DB, { schema })
}

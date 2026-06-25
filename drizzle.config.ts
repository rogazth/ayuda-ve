import { defineConfig } from 'drizzle-kit'

// Solo para `drizzle-kit generate` (crea el SQL). El apply lo hace wrangler
// contra D1 (local o remoto), por eso no necesita credenciales aquí.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
})

import { defineConfig } from 'vitest/config'

// Config propia de Vitest: toma prioridad sobre vite.config.ts y así NO carga el
// plugin de Cloudflare (incompatible con Vitest). Los tests son de lógica pura.
export default defineConfig({
  test: { environment: 'node' },
})

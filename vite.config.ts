import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// devtools() solo en dev (`serve`): fuera del bundle de prod.
const config = defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(command === 'serve' ? [devtools()] : []),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))

export default config

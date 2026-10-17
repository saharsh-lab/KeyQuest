import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Emits sw.js with every built and public file precached, so the installed app works offline. */
function serviceWorker(): Plugin {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url))
  return {
    name: 'keyquest-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const pub = readdirSync(publicDir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && e.name !== '.DS_Store')
        .map((e) => `${e.parentPath.slice(publicDir.length + 1)}/${e.name}`.replace(/^\//, ''))
      const files = ['./', ...new Set(['index.html', ...built, ...pub])].sort()
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      const source = readFileSync(fileURLToPath(new URL('./pwa/sw.js', import.meta.url)), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// Relative base so the production build can be served from any path (static hosting, file previews).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})

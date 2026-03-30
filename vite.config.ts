import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import fs from 'fs'
import path from 'path'

const isDev = process.env.NODE_ENV !== 'production'

const httpsConfig = isDev
  ? {
      key: fs.readFileSync(path.resolve(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')),
    }
  : undefined

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    https: httpsConfig,
    host: '0.0.0.0',
    port: 3007,
  },
})

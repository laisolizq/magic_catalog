import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/magic_catalog/',
  // Pre-bundle heavy deps at server start instead of blocking first request
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx'],
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo_cardscade.png'],
      manifest: {
        name: 'Cardscade',
        short_name: 'Cardscade',
        description: 'Browse and review Magic: The Gathering cards',
        start_url: '/magic_catalog/',
        display: 'standalone',
        background_color: '#f2ecdf',
        theme_color: '#2b2216',
        icons: [
          {
            src: 'logo_cardscade.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logo_cardscade.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})

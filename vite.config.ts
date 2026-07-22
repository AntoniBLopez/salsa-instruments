import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'pwa-192.png',
        'pwa-512.png',
        'samples/**/*.wav',
        'images/**/*.svg',
      ],
      manifest: {
        name: 'Salsa Instruments',
        short_name: 'Salsa',
        description:
          'Apila instrumentos de salsa y mambo, controla el tempo y practica la clave.',
        lang: 'es',
        theme_color: '#14110f',
        background_color: '#121820',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Precache app shell + samples (~0.5 MB) for full offline use
        globPatterns: ['**/*.{js,css,html,ico,svg,png,wav,woff,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})

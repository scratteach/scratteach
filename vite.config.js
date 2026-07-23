import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Scratteach - スクラッティーチ',
        short_name: 'Scratteach',
        description: 'Scratchプログラミング専用AIチャット',
        theme_color: '#FF6600',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // 新しいService Workerを待たせず即有効化し、古いキャッシュを掃除する。
        // これでデプロイ後の再読み込みで最新版が確実に反映される。
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
    })
  ],
})

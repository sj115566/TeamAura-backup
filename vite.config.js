import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Team Aura 波導戰隊',
        short_name: 'Team Aura',
        description: 'Team Aura 戰隊管理系統',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/1067/1067256.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/1067/1067256.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // ⚠️ 重要：GitHub Pages 通常部署在子路徑，例如 /my-repo/
  // 如果你的 Repo 名稱是 'team-aura-app'，這裡就要設為 '/team-aura-app/'
  // 如果你是用 user.github.io 的主域名，就維持 '/'
  base: './' 
})
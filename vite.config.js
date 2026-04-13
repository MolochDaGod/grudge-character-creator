import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    proxy: {
      // Proxy /assets to the parent directory for local FBX files
      '/assets': {
        target: 'http://localhost:3000',
        rewrite: () => '',
        configure: (proxy, options) => {
          // Not needed — handled by fs.allow below
        },
      },
    },
    fs: {
      // Allow Vite to serve files from parent (factioncharacters, animationsweapons)
      allow: ['.', '..'],
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['three', 'three/addons/controls/OrbitControls.js', 'three/addons/loaders/FBXLoader.js'],
    },
  },
});

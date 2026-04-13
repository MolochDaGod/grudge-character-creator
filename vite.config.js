import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    fs: {
      // Allow Vite to serve files from parent dir (factioncharacters, animationsweapons)
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

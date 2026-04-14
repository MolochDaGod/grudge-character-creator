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
      // Externalize all Three.js imports — resolved at runtime via importmap in index.html
      external: (id) => id === 'three' || id.startsWith('three/'),
    },
  },
});

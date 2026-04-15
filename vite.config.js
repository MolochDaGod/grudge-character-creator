import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    fs: {
      // Allow Vite to serve files from parent dir (factioncharacters, animationsweapons, environment)
      allow: ['.', '..'],
      strict: false,
    },
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      'three/addons/': 'three/examples/jsm/',
      // Allow /assets/ prefix to load from parent directory
      '/assets': path.resolve(__dirname, '..'),
    },
  },
});

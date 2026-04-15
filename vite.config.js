import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

/**
 * Vite plugin: Serves /assets/* from the parent directory at runtime.
 * This is needed because Three.js loaders (FBXLoader, GLTFLoader) make
 * HTTP requests — resolve.alias only works for JS import statements.
 */
function serveParentAssets() {
  const parentDir = path.resolve(__dirname, '..');
  const MIME = {
    '.fbx': 'application/octet-stream',
    '.gltf': 'model/gltf+json',
    '.glb': 'model/gltf-binary',
    '.bin': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tga': 'application/octet-stream',
    '.hdr': 'application/octet-stream',
    '.tif': 'image/tiff',
    '.json': 'application/json',
  };
  return {
    name: 'serve-parent-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/assets/')) return next();
        const relPath = decodeURIComponent(req.url.replace('/assets/', ''));
        const filePath = path.join(parentDir, relPath);
        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found: ' + req.url);
          return;
        }
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [serveParentAssets()],
  server: {
    port: 3000,
    fs: {
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
    },
  },
});

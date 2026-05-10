import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

/**
 * Asset roots — maps URL prefix → absolute filesystem directory.
 *
 * /assets/factioncharacters/ → F:\Documents\Toon_RTS\Toon_RTS  (race FBX models)
 * /assets/animationsweapons/ → D:\Games\Models\grudgeracecharacters\animationsweapons (if present)
 * /assets/*                  → D:\Games\Models\grudgeracecharacters  (everything else)
 *
 * Checked in order: first match wins.
 */
const ASSET_ROOTS = [
  {
    prefix: '/assets/factioncharacters/',
    dir:    'F:\\Documents\\Toon_RTS\\Toon_RTS',
  },
  {
    prefix: '/assets/',
    dir:    path.resolve(__dirname, '..'),
  },
];

const MIME = {
  '.fbx':  'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.glb':  'model/gltf-binary',
  '.bin':  'application/octet-stream',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tga':  'application/octet-stream',
  '.hdr':  'application/octet-stream',
  '.tif':  'image/tiff',
  '.json': 'application/json',
};

function serveParentAssets() {
  return {
    name: 'serve-parent-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/assets/')) return next();
        const url = decodeURIComponent(req.url);

        // Find first matching root
        let filePath = null;
        for (const { prefix, dir } of ASSET_ROOTS) {
          if (url.startsWith(prefix)) {
            const rel = url.slice(prefix.length);
            filePath = path.join(dir, rel);
            if (fs.existsSync(filePath)) break;
            filePath = null; // try next root
          }
        }

        if (!filePath) {
          res.statusCode = 404;
          res.end('Asset not found: ' + req.url);
          return;
        }

        const stat = fs.statSync(filePath);
        const ext  = path.extname(filePath).toLowerCase();
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
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});

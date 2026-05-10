/**
 * Grudge Studio Edge Proxy — routes subdomains to Vercel deployments.
 *
 * Deployed at:
 *   characters.grudge-studio.com  → playground Vercel project
 *   grudachain.grudge-studio.com  → grudachain Vercel project
 *
 * Benefits over CNAME:
 *   - No manual DNS records needed (wrangler auto-creates them)
 *   - Cloudflare CDN + DDoS in front of Vercel
 *   - Can add headers, auth, rate limiting at the edge
 */

const ROUTES = {
  'characters.grudge-studio.com': 'https://playground-teal-zeta.vercel.app',
  'grudachain.grudge-studio.com': 'https://grudachain.grudgestudio.com',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    const target = ROUTES[host];
    if (!target) {
      return new Response('Not found', { status: 404 });
    }

    // Rewrite the request to the Vercel backend
    const targetUrl = new URL(url.pathname + url.search, target);

    const proxyReq = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'manual',
    });

    // Set the Host header to what Vercel expects
    proxyReq.headers.set('Host', new URL(target).hostname);
    proxyReq.headers.set('X-Forwarded-Host', host);
    proxyReq.headers.set('X-Forwarded-Proto', 'https');

    const resp = await fetch(proxyReq);

    // Clone response with CORS and security headers
    const headers = new Headers(resp.headers);
    headers.set('X-Proxied-By', 'grudge-edge-proxy');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};

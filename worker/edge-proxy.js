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

/**
 * Proxy routes — hostname → Vercel/Pages backend URL
 * Traffic hits Cloudflare edge, gets proxied to the real origin.
 */
const PROXY_ROUTES = {
  'characters.grudge-studio.com':  'https://playground-teal-zeta.vercel.app',
  'grudachain.grudge-studio.com':  'https://grudachain.grudgestudio.com',
  'objectstore.grudge-studio.com': 'https://grudge-objectstore.pages.dev',
};

/**
 * Redirect routes — hostname → redirect target URL
 * Permanent redirects (301) so browsers cache them.
 */
const REDIRECT_ROUTES = {
  'auth.grudge-studio.com': 'https://id.grudge-studio.com',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    // ── Redirects ──
    const redirectTarget = REDIRECT_ROUTES[host];
    if (redirectTarget) {
      const dest = new URL(url.pathname + url.search, redirectTarget);
      return new Response(null, {
        status: 301,
        headers: {
          'Location': dest.toString(),
          'X-Proxied-By': 'grudge-edge-proxy',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // ── Proxy ──
    const target = PROXY_ROUTES[host];
    if (!target) {
      return new Response(JSON.stringify({ error: 'Unknown host', host }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetUrl = new URL(url.pathname + url.search, target);

    const proxyReq = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'manual',
    });

    // Set Host to what the origin expects
    proxyReq.headers.set('Host', new URL(target).hostname);
    proxyReq.headers.set('X-Forwarded-Host', host);
    proxyReq.headers.set('X-Forwarded-Proto', 'https');

    const resp = await fetch(proxyReq);

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

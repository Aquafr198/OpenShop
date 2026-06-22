import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createServerHandlers,
  createContentSecurityPolicy,
  getCartId,
  formatMoney,
  type Cart,
} from "@openshop/core";
import { storefront, cart as cartClient, catalog } from "./storefront.js";
import { i18n } from "./i18n.js";
import { env } from "./env.js";

const { handleShopifyRoutes, handleShopifyRedirects } = createServerHandlers({
  storefront,
  storeDomain: env.storeDomain,
  cart: { client: cartClient },
});

async function app(request: Request): Promise<Response> {
  // Pre-router: proxy + cart endpoints
  const owned = await handleShopifyRoutes(request);
  if (owned) return owned;

  // i18n
  const { locale, basename } = i18n.match(request);
  const appPath = new URL(request.url).pathname.slice(basename.length) || "/";

  // CSP
  const csp = createContentSecurityPolicy();

  // Cart state
  const cartId = getCartId(request);
  const cartData: Cart | null = cartId ? await cartClient.get(cartId) : null;
  const cartCount = cartData?.totalQuantity ?? 0;

  let html: string;

  if (appPath === "/") {
    const product = await catalog.getProduct("classic-tee");
    html = page(csp.nonce, locale.id, `
      <h1>Welcome to {{PROJECT_NAME}}</h1>
      <p>Cart: ${cartCount} items</p>
      ${product ? `<h2>${esc(product.title)}</h2><p>${esc(formatMoney(product.variants[0]?.price ?? { amount: "0", currencyCode: "USD" }))}</p>` : "<p>Configure your .env with a real store domain to see products.</p>"}
    `);
  } else {
    // Post-router: redirects
    const redirect = await handleShopifyRedirects(request);
    if (redirect) return redirect;
    html = page(csp.nonce, locale.id, "<h1>404 — Not found</h1>");
    return new Response(html, {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp.header },
    });
  }

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": csp.header },
  });
}

function esc(s: string) { return s.replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function page(nonce: string, lang: string, body: string) {
  return `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{{PROJECT_NAME}}</title></head>
<body>${body}<script nonce="${nonce}">console.log("OpenShop ready")</script></body>
</html>`;
}

// Node http adapter
async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? `localhost:${env.port}`}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v) headers.set(k, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await new Promise<Buffer>((res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => res(Buffer.concat(chunks)));
  }) : undefined;
  const init: RequestInit = { method: req.method, headers };
  if (body) init.body = new Uint8Array(body);
  return new Request(url, init);
}

createServer((req, res) => {
  void (async () => {
    const request = await toRequest(req);
    const response = await app(request);
    const h: Record<string, string> = {};
    response.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(response.status, h);
    res.end(Buffer.from(await response.arrayBuffer()));
  })();
}).listen(env.port, () => {
  console.log(`🛒 {{PROJECT_NAME}} on http://localhost:${env.port}`);
});

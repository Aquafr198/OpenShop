/**
 * Adapts the Web-standard app handler to Node's http server. Run with:
 *   pnpm --filter @openshop/example-node-storefront start
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost:${PORT}`;
  const url = `http://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;

  const init: RequestInit = { method: req.method, headers };
  if (body !== undefined) init.body = new Uint8Array(body);
  return new Request(url, init);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers = new Headers(response.headers);
  const setCookies =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

  const plain: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") continue;
    plain[key] = value;
  }

  res.writeHead(response.status, {
    ...plain,
    ...(setCookies.length ? { "set-cookie": setCookies } : {}),
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}

createServer((req, res) => {
  void (async () => {
    try {
      const request = await toRequest(req);
      const response = await app(request);
      await writeResponse(res, response);
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`Internal error: ${(error as Error).message}`);
    }
  })();
}).listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`OpenShop example storefront on http://localhost:${PORT}`);
});

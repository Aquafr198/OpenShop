import { formatMoney, type Cart, type Locale } from "@openshop/core";
import { CATALOG } from "./data.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  title: string;
  locale: Locale;
  localeLinks: { locale: Locale; href: string }[];
  cartCount: number;
  cartHref: string;
  body: string;
}): string {
  const switcher = opts.localeLinks
    .map(
      (l) =>
        `<a href="${escapeHtml(l.href)}"${
          l.locale.id === opts.locale.id ? ' aria-current="true"' : ""
        }>${escapeHtml(l.locale.label ?? l.locale.id)}</a>`,
    )
    .join(" · ");

  return `<!doctype html>
<html lang="${escapeHtml(opts.locale.id)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} — OpenShop Example</title>
</head>
<body>
  <header>
    <strong>OpenShop Example</strong>
    <nav>${switcher}</nav>
    <a href="${escapeHtml(opts.cartHref)}">Cart (${opts.cartCount})</a>
  </header>
  <main>${opts.body}</main>
</body>
</html>`;
}

export function renderHome(opts: {
  locale: Locale;
  localeLinks: { locale: Locale; href: string }[];
  cartCount: number;
  cartHref: string;
  cartActionPath: string;
}): string {
  const products = CATALOG.map((v) => {
    const price = formatMoney(
      { amount: v.priceAmount, currencyCode: v.currencyCode },
      { locale: opts.locale.id },
    );
    return `<article>
      <h2>${escapeHtml(v.productTitle)}</h2>
      <p>${escapeHtml(v.variantTitle)} — ${escapeHtml(price)}</p>
      <form method="post" action="${escapeHtml(opts.cartActionPath)}">
        <input type="hidden" name="action" value="add" />
        <input type="hidden" name="merchandiseId" value="${escapeHtml(v.id)}" />
        <button type="submit">Add to cart</button>
      </form>
    </article>`;
  }).join("\n");

  return layout({
    title: "Home",
    locale: opts.locale,
    localeLinks: opts.localeLinks,
    cartCount: opts.cartCount,
    cartHref: opts.cartHref,
    body: `<h1>Products</h1>${products}`,
  });
}

export function renderCart(opts: {
  locale: Locale;
  localeLinks: { locale: Locale; href: string }[];
  cart: Cart | null;
  cartHref: string;
  cartActionPath: string;
  homeHref: string;
}): string {
  const cart = opts.cart;
  let body: string;

  if (!cart || cart.lines.length === 0) {
    body = `<h1>Your cart is empty</h1><a href="${escapeHtml(opts.homeHref)}">Continue shopping</a>`;
  } else {
    const rows = cart.lines
      .map((line) => {
        const lineTotal = formatMoney(line.cost.totalAmount, {
          locale: opts.locale.id,
        });
        return `<tr>
          <td>${escapeHtml(line.merchandise.productTitle)} (${escapeHtml(line.merchandise.title)})</td>
          <td>${line.quantity}</td>
          <td>${escapeHtml(lineTotal)}</td>
          <td>
            <form method="post" action="${escapeHtml(opts.cartActionPath)}">
              <input type="hidden" name="action" value="remove" />
              <input type="hidden" name="lineId" value="${escapeHtml(line.id)}" />
              <button type="submit">Remove</button>
            </form>
          </td>
        </tr>`;
      })
      .join("\n");
    const total = formatMoney(cart.cost.totalAmount, {
      locale: opts.locale.id,
    });
    body = `<h1>Your cart</h1>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p><strong>Total: ${escapeHtml(total)}</strong></p>
      <a href="${escapeHtml(cart.checkoutUrl)}">Checkout</a>`;
  }

  return layout({
    title: "Cart",
    locale: opts.locale,
    localeLinks: opts.localeLinks,
    cartCount: cart?.totalQuantity ?? 0,
    cartHref: opts.cartHref,
    body,
  });
}

export function htmlResponse(html: string, init?: ResponseInit): Response {
  return new Response(html, {
    status: init?.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init?.headers },
  });
}

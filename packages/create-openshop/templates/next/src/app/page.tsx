import { catalog } from "@/lib/storefront";
import { formatMoney } from "@openshop/core";
import { Image } from "@openshop/react";

export default async function HomePage() {
  // Fetch first 4 products (Server Component — runs on the server).
  const product = await catalog.getProduct("classic-tee");

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>{{ PROJECT_NAME }}</h1>
      <p>
        Your OpenShop storefront is running. Edit <code>.env</code> with your
        store credentials.
      </p>

      {product ? (
        <article>
          <h2>{product.title}</h2>
          {product.featuredImage && (
            <Image
              src={product.featuredImage.url}
              alt={product.title}
              width={600}
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          )}
          <p>{product.description}</p>
          <p>
            <strong>
              {formatMoney(
                product.variants[0]?.price ?? {
                  amount: "0",
                  currencyCode: "USD",
                },
              )}
            </strong>
          </p>
        </article>
      ) : (
        <p>
          No product found. Make sure your store has a product with handle
          &quot;classic-tee&quot;.
        </p>
      )}
    </main>
  );
}

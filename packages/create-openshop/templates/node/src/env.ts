/** Load environment variables (works with Node --env-file or dotenv). */

export const env = {
  storeDomain: process.env.PUBLIC_STORE_DOMAIN ?? "demo.myshopify.com",
  publicToken: process.env.PUBLIC_STOREFRONT_API_TOKEN ?? "",
  privateToken: process.env.PRIVATE_STOREFRONT_API_TOKEN,
  port: Number(process.env.PORT ?? 3000),
};

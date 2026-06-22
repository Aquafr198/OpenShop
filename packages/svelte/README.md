# @openshop/svelte

> Svelte stores for [OpenShop](https://github.com/Aquafr198/OpenShop)'s
> framework-agnostic commerce core.

Derives idiomatic Svelte `Readable` stores (plus bound actions) from
[`@openshop/core`](https://www.npmjs.com/package/@openshop/core). Each store
updates only when its slice changes.

## Install

```bash
npm install @openshop/svelte @openshop/core svelte
```

## Cart

```svelte
<script>
  import { createCartStores } from "@openshop/svelte";
  const { count, actions } = createCartStores(cartStore);
</script>

<button on:click={() => actions.addLine({ merchandiseId: "gid://shopify/ProductVariant/123" })}>
  Cart {$count}
</button>
```

`actions` exposes `addLine`, `addLines`, `updateLine`, `removeLine`,
`setDiscountCodes`, `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes`,
`setNote` and `refresh`. `createCartStores` also returns `cart`, `count`,
`status`, `isUpdating` and `error` stores.

Also includes `selectStore`, `createVariantSelection` and
`createPredictiveSearch`.

Full documentation: [monorepo README](https://github.com/Aquafr198/OpenShop#readme).

## License

[MIT](https://github.com/Aquafr198/OpenShop/blob/main/LICENSE.md)

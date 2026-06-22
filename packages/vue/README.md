# @openshop/vue

> Vue 3 composables for [OpenShop](https://github.com/Aquafr198/OpenShop)'s
> framework-agnostic commerce core.

Thin Vue 3 composables over [`@openshop/core`](https://www.npmjs.com/package/@openshop/core),
backed by `computed` refs so components track only the state they read.

## Install

```bash
npm install @openshop/vue @openshop/core vue
```

## Cart

```ts
import { provideCart, useCartCount, useCartActions } from "@openshop/vue";

// In a parent setup():
provideCart(cartStore);

// In any descendant:
const count = useCartCount(); // ComputedRef<number>
const { addLine, setNote } = useCartActions();
addLine({ merchandiseId: "gid://shopify/ProductVariant/123" });
```

`useCartActions()` exposes `addLine`, `addLines`, `updateLine`, `removeLine`,
`setDiscountCodes`, `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes`,
`setNote` and `refresh`.

Also includes `useStore`, `useVariantSelection`, `usePredictiveSearch`,
`useLocale` and `useMoney`.

Full documentation: [monorepo README](https://github.com/Aquafr198/OpenShop#readme).

## License

[MIT](https://github.com/Aquafr198/OpenShop/blob/main/LICENSE.md)

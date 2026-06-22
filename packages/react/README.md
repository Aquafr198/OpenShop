# @openshop/react

> React bindings for [OpenShop](https://github.com/Aquafr198/OpenShop)'s
> framework-agnostic commerce core.

Thin React hooks and components over [`@openshop/core`](https://www.npmjs.com/package/@openshop/core).
Selector-based subscriptions mean components re-render only on the slice of cart
or store state they actually read.

## Install

```bash
npm install @openshop/react @openshop/core react
```

## Cart

```tsx
import {
  CartProvider,
  useCartCount,
  useCartActions,
  Money,
} from "@openshop/react";

function CartButton() {
  const count = useCartCount(); // re-renders only on count change
  const { addLine, setNote } = useCartActions();
  return (
    <button
      onClick={() =>
        addLine({ merchandiseId: "gid://shopify/ProductVariant/123" })
      }
    >
      Cart ({count})
    </button>
  );
}

// Wrap your app once:
// <CartProvider store={cartStore}>…</CartProvider>
```

`useCartActions()` exposes `addLine`, `addLines`, `updateLine`, `removeLine`,
`setDiscountCodes`, `setGiftCardCodes`, `setBuyerIdentity`, `setAttributes`,
`setNote` and `refresh`.

## Variant selection

```tsx
import { useVariantSelection, Money } from "@openshop/react";

function ProductForm({ product }) {
  const { selectedVariant, options, setOption } = useVariantSelection(product);
  return (
    <>
      {options.map((opt) => (
        <fieldset key={opt.name}>
          {opt.values.map((v) => (
            <button
              key={v.value}
              disabled={!v.available}
              aria-pressed={v.selected}
              onClick={() => setOption(opt.name, v.value)}
            >
              {v.value}
            </button>
          ))}
        </fieldset>
      ))}
      <Money data={selectedVariant?.price} />
    </>
  );
}
```

Also includes `<Image>`, `<MediaFile>`, `<ShopPayButton>`, `<NonceProvider>`,
the cart building blocks (`<AddToCartButton>`, `<QuantityAdjuster>`,
`<CartTotal>`, `<CheckoutButton>`), `usePredictiveSearch`, `useLocale` and more.

Full documentation: [monorepo README](https://github.com/Aquafr198/OpenShop#readme).

## License

[MIT](https://github.com/Aquafr198/OpenShop/blob/main/LICENSE.md)

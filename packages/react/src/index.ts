/**
 * @openshop/react
 *
 * Thin React bindings over `@openshop/core`. The commerce logic lives in the
 * framework-agnostic core; these hooks just connect it to React's render model
 * via `useSyncExternalStore`.
 */

export { useStore } from "./use-store.js";
export {
  CartProvider,
  useCart,
  useCartStore,
  useCartActions,
  useCartCount,
  useCartIsUpdating,
  type CartProviderProps,
} from "./cart.js";
export { Money, useMoney, type MoneyProps } from "./money.js";
export { Image, type ImageProps } from "./image.js";
export {
  NonceProvider,
  useNonce,
  type NonceProviderProps,
} from "./nonce.js";
export { ShopPayButton, type ShopPayButtonProps } from "./shop-pay-button.js";
export {
  useVariantSelection,
  type UseVariantSelection,
} from "./product.js";
export {
  usePredictiveSearch,
  type UsePredictiveSearch,
  type UsePredictiveSearchOptions,
} from "./search.js";
export {
  I18nProvider,
  useI18n,
  useLocale,
  useLocalizedPath,
  type I18nProviderProps,
} from "./i18n.js";
export {
  AnalyticsProvider,
  useAnalytics,
  useAnalyticsEffect,
  useConsent,
  type AnalyticsProviderProps,
} from "./analytics.js";

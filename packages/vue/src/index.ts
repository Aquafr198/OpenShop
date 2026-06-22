/**
 * @openshop/vue
 *
 * Vue 3 composables over `@openshop/core`. Same commerce logic as the React
 * bindings — only the reactivity adapter differs, proving the core is truly
 * framework-agnostic.
 */

export { useStore } from "./use-store.js";
export {
  provideCart,
  useCart,
  useCartStore,
  useCartActions,
  useCartCount,
  useCartIsUpdating,
} from "./cart.js";
export { useMoney } from "./money.js";
export { useVariantSelection, type UseVariantSelection } from "./product.js";
export {
  usePredictiveSearch,
  type UsePredictiveSearch,
  type UsePredictiveSearchOptions,
} from "./search.js";
export {
  provideI18n,
  useI18n,
  useLocale,
  useLocalizedPath,
  type ProvideI18nOptions,
} from "./i18n.js";

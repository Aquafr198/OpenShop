/**
 * @openshop/svelte
 *
 * Svelte store adapters over `@openshop/core`. Same commerce logic as the React
 * and Vue bindings — only the reactivity adapter differs.
 */

export { selectStore } from "./store.js";
export { createCartStores, type CartStores } from "./cart.js";
export {
  createVariantSelection,
  type VariantSelectionStores,
} from "./product.js";
export {
  createPredictiveSearch,
  type PredictiveSearchStores,
  type PredictiveSearchOptions,
} from "./search.js";
export { createI18nHelpers, type I18nHelpers } from "./i18n.js";

/** Re-export the sync money formatter for convenience in templates. */
export { formatMoney } from "@openshop/core";

export {
  CatalogClient,
  type CatalogClientOptions,
  type GetCollectionOptions,
} from "./catalog-client.js";
export {
  findVariantBySelection,
  getDefaultVariant,
  getInitialSelection,
  getOptionValueStates,
  selectOption,
  selectionToSearchParams,
  selectionFromSearchParams,
  type OptionSelection,
  type OptionValueState,
} from "./variant-selection.js";
export {
  mapProduct,
  mapCollection,
  buildCatalogDocuments,
  type RawProduct,
  type CatalogDocumentOptions,
} from "./catalog-graphql.js";
export {
  decodeEncodedVariant,
  isOptionValueCombinationInEncodedVariant,
  EncodedVariantError,
} from "./variant-decoder.js";
export {
  getProductOptions,
  type ProductWithEncodedVariants,
  type ProductOptionGroup,
  type ProductOptionValueState,
  type EncodableOption,
  type EncodableOptionValue,
} from "./product-options.js";
export type {
  Product,
  ProductVariant,
  ProductOption,
  ProductPriceRange,
  Collection,
  Image,
  SelectedOption,
} from "./types.js";

export {
  SearchClient,
  type SearchClientOptions,
  type ProductSearchParams,
  type CollectionBrowseParams,
  type CollectionBrowseResult,
} from "./search-client.js";
export {
  buildProductFilters,
  facetInputs,
  mergeFilters,
  type ProductFilterSelection,
} from "./filters.js";
export {
  buildSearchDocuments,
  mapPredictive,
  mapProductSearch,
  type PredictiveSearchResult,
  type PredictiveProduct,
  type PredictiveLink,
  type PredictiveQuerySuggestion,
  type ProductSearchResult,
  type SearchFacet,
  type SearchFilterValue,
  type SearchDocumentOptions,
} from "./search-graphql.js";

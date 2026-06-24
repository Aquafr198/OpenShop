/**
 * A phantom-typed GraphQL document.
 *
 * The `gql` tag returns the query string branded with its result (`TData`) and
 * variables (`TVariables`) types. The Storefront client reads those brands so
 * `storefront.query(doc, { variables })` is fully typed end-to-end.
 *
 * You can author the brands by hand for small queries, or wire in `gql.tada`
 * for zero-effort, schema-aware inference — both produce a `TypedDocument`,
 * so the client doesn't care which you use. This is the "typed GraphQL without
 * a codegen build step" path.
 */

declare const dataBrand: unique symbol;
declare const varsBrand: unique symbol;

export interface TypedDocument<
  TData = unknown,
  TVariables = Record<string, never>,
> {
  readonly source: string;
  /** Phantom fields — never present at runtime, used only for type inference. */
  readonly [dataBrand]?: TData;
  readonly [varsBrand]?: TVariables;
}

export type ResultOf<D> =
  D extends TypedDocument<infer T, infer _V> ? T : never;
export type VariablesOf<D> =
  D extends TypedDocument<infer _T, infer V> ? V : never;

/**
 * Tagged template that produces a `TypedDocument`. Supply the generics to brand
 * the document with its shape:
 *
 * ```ts
 * const ProductQuery = gql<{ product: { title: string } }, { handle: string }>`
 *   query Product($handle: String!) {
 *     product(handle: $handle) { title }
 *   }
 * `;
 * ```
 *
 * SECURITY: only interpolate static, trusted fragments into the template.
 * NEVER interpolate user input into the query string — pass it through
 * `variables` instead, or you open a GraphQL injection vector.
 */
export function gql<TData = unknown, TVariables = Record<string, never>>(
  strings: TemplateStringsArray,
  ...expressions: unknown[]
): TypedDocument<TData, TVariables> {
  let source = strings[0] ?? "";
  for (let i = 0; i < expressions.length; i++) {
    source += String(expressions[i]) + (strings[i + 1] ?? "");
  }
  return { source: source.trim() } as TypedDocument<TData, TVariables>;
}

/** Coerce a raw string or a TypedDocument into a query string. */
export function documentSource(
  doc: string | TypedDocument<unknown, unknown>,
): string {
  return typeof doc === "string" ? doc : doc.source;
}

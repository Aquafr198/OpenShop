/**
 * Decoder for Shopify's encoded variant strings
 * (`product.encodedVariantExistence` / `product.encodedVariantAvailability`).
 *
 * Shopify encodes the set of existing/available option-value combinations as a
 * compact trie so that products with up to ~2000 variants can be expressed in a
 * tiny string. This lets a storefront know which option-value combinations
 * exist/are available WITHOUT fetching every variant.
 *
 * V1 grammar (control characters): `:` opens the next option level, `,` ends a
 * repeated prefix (consecutive commas pop multiple levels), ` ` is a gap in the
 * sequence, `-` is a continuous range (only in the final option position).
 * Example: `v1_0:0-2,1:2,` → [[0,0],[0,1],[0,2],[1,2]].
 *
 * This implementation mirrors Shopify's documented format. See:
 * https://shopify.dev/docs/api/hydrogen-react/latest/utilities/decodeencodedvariant
 */

/** Thrown when an encoded variant string uses an unsupported encoding version. */
export class EncodedVariantError extends Error {
  override readonly name = "EncodedVariantError";
}

const SEPARATOR = ",";
const CONTROL = {
  OPTION: ":",
  END_OF_PREFIX: ",",
  GAP: " ",
  RANGE: "-",
} as const;

/**
 * Decode an encoded option-value string into the list of valid option-value
 * index combinations. Each entry is an array of option-value positions.
 */
export function decodeEncodedVariant(encoded: string): number[][] {
  if (!encoded) return [];
  if (!encoded.startsWith("v1_")) {
    throw new EncodedVariantError(
      `Unsupported option value encoding: ${encoded}`,
    );
  }
  return decodeV1(encoded.replace(/^v1_/, ""));
}

function decodeV1(field: string): number[][] {
  const tokenizer = /[ :,-]/g;
  let index = 0;
  let token: RegExpExecArray | null;
  const options: number[][] = [];
  const current: number[] = [];
  let depth = 0;
  let rangeStart: number | null = null;

  while ((token = tokenizer.exec(field))) {
    const operation = token[0];
    const valueIndex =
      Number.parseInt(field.slice(index, token.index), 10) || 0;

    if (rangeStart !== null) {
      // Expand a continuous range started by a preceding `-`.
      for (; rangeStart < valueIndex; rangeStart++) {
        current[depth] = rangeStart;
        options.push([...current]);
      }
      rangeStart = null;
    }

    current[depth] = valueIndex;

    if (operation === CONTROL.RANGE) {
      rangeStart = valueIndex;
    } else if (operation === CONTROL.OPTION) {
      depth++;
    } else {
      const prevCharWasComma = field[token.index - 1] === CONTROL.END_OF_PREFIX;
      if (
        operation === CONTROL.GAP ||
        (operation === CONTROL.END_OF_PREFIX && !prevCharWasComma)
      ) {
        options.push([...current]);
      }
      if (operation === CONTROL.END_OF_PREFIX) {
        current.pop();
        depth--;
      }
    }
    index = tokenizer.lastIndex;
  }

  // If the string ends with an index (no trailing control char), process it.
  const trailing = field.match(/\d+$/g);
  if (trailing) {
    const finalIndex = Number.parseInt(trailing[0], 10);
    if (rangeStart !== null) {
      for (; rangeStart <= finalIndex; rangeStart++) {
        current[depth] = rangeStart;
        options.push([...current]);
      }
    } else {
      options.push([finalIndex]);
    }
  }

  return options;
}

/**
 * Whether an option-value combination is present in an encoded string. A
 * partial prefix may be passed (e.g. `[0]` returns true if any combination
 * starts with option-value 0). Memoized per encoded string (bounded LRU) for
 * O(1) repeated lookups without unbounded memory growth on long-lived servers.
 */
export const isOptionValueCombinationInEncodedVariant = (() => {
  const cache = new Map<string, Set<string>>();
  const MAX_ENTRIES = 256;

  return (target: number[], encoded: string): boolean => {
    if (target.length === 0) return false;

    let set = cache.get(encoded);
    if (set) {
      // Touch for LRU recency.
      cache.delete(encoded);
      cache.set(encoded, set);
    } else {
      set = new Set<string>();
      for (const combo of decodeEncodedVariant(encoded)) {
        // Add the full combo and every prefix, so partial lookups work.
        for (let i = 0; i < combo.length; i++) {
          set.add(combo.slice(0, i + 1).join(SEPARATOR));
        }
      }
      cache.set(encoded, set);
      if (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    }

    return set.has(target.join(SEPARATOR));
  };
})();

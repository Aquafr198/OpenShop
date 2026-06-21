/**
 * A tiny, dependency-free reactive store inspired by signals.
 *
 * The core idea behind OpenShop's reactivity: the parts of a storefront that
 * change at runtime (the cart, applied filters, the active market, search
 * results) are observables. You subscribe with a *selector* and your listener
 * only runs when that specific slice changes — not on every state update.
 *
 * This keeps the UI layer (React, Vue, Svelte, or none at all) thin: a binding
 * just needs to map `subscribe` + `getSnapshot` onto the framework primitive.
 */

export type Listener = () => void;
export type Unsubscribe = () => void;
export type Selector<T, R> = (state: T) => R;
export type EqualityFn<R> = (a: R, b: R) => boolean;
export type Updater<T> = (prev: T) => T;

/** Strict reference equality. The default comparator for selectors. */
export const refEquals = <R>(a: R, b: R): boolean => Object.is(a, b);

/**
 * Shallow equality for objects and arrays. Useful when a selector returns a
 * freshly-built object/tuple on every call but the contents rarely change.
 */
export function shallowEquals<R>(a: R, b: R): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null) return false;
  if (typeof b !== "object" || b === null) return false;

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

export interface ReadableStore<T> {
  /** Read the current state synchronously. */
  get(): T;
  /**
   * Subscribe to a slice of state. The listener runs only when the value
   * returned by `selector` changes according to `equals`.
   */
  subscribe<R>(
    selector: Selector<T, R>,
    listener: (value: R, prev: R) => void,
    equals?: EqualityFn<R>,
  ): Unsubscribe;
  /**
   * Low-level subscription used by framework bindings (e.g. React's
   * `useSyncExternalStore`). Fires on every committed state change.
   */
  subscribeRaw(listener: Listener): Unsubscribe;
}

export interface WritableStore<T> extends ReadableStore<T> {
  set(next: T): void;
  update(updater: Updater<T>): void;
}

interface SelectorSubscription<T> {
  run(state: T): void;
}

/**
 * Create a writable reactive store.
 *
 * @param initial Initial state.
 */
export function createStore<T>(initial: T): WritableStore<T> {
  let state = initial;
  const rawListeners = new Set<Listener>();
  const selectorSubs = new Set<SelectorSubscription<T>>();
  let notifying = false;
  let dirty = false;

  function notify(): void {
    // If a listener triggers another `set`, mark dirty and let the active
    // notification loop pick up the new state instead of recursing.
    if (notifying) {
      dirty = true;
      return;
    }
    notifying = true;
    try {
      do {
        dirty = false;
        // Snapshot subscriptions: a listener may unsubscribe others mid-pass.
        for (const sub of [...selectorSubs]) sub.run(state);
        for (const listener of [...rawListeners]) listener();
      } while (dirty);
    } finally {
      notifying = false;
    }
  }

  return {
    get() {
      return state;
    },

    set(next: T) {
      if (Object.is(next, state)) return;
      state = next;
      notify();
    },

    update(updater: Updater<T>) {
      const next = updater(state);
      if (Object.is(next, state)) return;
      state = next;
      notify();
    },

    subscribe<R>(
      selector: Selector<T, R>,
      listener: (value: R, prev: R) => void,
      equals: EqualityFn<R> = refEquals,
    ): Unsubscribe {
      let current = selector(state);
      const sub: SelectorSubscription<T> = {
        run(nextState: T) {
          const next = selector(nextState);
          if (equals(next, current)) return;
          const prev = current;
          current = next;
          listener(next, prev);
        },
      };
      selectorSubs.add(sub);
      return () => {
        selectorSubs.delete(sub);
      };
    },

    subscribeRaw(listener: Listener): Unsubscribe {
      rawListeners.add(listener);
      return () => {
        rawListeners.delete(listener);
      };
    },
  };
}

import { createContext, createElement, useContext, type ReactNode } from "react";

const NonceContext = createContext<string | undefined>(undefined);

export interface NonceProviderProps {
  nonce: string;
  children: ReactNode;
}

/**
 * Provides the CSP nonce (from `createContentSecurityPolicy`) to descendants.
 * Set the same nonce on the document's `Content-Security-Policy` header.
 */
export function NonceProvider({ nonce, children }: NonceProviderProps) {
  return createElement(NonceContext.Provider, { value: nonce }, children);
}

/** Read the active CSP nonce; attach it to any inline `<script>` you render. */
export function useNonce(): string | undefined {
  return useContext(NonceContext);
}

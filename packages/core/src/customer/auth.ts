/**
 * Customer Account API OAuth 2.0 (Authorization Code + PKCE).
 *
 * Flow:
 *  1. `beginAuthorization()` → redirect the buyer to Shopify, stash the
 *     returned `verifier` + `state` in a short-lived, signed cookie/session.
 *  2. On the callback, verify `state`, then `exchangeCode()` for tokens.
 *  3. Use the access token with `CustomerAccountClient`.
 *  4. `refresh()` before expiry; `buildLogoutUrl()` to end the session.
 *
 * Token endpoints accept public (PKCE-only) or confidential (client secret)
 * clients; pass `clientSecret` for the latter.
 */

import {
  computeCodeChallenge,
  generateCodeVerifier,
  generateRandomState,
} from "./pkce.js";

export interface CustomerAccountAuthConfig {
  /**
   * The store domain (e.g. "my-shop.myshopify.com"). Used for OIDC endpoint
   * discovery as recommended by Shopify's docs. When `useDiscovery` is true
   * (the default) the authorize/token/logout URLs are resolved from the shop's
   * `.well-known/openid-configuration` — which keeps your integration working
   * as Shopify's infrastructure evolves.
   */
  storeDomain: string;
  /** The numeric shop id (fallback endpoint pattern when discovery is off). */
  shopId?: string;
  clientId: string;
  redirectUri: string;
  /** OAuth scopes. Defaults to openid + email + customer-account-api access. */
  scopes?: string[];
  /** Confidential clients only. Omit for public (PKCE) clients. */
  clientSecret?: string;
  /**
   * Use OIDC Discovery to resolve endpoints at runtime. Default `true`.
   * Set to `false` + provide `shopId` to use the legacy hardcoded pattern.
   */
  useDiscovery?: boolean;
  /** Override the Shopify endpoints entirely (useful for testing). */
  endpoints?: Partial<OAuthEndpoints>;
  fetch?: typeof fetch;
}

export interface OAuthEndpoints {
  authorize: string;
  token: string;
  logout: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  /** Absolute epoch ms at which the access token expires. */
  expiresAt: number;
  scope?: string;
  tokenType: string;
}

export interface AuthorizationRequest {
  /** The URL to redirect the buyer to. */
  url: string;
  /** Must be persisted (server-side/cookie) and supplied to `exchangeCode`. */
  verifier: string;
  /** Must be persisted and compared against the callback `state`. */
  state: string;
  nonce: string;
}

const DEFAULT_SCOPES = ["openid", "email", "customer-account-api:full"];

function defaultEndpoints(shopId: string): OAuthEndpoints {
  const base = `https://shopify.com/authentication/${shopId}/oauth`;
  return {
    authorize: `${base}/authorize`,
    token: `${base}/token`,
    logout: `https://shopify.com/authentication/${shopId}/logout`,
  };
}

interface OidcConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

/**
 * Discover OAuth endpoints via the shop's OIDC configuration, as recommended
 * by Shopify's official docs:
 * https://shopify.dev/docs/storefronts/headless/building-with-the-customer-account-api/authenticate-customers
 */
async function discoverEndpoints(
  storeDomain: string,
  fetchImpl: typeof fetch,
): Promise<OAuthEndpoints> {
  const url = `https://${storeDomain}/.well-known/openid-configuration`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch OIDC configuration from ${url}: ${res.status} ${res.statusText}`,
    );
  }
  const config = (await res.json()) as OidcConfig;
  return {
    authorize: config.authorization_endpoint,
    token: config.token_endpoint,
    logout:
      config.end_session_endpoint ??
      `https://shopify.com/authentication/${storeDomain}/logout`,
  };
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

export class CustomerAccountAuth {
  private readonly config: CustomerAccountAuthConfig;
  private resolvedEndpoints: OAuthEndpoints | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly scopes: string[];

  constructor(config: CustomerAccountAuthConfig) {
    this.config = config;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.scopes = config.scopes ?? DEFAULT_SCOPES;

    // If full endpoints are provided, use them immediately (no discovery).
    if (
      config.endpoints?.authorize &&
      config.endpoints.token &&
      config.endpoints.logout
    ) {
      this.resolvedEndpoints = config.endpoints as OAuthEndpoints;
    }
  }

  /** Resolve endpoints (discovery or hardcoded fallback). Cached after first call. */
  private async getEndpoints(): Promise<OAuthEndpoints> {
    if (this.resolvedEndpoints) return this.resolvedEndpoints;

    const useDiscovery = this.config.useDiscovery !== false;
    if (useDiscovery) {
      this.resolvedEndpoints = await discoverEndpoints(
        this.config.storeDomain,
        this.fetchImpl,
      );
    } else {
      const shopId = this.config.shopId ?? this.config.storeDomain;
      this.resolvedEndpoints = defaultEndpoints(shopId);
    }

    // Apply any partial overrides.
    if (this.config.endpoints) {
      this.resolvedEndpoints = {
        ...this.resolvedEndpoints,
        ...this.config.endpoints,
      };
    }
    return this.resolvedEndpoints;
  }

  /** Build the authorization redirect plus the PKCE state to persist. */
  async beginAuthorization(): Promise<AuthorizationRequest> {
    const verifier = generateCodeVerifier();
    const challenge = await computeCodeChallenge(verifier);
    const state = generateRandomState();
    const nonce = generateRandomState();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.scopes.join(" "),
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    return {
      url: `${(await this.getEndpoints()).authorize}?${params.toString()}`,
      verifier,
      state,
      nonce,
    };
  }

  /** Exchange an authorization code for tokens. */
  async exchangeCode(args: {
    code: string;
    verifier: string;
  }): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code: args.code,
      code_verifier: args.verifier,
    });
    return this.tokenRequest(body);
  }

  /** Exchange a refresh token for a fresh access token. */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      refresh_token: refreshToken,
    });
    return this.tokenRequest(body);
  }

  /** Build the logout URL; redirect the buyer here to end their session. */
  async buildLogoutUrl(
    idToken: string,
    postLogoutRedirectUri?: string,
  ): Promise<string> {
    const endpoints = await this.getEndpoints();
    const params = new URLSearchParams({ id_token_hint: idToken });
    if (postLogoutRedirectUri) {
      params.set("post_logout_redirect_uri", postLogoutRedirectUri);
    }
    return `${endpoints.logout}?${params.toString()}`;
  }

  private async tokenRequest(body: URLSearchParams): Promise<TokenSet> {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    // Confidential clients authenticate with HTTP Basic.
    if (this.config.clientSecret) {
      const creds = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
      headers.Authorization = `Basic ${creds}`;
    }

    const response = await this.fetchImpl((await this.getEndpoints()).token, {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Customer Account token request failed (${response.status}): ${text}`,
      );
    }

    const raw = (await response.json()) as RawTokenResponse;
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      ...(raw.id_token ? { idToken: raw.id_token } : {}),
      expiresAt: Date.now() + raw.expires_in * 1000,
      ...(raw.scope ? { scope: raw.scope } : {}),
      tokenType: raw.token_type,
    };
  }
}

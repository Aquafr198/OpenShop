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
  /** The numeric shop id used in Customer Account API URLs. */
  shopId: string;
  clientId: string;
  redirectUri: string;
  /** OAuth scopes. Defaults to openid + email + customer-account-api access. */
  scopes?: string[];
  /** Confidential clients only. Omit for public (PKCE) clients. */
  clientSecret?: string;
  /** Override the default Shopify endpoints (useful for testing). */
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
  private readonly endpoints: OAuthEndpoints;
  private readonly fetchImpl: typeof fetch;
  private readonly scopes: string[];

  constructor(config: CustomerAccountAuthConfig) {
    this.config = config;
    this.endpoints = { ...defaultEndpoints(config.shopId), ...config.endpoints };
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    this.scopes = config.scopes ?? DEFAULT_SCOPES;
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
      url: `${this.endpoints.authorize}?${params.toString()}`,
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
  buildLogoutUrl(idToken: string, postLogoutRedirectUri?: string): string {
    const params = new URLSearchParams({ id_token_hint: idToken });
    if (postLogoutRedirectUri) {
      params.set("post_logout_redirect_uri", postLogoutRedirectUri);
    }
    return `${this.endpoints.logout}?${params.toString()}`;
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

    const response = await this.fetchImpl(this.endpoints.token, {
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

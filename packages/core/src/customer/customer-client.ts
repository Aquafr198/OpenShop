/**
 * Customer Account API GraphQL client.
 *
 * Reuses the same resilience primitives as the Storefront client (timeout +
 * retry). The access token is supplied lazily via `getAccessToken`, so callers
 * can transparently refresh an expired token before each request.
 */

import {
  StorefrontError,
  StorefrontGraphQLError,
  StorefrontHttpError,
  type GraphQLError,
} from "../storefront/errors.js";
import { withRetry, withTimeout } from "../storefront/resilience.js";
import {
  documentSource,
  type ResultOf,
  type TypedDocument,
  type VariablesOf,
} from "../storefront/gql.js";
import {
  buildCustomerDocuments,
  mapCustomer,
  type AddressInput,
  type Customer,
  type CustomerAddress,
  type CustomerDocumentOptions,
  type CustomerUserError,
} from "./customer-graphql.js";

export type AccessTokenProvider = () => string | Promise<string>;

export interface CustomerAccountClientConfig extends CustomerDocumentOptions {
  shopId: string;
  /** Returns a valid access token (refreshing if necessary). */
  getAccessToken: AccessTokenProvider;
  apiVersion?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Override the GraphQL endpoint (useful for testing). */
  endpoint?: string;
}

/** Thrown when a customer mutation returns `userErrors`. */
export class CustomerUserErrorException extends StorefrontError {
  override readonly name = "CustomerUserErrorException";
  constructor(public readonly userErrors: CustomerUserError[]) {
    super(userErrors[0]?.message ?? "Customer operation failed");
  }
}

const DEFAULT_API_VERSION = "2025-10";
const DEFAULT_TIMEOUT_MS = 10_000;

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export class CustomerAccountClient {
  private readonly config: CustomerAccountClientConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly docs: ReturnType<typeof buildCustomerDocuments>;

  constructor(config: CustomerAccountClientConfig) {
    this.config = config;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    const version = config.apiVersion ?? DEFAULT_API_VERSION;
    this.endpoint =
      config.endpoint ??
      `https://shopify.com/${config.shopId}/account/customer/api/${version}/graphql`;
    this.docs = buildCustomerDocuments(config);
  }

  async query<D extends TypedDocument<unknown, unknown>>(
    document: D,
    variables?: VariablesOf<D>,
  ): Promise<ResultOf<D>> {
    return this.execute<ResultOf<D>>(documentSource(document), variables);
  }

  /** Fetch the authenticated customer (profile, addresses, recent orders). */
  async getCustomer(): Promise<Customer> {
    const data = await this.query(this.docs.customerQuery);
    return mapCustomer(data.customer);
  }

  async createAddress(
    address: AddressInput,
    defaultAddress = false,
  ): Promise<CustomerAddress> {
    const data = await this.query(this.docs.addressCreate, {
      address,
      defaultAddress,
    });
    const payload = data.customerAddressCreate;
    if (payload.userErrors.length) {
      throw new CustomerUserErrorException(payload.userErrors);
    }
    if (!payload.customerAddress) {
      throw new StorefrontError("Address create returned no address.");
    }
    return payload.customerAddress;
  }

  async updateAddress(
    addressId: string,
    address: AddressInput,
    defaultAddress?: boolean,
  ): Promise<CustomerAddress> {
    const data = await this.query(this.docs.addressUpdate, {
      addressId,
      address,
      ...(defaultAddress !== undefined ? { defaultAddress } : {}),
    });
    const payload = data.customerAddressUpdate;
    if (payload.userErrors.length) {
      throw new CustomerUserErrorException(payload.userErrors);
    }
    if (!payload.customerAddress) {
      throw new StorefrontError("Address update returned no address.");
    }
    return payload.customerAddress;
  }

  async deleteAddress(addressId: string): Promise<string> {
    const data = await this.query(this.docs.addressDelete, { addressId });
    const payload = data.customerAddressDelete;
    if (payload.userErrors.length) {
      throw new CustomerUserErrorException(payload.userErrors);
    }
    return payload.deletedAddressId ?? addressId;
  }

  private async execute<T>(query: string, variables: unknown): Promise<T> {
    const run = async (): Promise<T> => {
      const token = await this.config.getAccessToken();
      const response = await withTimeout(
        (signal) =>
          this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: token,
            },
            body: JSON.stringify({ query, variables: variables ?? {} }),
            signal,
          }),
        this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new StorefrontHttpError(
          response.status,
          await response.text().catch(() => ""),
        );
      }
      const payload = (await response.json()) as GraphQLResponse<T>;
      if (payload.errors?.length) {
        throw new StorefrontGraphQLError(payload.errors, query);
      }
      if (payload.data === undefined) {
        throw new StorefrontGraphQLError(
          [{ message: "Customer response contained no data." }],
          query,
        );
      }
      return payload.data;
    };

    return withRetry(run);
  }
}

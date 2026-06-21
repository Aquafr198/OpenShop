/** Types, documents and mapping for the Customer Account API. */

import { gql } from "../storefront/gql.js";
import type { MoneyV2 } from "../money/money.js";

export interface CustomerAddress {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  /** ISO territory (country) code, e.g. "US". */
  territoryCode?: string | null;
  /** Province/state code, e.g. "CA". */
  zoneCode?: string | null;
  phoneNumber?: string | null;
}

export interface CustomerOrderLine {
  title: string;
  quantity: number;
}

export interface CustomerOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  totalPrice: MoneyV2;
  lineItems: CustomerOrderLine[];
}

export interface Customer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  defaultAddress?: CustomerAddress | null;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
}

export interface AddressInput {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
  territoryCode?: string;
  zoneCode?: string;
  phoneNumber?: string;
}

interface RawCustomer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddress?: { emailAddress?: string | null } | null;
  phoneNumber?: { phoneNumber?: string | null } | null;
  defaultAddress?: CustomerAddress | null;
  addresses: { nodes: CustomerAddress[] };
  orders: {
    nodes: {
      id: string;
      name: string;
      processedAt: string;
      financialStatus?: string | null;
      fulfillmentStatus?: string | null;
      totalPrice: MoneyV2;
      lineItems: { nodes: CustomerOrderLine[] };
    }[];
  };
}

export interface CustomerUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

export function mapCustomer(raw: RawCustomer): Customer {
  return {
    id: raw.id,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    emailAddress: raw.emailAddress?.emailAddress ?? null,
    phoneNumber: raw.phoneNumber?.phoneNumber ?? null,
    defaultAddress: raw.defaultAddress ?? null,
    addresses: raw.addresses.nodes,
    orders: raw.orders.nodes.map((o) => ({
      id: o.id,
      name: o.name,
      processedAt: o.processedAt,
      financialStatus: o.financialStatus ?? null,
      fulfillmentStatus: o.fulfillmentStatus ?? null,
      totalPrice: o.totalPrice,
      lineItems: o.lineItems.nodes,
    })),
  };
}

const ADDRESS_FIELDS = /* GraphQL */ `
  fragment AddressFields on CustomerAddress {
    id
    firstName
    lastName
    company
    address1
    address2
    city
    zip
    territoryCode
    zoneCode
    phoneNumber
  }
`;

export interface CustomerDocumentOptions {
  ordersFirst?: number;
  addressesFirst?: number;
}

export function buildCustomerDocuments(options: CustomerDocumentOptions = {}) {
  const ordersFirst = options.ordersFirst ?? 10;
  const addressesFirst = options.addressesFirst ?? 10;

  const customerQuery = gql<{ customer: RawCustomer }, Record<string, never>>`
    ${ADDRESS_FIELDS}
    query Customer {
      customer {
        id
        firstName
        lastName
        emailAddress { emailAddress }
        phoneNumber { phoneNumber }
        defaultAddress { ...AddressFields }
        addresses(first: ${addressesFirst}) { nodes { ...AddressFields } }
        orders(first: ${ordersFirst}, sortKey: PROCESSED_AT, reverse: true) {
          nodes {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            totalPrice { amount currencyCode }
            lineItems(first: 50) { nodes { title quantity } }
          }
        }
      }
    }
  `;

  const addressCreate = gql<
    {
      customerAddressCreate: {
        customerAddress: CustomerAddress | null;
        userErrors: CustomerUserError[];
      };
    },
    { address: AddressInput; defaultAddress?: boolean }
  >`
    ${ADDRESS_FIELDS}
    mutation AddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
      customerAddressCreate(address: $address, defaultAddress: $defaultAddress) {
        customerAddress { ...AddressFields }
        userErrors { field message code }
      }
    }
  `;

  const addressUpdate = gql<
    {
      customerAddressUpdate: {
        customerAddress: CustomerAddress | null;
        userErrors: CustomerUserError[];
      };
    },
    { addressId: string; address: AddressInput; defaultAddress?: boolean }
  >`
    ${ADDRESS_FIELDS}
    mutation AddressUpdate($addressId: ID!, $address: CustomerAddressInput!, $defaultAddress: Boolean) {
      customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) {
        customerAddress { ...AddressFields }
        userErrors { field message code }
      }
    }
  `;

  const addressDelete = gql<
    {
      customerAddressDelete: {
        deletedAddressId: string | null;
        userErrors: CustomerUserError[];
      };
    },
    { addressId: string }
  >`
    mutation AddressDelete($addressId: ID!) {
      customerAddressDelete(addressId: $addressId) {
        deletedAddressId
        userErrors { field message code }
      }
    }
  `;

  return { customerQuery, addressCreate, addressUpdate, addressDelete };
}

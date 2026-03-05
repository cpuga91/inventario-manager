/**
 * Shopify Admin API GraphQL client.
 * All queries use documented Shopify Admin API fields only.
 */

interface ShopifyConfig {
  shop: string;
  accessToken: string;
}

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: { cost: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: { maximumAvailable: number; currentlyAvailable: number; restoreRate: number } } };
}

export class ShopifyClient {
  private shop: string;
  private accessToken: string;
  private apiVersion = "2024-04";

  constructor(config: ShopifyConfig) {
    this.shop = config.shop;
    this.accessToken = config.accessToken;
  }

  private get endpoint() {
    return `https://${this.shop}/admin/api/${this.apiVersion}/graphql.json`;
  }

  async query<T = unknown>(gql: string, variables: Record<string, unknown> = {}): Promise<T> {
    let retries = 0;
    const maxRetries = 3;

    while (true) {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query: gql, variables }),
      });

      // Rate limit handling: 429 or throttled
      if (res.status === 429 && retries < maxRetries) {
        const retryAfter = parseFloat(res.headers.get("Retry-After") || "2");
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        retries++;
        continue;
      }

      const json: GraphQLResponse<T> = await res.json();

      // Check for throttle in extensions
      if (json.extensions?.cost?.throttleStatus) {
        const { currentlyAvailable, restoreRate } = json.extensions.cost.throttleStatus;
        if (currentlyAvailable < 100 && retries < maxRetries) {
          const waitTime = Math.max(1, (100 - currentlyAvailable) / restoreRate);
          await new Promise((r) => setTimeout(r, waitTime * 1000));
        }
      }

      if (json.errors && json.errors.length > 0) {
        const msg = json.errors.map((e) => e.message).join("; ");
        if (msg.includes("Throttled") && retries < maxRetries) {
          await new Promise((r) => setTimeout(r, 2000 * (retries + 1)));
          retries++;
          continue;
        }
        throw new Error(`Shopify GraphQL error: ${msg}`);
      }

      if (!json.data) throw new Error("No data in Shopify response");
      return json.data;
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ name: string }> {
    const data = await this.query<{ shop: { name: string } }>(`{ shop { name } }`);
    return { name: data.shop.name };
  }

  /**
   * List all locations
   * GraphQL: { locations(first: 50) { edges { node { id name isActive } } } }
   */
  async listLocations(): Promise<Array<{ id: string; name: string; isActive: boolean }>> {
    const QUERY = `{
      locations(first: 50) {
        edges {
          node {
            id
            name
            isActive
          }
        }
      }
    }`;
    const data = await this.query<{ locations: { edges: Array<{ node: { id: string; name: string; isActive: boolean } }> } }>(QUERY);
    return data.locations.edges.map((e) => e.node);
  }

  /**
   * Paginated: fetch product variants with finance.cogs metafield
   * GraphQL: productVariants(first: 50, after: $cursor) { edges { node { id sku title price product { id title vendor tags } metafield(namespace:"finance", key:"cogs") { value } inventoryItem { id } } } pageInfo { hasNextPage endCursor } }
   */
  async *paginateVariants(): AsyncGenerator<Array<{
    id: string;
    sku: string | null;
    title: string;
    price: string;
    product: { id: string; title: string; vendor: string | null; tags: string[] };
    metafield: { value: string } | null;
    inventoryItem: { id: string };
  }>> {
    const QUERY = `query($cursor: String) {
      productVariants(first: 50, after: $cursor) {
        edges {
          node {
            id
            sku
            title
            price
            product {
              id
              title
              vendor
              tags
            }
            metafield(namespace: "finance", key: "cogs") {
              value
            }
            inventoryItem {
              id
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;

    let cursor: string | null = null;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await this.query(QUERY, { cursor });

      yield data.productVariants.edges.map((e: any) => e.node);// eslint-disable-line @typescript-eslint/no-explicit-any

      if (!data.productVariants.pageInfo.hasNextPage) break;
      cursor = data.productVariants.pageInfo.endCursor;
    }
  }

  /**
   * Paginated: fetch inventory levels for inventory items
   * GraphQL: inventoryItems(first: 50, after: $cursor) { edges { node { id variant { id } inventoryLevels(first: 50) { edges { node { location { id } quantities(names:["available"]) { name quantity } } } } } } pageInfo { hasNextPage endCursor } }
   */
  async *paginateInventoryLevels(): AsyncGenerator<Array<{
    inventoryItemId: string;
    variantId: string | null;
    levels: Array<{ locationId: string; available: number }>;
  }>> {
    const QUERY = `query($cursor: String) {
      inventoryItems(first: 50, after: $cursor) {
        edges {
          node {
            id
            variant {
              id
            }
            inventoryLevels(first: 50) {
              edges {
                node {
                  location {
                    id
                  }
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;

    let cursor: string | null = null;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await this.query(QUERY, { cursor });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = data.inventoryItems.edges.map((e: any) => ({
        inventoryItemId: e.node.id,
        variantId: e.node.variant?.id || null,
        levels: e.node.inventoryLevels.edges.map((l: any) => ({// eslint-disable-line @typescript-eslint/no-explicit-any
          locationId: l.node.location.id,
          available: l.node.quantities?.[0]?.quantity ?? 0,
        })),
      }));
      yield items;

      if (!data.inventoryItems.pageInfo.hasNextPage) break;
      cursor = data.inventoryItems.pageInfo.endCursor;
    }
  }

  /**
   * Paginated: fetch paid orders
   * GraphQL: orders(first: 50, after: $cursor, query: "financial_status:paid created_at:>=$since") { ... }
   */
  async *paginateOrders(since: string): AsyncGenerator<Array<{
    id: string;
    name: string;
    createdAt: string;
    totalPrice: string;
    lineItems: Array<{ variantId: string | null; sku: string | null; quantity: number; unitPrice: string }>;
    locationId: string | null;
  }>> {
    const QUERY = `query($cursor: String, $queryStr: String!) {
      orders(first: 50, after: $cursor, query: $queryStr) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
              }
            }
            lineItems(first: 100) {
              edges {
                node {
                  variant {
                    id
                  }
                  sku
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
            physicalLocation {
              id
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;

    const queryStr = `financial_status:paid created_at:>=${since}`;
    let cursor: string | null = null;

    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await this.query(QUERY, { cursor, queryStr });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = data.orders.edges.map((e: any) => ({
        id: e.node.id,
        name: e.node.name,
        createdAt: e.node.createdAt,
        totalPrice: e.node.totalPriceSet?.shopMoney?.amount ?? "0",
        lineItems: e.node.lineItems.edges.map((l: any) => ({// eslint-disable-line @typescript-eslint/no-explicit-any
          variantId: l.node.variant?.id || null,
          sku: l.node.sku || null,
          quantity: l.node.quantity,
          unitPrice: l.node.originalUnitPriceSet?.shopMoney?.amount ?? "0",
        })),
        locationId: e.node.physicalLocation?.id || null,
      }));
      yield orders;

      if (!data.orders.pageInfo.hasNextPage) break;
      cursor = data.orders.pageInfo.endCursor;
    }
  }

  /**
   * Write COGS metafield to a variant
   * Uses metafieldsSet mutation
   */
  async setVariantCogsMetafield(variantGid: string, cogsValue: number): Promise<void> {
    const MUTATION = `mutation($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }`;

    const data = await this.query<{
      metafieldsSet: {
        metafields: Array<{ id: string }>;
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(MUTATION, {
      metafields: [
        {
          ownerId: variantGid,
          namespace: "finance",
          key: "cogs",
          type: "number_decimal",
          value: cogsValue.toString(),
        },
      ],
    });

    if (data.metafieldsSet.userErrors?.length > 0) {
      throw new Error(
        `Metafield write error: ${data.metafieldsSet.userErrors.map((e) => e.message).join("; ")}`
      );
    }
  }
}

/**
 * Get a ShopifyClient from environment or explicit config
 */
export function getShopifyClient(shop?: string, token?: string): ShopifyClient {
  return new ShopifyClient({
    shop: shop || process.env.SHOPIFY_SHOP || "",
    accessToken: token || process.env.SHOPIFY_ACCESS_TOKEN || "",
  });
}

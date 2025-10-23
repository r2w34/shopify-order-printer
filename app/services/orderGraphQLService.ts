import type { Session } from '@shopify/shopify-api'
import { createGraphQLClient, ShopifyGraphQLClient } from './graphqlClient'
import type {
  ShopifyOrder,
  OrdersQueryResponse,
  OrderQueryResponse,
  PaginatedResponse,
  PaginationInfo
} from '../../types/shopify'

/**
 * GraphQL queries for order operations
 */
const ORDERS_QUERY = `
  query GetOrders(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $query: String
    $sortKey: OrderSortKeys
    $reverse: Boolean
  ) {
    orders(
      first: $first
      after: $after
      last: $last
      before: $before
      query: $query
      sortKey: $sortKey
      reverse: $reverse
    ) {
      edges {
        node {
          id
          name
          orderNumber
          createdAt
          updatedAt
          processedAt
          cancelledAt
          closedAt
          email
          phone
          financialStatus
          fulfillmentStatus
          tags
          note
          currencyCode
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
            presentmentMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
            presentmentMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
            presentmentMoney {
              amount
              currencyCode
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
              currencyCode
            }
            presentmentMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
            email
            phone
            acceptsMarketing
            createdAt
            updatedAt
            ordersCount
            totalSpent
            tags
            defaultAddress {
              id
              firstName
              lastName
              company
              address1
              address2
              city
              province
              country
              zip
              phone
              provinceCode
              countryCode
            }
          }
          billingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
            provinceCode
            countryCode
          }
          shippingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            country
            zip
            phone
            provinceCode
            countryCode
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                name
                title
                quantity
                sku
                variantTitle
                vendor
                productId
                variantId
                fulfillableQuantity
                fulfillmentStatus
                requiresShipping
                taxable
                giftCard
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                  presentmentMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                  presentmentMoney {
                    amount
                    currencyCode
                  }
                }
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                  presentmentMoney {
                    amount
                    currencyCode
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                  presentmentMoney {
                    amount
                    currencyCode
                  }
                }
                customAttributes {
                  key
                  value
                }
                product {
                  id
                  title
                  handle
                  productType
                  vendor
                  tags
                  metafields(first: 10, namespace: "custom") {
                    edges {
                      node {
                        id
                        namespace
                        key
                        value
                        type
                      }
                    }
                  }
                }
                variant {
                  id
                  title
                  sku
                  barcode
                  price
                  compareAtPrice
                  weight
                  weightUnit
                  inventoryQuantity
                  selectedOptions {
                    name
                    value
                  }
                  metafields(first: 10, namespace: "custom") {
                    edges {
                      node {
                        id
                        namespace
                        key
                        value
                        type
                      }
                    }
                  }
                }
              }
            }
          }
          shippingLines {
            id
            title
            code
            source
            phone
            requestedFulfillmentServiceId
            deliveryCategory
            carrierIdentifier
            discountedPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            originalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
          taxLines {
            title
            rate
            ratePercentage
            priceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
          }
          discountApplications {
            edges {
              node {
                ... on DiscountCodeApplication {
                  code
                  applicable
                }
                ... on ScriptDiscountApplication {
                  title
                }
                ... on ManualDiscountApplication {
                  title
                  description
                }
                allocationMethod
                targetSelection
                targetType
                value {
                  ... on MoneyV2 {
                    amount
                    currencyCode
                  }
                  ... on PricingPercentageValue {
                    percentage
                  }
                }
              }
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

const ORDER_QUERY = `
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      name
      orderNumber
      createdAt
      updatedAt
      processedAt
      cancelledAt
      closedAt
      email
      phone
      financialStatus
      fulfillmentStatus
      tags
      note
      currencyCode
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      subtotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      totalTaxSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      totalDiscountsSet {
        shopMoney {
          amount
          currencyCode
        }
        presentmentMoney {
          amount
          currencyCode
        }
      }
      customer {
        id
        firstName
        lastName
        email
        phone
        acceptsMarketing
        createdAt
        updatedAt
        ordersCount
        totalSpent
        tags
        defaultAddress {
          id
          firstName
          lastName
          company
          address1
          address2
          city
          province
          country
          zip
          phone
          provinceCode
          countryCode
        }
      }
      billingAddress {
        firstName
        lastName
        company
        address1
        address2
        city
        province
        country
        zip
        phone
        provinceCode
        countryCode
      }
      shippingAddress {
        firstName
        lastName
        company
        address1
        address2
        city
        province
        country
        zip
        phone
        provinceCode
        countryCode
      }
      lineItems(first: 250) {
        edges {
          node {
            id
            name
            title
            quantity
            sku
            variantTitle
            vendor
            productId
            variantId
            fulfillableQuantity
            fulfillmentStatus
            requiresShipping
            taxable
            giftCard
            originalUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            discountedUnitPriceSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            originalTotalSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
                currencyCode
              }
              presentmentMoney {
                amount
                currencyCode
              }
            }
            customAttributes {
              key
              value
            }
            product {
              id
              title
              handle
              productType
              vendor
              tags
              metafields(first: 10, namespace: "custom") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
            variant {
              id
              title
              sku
              barcode
              price
              compareAtPrice
              weight
              weightUnit
              inventoryQuantity
              selectedOptions {
                name
                value
              }
              metafields(first: 10, namespace: "custom") {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
      shippingLines {
        id
        title
        code
        source
        phone
        requestedFulfillmentServiceId
        deliveryCategory
        carrierIdentifier
        discountedPriceSet {
          shopMoney {
            amount
            currencyCode
          }
          presentmentMoney {
            amount
            currencyCode
          }
        }
        originalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
          presentmentMoney {
            amount
            currencyCode
          }
        }
      }
      taxLines {
        title
        rate
        ratePercentage
        priceSet {
          shopMoney {
            amount
            currencyCode
          }
          presentmentMoney {
            amount
            currencyCode
          }
        }
      }
      discountApplications {
        edges {
          node {
            ... on DiscountCodeApplication {
              code
              applicable
            }
            ... on ScriptDiscountApplication {
              title
            }
            ... on ManualDiscountApplication {
              title
              description
            }
            allocationMethod
            targetSelection
            targetType
            value {
              ... on MoneyV2 {
                amount
                currencyCode
              }
              ... on PricingPercentageValue {
                percentage
              }
            }
          }
        }
      }
      fulfillments {
        id
        name
        status
        trackingCompany
        trackingNumber
        trackingUrl
        createdAt
        updatedAt
        displayStatus
        estimatedDeliveryAt
        inTransitAt
        deliveredAt
        service {
          serviceName
          shippingMethods
        }
        originAddress {
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        fulfillmentLineItems(first: 250) {
          edges {
            node {
              id
              quantity
              lineItem {
                id
                name
                quantity
              }
            }
          }
        }
      }
    }
  }
`

/**
 * Service for fetching orders using GraphQL
 */
export class OrderGraphQLService {
  private client: ShopifyGraphQLClient

  constructor(session: Session) {
    this.client = createGraphQLClient(session)
  }

  /**
   * Fetch orders with pagination and filtering
   */
  async getOrders(options: {
    first?: number
    after?: string
    last?: number
    before?: string
    dateFrom?: Date
    dateTo?: Date
    status?: string
    financialStatus?: string
    fulfillmentStatus?: string
    query?: string
    sortKey?: 'CREATED_AT' | 'UPDATED_AT' | 'ORDER_NUMBER' | 'TOTAL_PRICE'
    reverse?: boolean
  } = {}): Promise<PaginatedResponse<any>> {
    const {
      first = 50,
      after,
      last,
      before,
      dateFrom,
      dateTo,
      status,
      financialStatus,
      fulfillmentStatus,
      query,
      sortKey = 'CREATED_AT',
      reverse = true
    } = options

    // Build query string for filtering
    let queryString = query || ''
    const queryParts: string[] = []

    if (dateFrom) {
      queryParts.push(`created_at:>='${dateFrom.toISOString()}'`)
    }

    if (dateTo) {
      queryParts.push(`created_at:<='${dateTo.toISOString()}'`)
    }

    if (status) {
      queryParts.push(`status:${status}`)
    }

    if (financialStatus) {
      queryParts.push(`financial_status:${financialStatus}`)
    }

    if (fulfillmentStatus) {
      queryParts.push(`fulfillment_status:${fulfillmentStatus}`)
    }

    if (queryParts.length > 0) {
      queryString = queryParts.join(' AND ')
    }

    const variables = {
      first: last ? undefined : first,
      after,
      last,
      before,
      query: queryString || undefined,
      sortKey,
      reverse
    }

    try {
      const response = await this.client.query<OrdersQueryResponse>(
        ORDERS_QUERY,
        variables
      )

      const orders = response.orders.edges.map(edge => edge.node)
      const pageInfo: PaginationInfo = {
        hasNextPage: response.orders.pageInfo.hasNextPage,
        hasPreviousPage: response.orders.pageInfo.hasPreviousPage,
        startCursor: response.orders.pageInfo.startCursor,
        endCursor: response.orders.pageInfo.endCursor
      }

      return {
        data: orders,
        pageInfo
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw new Error(`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch a single order by ID
   */
  async getOrder(orderId: string): Promise<any | null> {
    // Ensure the ID is in the correct GraphQL format
    const graphqlId = orderId.startsWith('gid://') 
      ? orderId 
      : `gid://shopify/Order/${orderId}`

    try {
      const response = await this.client.query<OrderQueryResponse>(
        ORDER_QUERY,
        { id: graphqlId }
      )

      return response.order
    } catch (error) {
      console.error('Error fetching order:', error)
      throw new Error(`Failed to fetch order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch orders by date range (helper method for bulk operations)
   */
  async getOrdersByDateRange(
    dateFrom: Date,
    dateTo: Date,
    options: {
      status?: string
      financialStatus?: string
      fulfillmentStatus?: string
    } = {}
  ): Promise<any[]> {
    const allOrders: any[] = []
    let hasNextPage = true
    let cursor: string | undefined

    while (hasNextPage) {
      const result = await this.getOrders({
        first: 250, // Maximum allowed by Shopify
        after: cursor,
        dateFrom,
        dateTo,
        ...options
      })

      allOrders.push(...result.data)
      hasNextPage = result.pageInfo.hasNextPage
      cursor = result.pageInfo.endCursor
    }

    return allOrders
  }

  /**
   * Fetch orders by IDs (for bulk operations)
   */
  async getOrdersByIds(orderIds: string[]): Promise<any[]> {
    const orders: any[] = []
    
    // Process orders in batches to avoid overwhelming the API
    const batchSize = 10
    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize)
      const batchPromises = batch.map(id => this.getOrder(id))
      
      try {
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            orders.push(result.value)
          } else {
            console.warn(`Failed to fetch order ${batch[index]}:`, 
              result.status === 'rejected' ? result.reason : 'Order not found')
          }
        })
      } catch (error) {
        console.error('Error in batch processing:', error)
      }
    }

    return orders
  }

  /**
   * Search orders by customer email or name
   */
  async searchOrders(searchTerm: string, limit: number = 50): Promise<any[]> {
    const result = await this.getOrders({
      first: limit,
      query: `email:*${searchTerm}* OR customer.first_name:*${searchTerm}* OR customer.last_name:*${searchTerm}*`
    })

    return result.data
  }

  /**
   * Get orders count for a date range
   */
  async getOrdersCount(
    dateFrom?: Date,
    dateTo?: Date,
    status?: string
  ): Promise<number> {
    // Note: This is a simplified implementation
    // In a real scenario, you might want to use a separate count query
    const result = await this.getOrders({
      first: 1,
      dateFrom,
      dateTo,
      status
    })

    // This is an approximation - for exact counts, you'd need to implement
    // a separate GraphQL query or iterate through all pages
    return result.data.length
  }

  /**
   * Update the session for the GraphQL client
   */
  updateSession(session: Session): void {
    this.client.updateSession(session)
  }
}

/**
 * Factory function to create order service
 */
export function createOrderGraphQLService(session: Session): OrderGraphQLService {
  return new OrderGraphQLService(session)
}
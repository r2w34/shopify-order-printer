import { GraphQLClient } from 'graphql-request'
import { shopify } from '../shopify'
import type { Session } from '@shopify/shopify-api'
import type { GraphQLResponse, GraphQLError } from '../../types/shopify'

/**
 * GraphQL Client for Shopify Admin API
 * Handles authentication, rate limiting, and error handling
 */
export class ShopifyGraphQLClient {
  private client: GraphQLClient
  private session: Session
  private rateLimitDelay: number = 0
  private maxRetries: number = 3
  private baseDelay: number = 1000 // 1 second base delay

  constructor(session: Session) {
    this.session = session
    this.client = new GraphQLClient(
      `https://${session.shop}/admin/api/${shopify.config.apiVersion}/graphql.json`,
      {
        headers: {
          'X-Shopify-Access-Token': session.accessToken!,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  /**
   * Execute a GraphQL query with retry logic and rate limiting
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      // Apply rate limiting delay if needed
      if (this.rateLimitDelay > 0) {
        await this.sleep(this.rateLimitDelay)
        this.rateLimitDelay = 0
      }

      try {
        const response = await this.client.request<T>(query, variables)
        return response
      } catch (error: any) {
        // Handle GraphQL errors
        if (error.response?.errors) {
          throw new GraphQLQueryError(error.response.errors, query, variables)
        }
        
        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers?.['retry-after']
          this.rateLimitDelay = retryAfter ? parseInt(retryAfter) * 1000 : 2000
          throw new RateLimitError(this.rateLimitDelay)
        }

        // Handle authentication errors
        if (error.response?.status === 401) {
          throw new AuthenticationError('Invalid or expired access token')
        }

        // Handle other HTTP errors
        if (error.response?.status) {
          throw new HTTPError(error.response.status, error.message)
        }

        throw error
      }
    })
  }

  /**
   * Execute a GraphQL mutation with retry logic and rate limiting
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>
  ): Promise<T> {
    return this.query<T>(mutation, variables)
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      // Don't retry authentication errors
      if (error instanceof AuthenticationError) {
        throw error
      }

      // Retry rate limit errors and network errors
      if (
        (error instanceof RateLimitError || error instanceof HTTPError) &&
        attempt < this.maxRetries
      ) {
        const delay = this.calculateBackoffDelay(attempt)
        await this.sleep(delay)
        return this.executeWithRetry(operation, attempt + 1)
      }

      throw error
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit status from last response
   */
  getRateLimitStatus(): {
    remaining: number
    limit: number
    resetTime: Date | null
  } {
    // This would be populated from response headers in a real implementation
    // For now, return default values
    return {
      remaining: 40,
      limit: 40,
      resetTime: null
    }
  }

  /**
   * Update session if token is refreshed
   */
  updateSession(session: Session): void {
    this.session = session
    this.client = new GraphQLClient(
      `https://${session.shop}/admin/api/${shopify.config.apiVersion}/graphql.json`,
      {
        headers: {
          'X-Shopify-Access-Token': session.accessToken!,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

/**
 * Custom error classes for better error handling
 */
export class GraphQLQueryError extends Error {
  public errors: GraphQLError[]
  public query: string
  public variables?: Record<string, any>

  constructor(errors: GraphQLError[], query: string, variables?: Record<string, any>) {
    const message = `GraphQL query failed: ${errors.map(e => e.message).join(', ')}`
    super(message)
    this.name = 'GraphQLQueryError'
    this.errors = errors
    this.query = query
    this.variables = variables
  }
}

export class RateLimitError extends Error {
  public retryAfter: number

  constructor(retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}ms`)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class HTTPError extends Error {
  public status: number

  constructor(status: number, message: string) {
    super(`HTTP ${status}: ${message}`)
    this.name = 'HTTPError'
    this.status = status
  }
}

/**
 * Factory function to create GraphQL client from session
 */
export function createGraphQLClient(session: Session): ShopifyGraphQLClient {
  return new ShopifyGraphQLClient(session)
}

/**
 * Utility function to validate GraphQL response
 */
export function validateGraphQLResponse<T>(
  response: GraphQLResponse<T>
): T {
  if (response.errors && response.errors.length > 0) {
    throw new GraphQLQueryError(response.errors, '', {})
  }
  
  if (!response.data) {
    throw new Error('GraphQL response contains no data')
  }
  
  return response.data
}
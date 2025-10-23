import { shopify } from '@/lib/shopify'
import { sessionStorage } from '@/lib/session'
import { NextRequest } from 'next/server'
import { DataCleanupService } from './dataCleanupService'
import { WebhookMonitoringService } from './webhookMonitoringService'

export interface WebhookValidationResult {
  isValid: boolean
  shop?: string
  topic?: string
  data?: any
}

export class WebhookService {
  /**
   * Validates incoming webhook request using HMAC verification
   */
  static async validateWebhook(request: NextRequest, body: string): Promise<WebhookValidationResult> {
    try {
      const topic = request.headers.get('x-shopify-topic')
      const shop = request.headers.get('x-shopify-shop-domain')
      const hmac = request.headers.get('x-shopify-hmac-sha256')

      if (!topic || !shop || !hmac) {
        console.error('Missing required webhook headers')
        return { isValid: false }
      }

      // Verify webhook authenticity using Shopify's built-in validation
      const isValid = await shopify.webhooks.validate({
        rawBody: body,
        rawRequest: request,
      })

      if (!isValid) {
        console.error('Webhook HMAC validation failed')
        return { isValid: false }
      }

      let data
      try {
        data = JSON.parse(body)
      } catch (parseError) {
        console.error('Failed to parse webhook body:', parseError)
        return { isValid: false }
      }

      return {
        isValid: true,
        shop,
        topic,
        data
      }
    } catch (error) {
      console.error('Webhook validation error:', error)
      return { isValid: false }
    }
  }

  /**
   * Handles order creation webhook
   */
  static async handleOrderCreated(orderData: any, shop: string): Promise<void> {
    try {
      console.log(`Processing new order ${orderData.id} for shop ${shop}`)
      
      // Log order creation for monitoring
      console.log('Order details:', {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        customerEmail: orderData.customer?.email,
        totalPrice: orderData.total_price,
        createdAt: orderData.created_at
      })

      // Here you could implement additional logic such as:
      // - Caching order data for faster access
      // - Triggering notifications
      // - Updating analytics
      // - Syncing with external systems

    } catch (error) {
      console.error('Error handling order created webhook:', error)
      throw error
    }
  }

  /**
   * Handles order update webhook
   */
  static async handleOrderUpdated(orderData: any, shop: string): Promise<void> {
    try {
      console.log(`Processing order update ${orderData.id} for shop ${shop}`)
      
      // Log order update for monitoring
      console.log('Order update details:', {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        financialStatus: orderData.financial_status,
        fulfillmentStatus: orderData.fulfillment_status,
        updatedAt: orderData.updated_at
      })

      // Here you could implement additional logic such as:
      // - Invalidating cached order data
      // - Updating order status in local storage
      // - Triggering status change notifications
      // - Updating GST calculations if order total changed

    } catch (error) {
      console.error('Error handling order updated webhook:', error)
      throw error
    }
  }

  /**
   * Handles app uninstallation webhook with comprehensive data cleanup
   */
  static async handleAppUninstalled(appData: any, shop: string): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`Processing app uninstallation for shop ${shop}`)
      
      // Perform comprehensive data cleanup
      const cleanupResult = await DataCleanupService.performAppUninstallCleanup(shop)
      
      if (!cleanupResult.success) {
        throw new Error(`Data cleanup failed: ${cleanupResult.errors.join(', ')}`)
      }

      // Validate cleanup was successful
      const isCleanupValid = await DataCleanupService.validateCleanup(shop)
      if (!isCleanupValid) {
        console.error(`Cleanup validation failed for shop ${shop}`)
        // Don't throw error here as the main cleanup succeeded
      }

      // Log cleanup metrics
      const processingTime = Date.now() - startTime
      DataCleanupService.logCleanupMetrics(shop, cleanupResult, processingTime)

      console.log(`App uninstallation cleanup completed for shop ${shop}`)

    } catch (error) {
      console.error('Error handling app uninstalled webhook:', error)
      
      // Log failed cleanup metrics
      const processingTime = Date.now() - startTime
      DataCleanupService.logCleanupMetrics(shop, {
        success: false,
        sessionsDeleted: 0,
        errors: [(error as Error).message],
        cleanupActions: []
      }, processingTime)
      
      throw error
    }
  }

  /**
   * Implements retry mechanism for failed webhook processing
   */
  static async processWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.error(`Webhook processing attempt ${attempt} failed:`, error)
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = delayMs * Math.pow(2, attempt - 1)
          console.log(`Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError!
  }

  /**
   * Logs webhook processing for monitoring and debugging
   */
  static logWebhookProcessing(
    topic: string,
    shop: string,
    success: boolean,
    processingTimeMs: number,
    error?: Error,
    retryCount?: number
  ): void {
    // Use the monitoring service to record metrics
    WebhookMonitoringService.recordWebhookMetrics(
      shop,
      topic,
      success,
      processingTimeMs,
      error,
      retryCount
    )

    // Legacy logging for backward compatibility
    const logData = {
      timestamp: new Date().toISOString(),
      topic,
      shop,
      success,
      processingTimeMs,
      error: error?.message,
      retryCount
    }

    if (success) {
      console.log('Webhook processed successfully:', logData)
    } else {
      console.error('Webhook processing failed:', logData)
    }
  }
}
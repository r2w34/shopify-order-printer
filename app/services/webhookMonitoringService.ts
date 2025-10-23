export interface WebhookMetrics {
  timestamp: string
  shop: string
  topic: string
  success: boolean
  processingTimeMs: number
  error?: string
  retryCount?: number
}

export interface WebhookHealthStatus {
  totalWebhooks: number
  successfulWebhooks: number
  failedWebhooks: number
  averageProcessingTime: number
  errorRate: number
  lastProcessedAt?: string
}

export class WebhookMonitoringService {
  private static metrics: WebhookMetrics[] = []
  private static readonly MAX_METRICS_HISTORY = 1000

  /**
   * Records webhook processing metrics
   */
  static recordWebhookMetrics(
    shop: string,
    topic: string,
    success: boolean,
    processingTimeMs: number,
    error?: Error,
    retryCount?: number
  ): void {
    const metric: WebhookMetrics = {
      timestamp: new Date().toISOString(),
      shop,
      topic,
      success,
      processingTimeMs,
      error: error?.message,
      retryCount
    }

    // Add to metrics history
    this.metrics.push(metric)

    // Keep only the most recent metrics to prevent memory issues
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY)
    }

    // Log the metric
    if (success) {
      console.log('Webhook processed successfully:', {
        shop,
        topic,
        processingTimeMs,
        retryCount
      })
    } else {
      console.error('Webhook processing failed:', {
        shop,
        topic,
        processingTimeMs,
        error: error?.message,
        retryCount
      })
    }

    // In production, you might want to send metrics to external monitoring services
    // this.sendToMonitoringService(metric)
  }

  /**
   * Gets webhook health status for a specific shop
   */
  static getWebhookHealthStatus(shop?: string): WebhookHealthStatus {
    const relevantMetrics = shop 
      ? this.metrics.filter(m => m.shop === shop)
      : this.metrics

    if (relevantMetrics.length === 0) {
      return {
        totalWebhooks: 0,
        successfulWebhooks: 0,
        failedWebhooks: 0,
        averageProcessingTime: 0,
        errorRate: 0
      }
    }

    const successfulWebhooks = relevantMetrics.filter(m => m.success).length
    const failedWebhooks = relevantMetrics.length - successfulWebhooks
    const totalProcessingTime = relevantMetrics.reduce((sum, m) => sum + m.processingTimeMs, 0)
    const averageProcessingTime = totalProcessingTime / relevantMetrics.length
    const errorRate = (failedWebhooks / relevantMetrics.length) * 100
    const lastProcessedAt = relevantMetrics[relevantMetrics.length - 1]?.timestamp

    return {
      totalWebhooks: relevantMetrics.length,
      successfulWebhooks,
      failedWebhooks,
      averageProcessingTime: Math.round(averageProcessingTime),
      errorRate: Math.round(errorRate * 100) / 100,
      lastProcessedAt
    }
  }

  /**
   * Gets recent webhook failures for debugging
   */
  static getRecentFailures(shop?: string, limit: number = 10): WebhookMetrics[] {
    const relevantMetrics = shop 
      ? this.metrics.filter(m => m.shop === shop && !m.success)
      : this.metrics.filter(m => !m.success)

    return relevantMetrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Gets webhook processing statistics by topic
   */
  static getStatsByTopic(shop?: string): Record<string, WebhookHealthStatus> {
    const relevantMetrics = shop 
      ? this.metrics.filter(m => m.shop === shop)
      : this.metrics

    const statsByTopic: Record<string, WebhookHealthStatus> = {}

    // Group metrics by topic
    const metricsByTopic = relevantMetrics.reduce((acc, metric) => {
      if (!acc[metric.topic]) {
        acc[metric.topic] = []
      }
      acc[metric.topic].push(metric)
      return acc
    }, {} as Record<string, WebhookMetrics[]>)

    // Calculate stats for each topic
    Object.entries(metricsByTopic).forEach(([topic, topicMetrics]) => {
      const successfulWebhooks = topicMetrics.filter(m => m.success).length
      const failedWebhooks = topicMetrics.length - successfulWebhooks
      const totalProcessingTime = topicMetrics.reduce((sum, m) => sum + m.processingTimeMs, 0)
      const averageProcessingTime = totalProcessingTime / topicMetrics.length
      const errorRate = (failedWebhooks / topicMetrics.length) * 100
      const lastProcessedAt = topicMetrics[topicMetrics.length - 1]?.timestamp

      statsByTopic[topic] = {
        totalWebhooks: topicMetrics.length,
        successfulWebhooks,
        failedWebhooks,
        averageProcessingTime: Math.round(averageProcessingTime),
        errorRate: Math.round(errorRate * 100) / 100,
        lastProcessedAt
      }
    })

    return statsByTopic
  }

  /**
   * Checks if webhook processing is healthy
   */
  static isWebhookHealthy(shop?: string, errorThreshold: number = 10): boolean {
    const healthStatus = this.getWebhookHealthStatus(shop)
    
    // Consider healthy if error rate is below threshold and we have recent activity
    const isErrorRateHealthy = healthStatus.errorRate < errorThreshold
    const hasRecentActivity = healthStatus.lastProcessedAt && 
      (Date.now() - new Date(healthStatus.lastProcessedAt).getTime()) < 24 * 60 * 60 * 1000 // 24 hours

    return isErrorRateHealthy && (healthStatus.totalWebhooks === 0 || hasRecentActivity)
  }

  /**
   * Generates a health report for monitoring dashboards
   */
  static generateHealthReport(shop?: string): string {
    const healthStatus = this.getWebhookHealthStatus(shop)
    const statsByTopic = this.getStatsByTopic(shop)
    const recentFailures = this.getRecentFailures(shop, 5)
    const isHealthy = this.isWebhookHealthy(shop)

    const report = [
      `=== Webhook Health Report ${shop ? `for ${shop}` : '(All Shops)'} ===`,
      `Status: ${isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`,
      `Total Webhooks: ${healthStatus.totalWebhooks}`,
      `Success Rate: ${100 - healthStatus.errorRate}%`,
      `Average Processing Time: ${healthStatus.averageProcessingTime}ms`,
      `Last Processed: ${healthStatus.lastProcessedAt || 'Never'}`,
      '',
      '=== Stats by Topic ===',
      ...Object.entries(statsByTopic).map(([topic, stats]) => 
        `${topic}: ${stats.successfulWebhooks}/${stats.totalWebhooks} success (${100 - stats.errorRate}%)`
      ),
      ''
    ]

    if (recentFailures.length > 0) {
      report.push('=== Recent Failures ===')
      recentFailures.forEach(failure => {
        report.push(`${failure.timestamp} - ${failure.topic}: ${failure.error}`)
      })
    }

    return report.join('\n')
  }

  /**
   * Clears old metrics (useful for testing or memory management)
   */
  static clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Gets all metrics (useful for debugging)
   */
  static getAllMetrics(): WebhookMetrics[] {
    return [...this.metrics]
  }
}
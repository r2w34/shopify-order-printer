import { BulkPrintJob } from '@/types/shopify'

// In-memory storage for bulk print jobs
// In a production app, this would be stored in a database
const bulkPrintJobs = new Map<string, {
  job: BulkPrintJob
  metadata: {
    orderIds: string[]
    templateId?: string
    includeGSTBreakdown: boolean
    groupByDate: boolean
    shopDomain: string
  }
}>()

// Store generated files temporarily
const generatedFiles = new Map<string, {
  content: Buffer | string
  contentType: string
  filename: string
  createdAt: Date
}>()

export async function createBulkPrintJob(
  job: BulkPrintJob,
  metadata: {
    orderIds: string[]
    templateId?: string
    includeGSTBreakdown: boolean
    groupByDate: boolean
    shopDomain: string
  }
): Promise<void> {
  bulkPrintJobs.set(job.id, { job, metadata })
}

export async function getBulkPrintJob(jobId: string): Promise<BulkPrintJob | null> {
  const stored = bulkPrintJobs.get(jobId)
  return stored ? stored.job : null
}

export async function updateBulkPrintJob(
  jobId: string,
  updates: Partial<BulkPrintJob>
): Promise<void> {
  const stored = bulkPrintJobs.get(jobId)
  if (stored) {
    stored.job = { ...stored.job, ...updates }
    bulkPrintJobs.set(jobId, stored)
  }
}

export async function deleteBulkPrintJob(jobId: string): Promise<void> {
  bulkPrintJobs.delete(jobId)
  // Also clean up any associated files
  const fileKeys = Array.from(generatedFiles.keys()).filter(key => key.startsWith(jobId))
  fileKeys.forEach(key => generatedFiles.delete(key))
}

export async function getBulkPrintJobsByShop(shopDomain: string): Promise<BulkPrintJob[]> {
  const jobs: BulkPrintJob[] = []
  
  for (const [, stored] of bulkPrintJobs) {
    if (stored.metadata.shopDomain === shopDomain) {
      jobs.push(stored.job)
    }
  }
  
  // Sort by creation date, newest first
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function storeGeneratedFile(
  jobId: string,
  filename: string,
  content: Buffer | string,
  contentType: string
): Promise<string> {
  const fileKey = `${jobId}_${filename}`
  
  generatedFiles.set(fileKey, {
    content,
    contentType,
    filename,
    createdAt: new Date()
  })
  
  return `/api/print/download/${fileKey}`
}

export async function getGeneratedFile(fileKey: string): Promise<{
  content: Buffer | string
  contentType: string
  filename: string
} | null> {
  return generatedFiles.get(fileKey) || null
}

// Cleanup expired jobs and files
export async function cleanupExpiredJobs(): Promise<void> {
  const now = new Date()
  const expiredJobIds: string[] = []
  
  for (const [jobId, stored] of bulkPrintJobs) {
    const job = stored.job
    
    // Remove jobs older than 24 hours or explicitly expired
    const isExpired = job.expiresAt 
      ? new Date(job.expiresAt) < now
      : new Date(job.createdAt).getTime() + (24 * 60 * 60 * 1000) < now.getTime()
    
    if (isExpired) {
      expiredJobIds.push(jobId)
    }
  }
  
  // Delete expired jobs and their files
  for (const jobId of expiredJobIds) {
    await deleteBulkPrintJob(jobId)
  }
  
  // Also cleanup orphaned files older than 24 hours
  const expiredFileKeys: string[] = []
  for (const [fileKey, file] of generatedFiles) {
    if (file.createdAt.getTime() + (24 * 60 * 60 * 1000) < now.getTime()) {
      expiredFileKeys.push(fileKey)
    }
  }
  
  expiredFileKeys.forEach(key => generatedFiles.delete(key))
  
  console.log(`Cleaned up ${expiredJobIds.length} expired jobs and ${expiredFileKeys.length} expired files`)
}

// Initialize cleanup interval (run every hour)
if (typeof window === 'undefined') { // Only run on server
  setInterval(cleanupExpiredJobs, 60 * 60 * 1000)
}

// Queue management utilities
export class BulkPrintQueue {
  private static instance: BulkPrintQueue
  private processingJobs = new Set<string>()
  private maxConcurrentJobs = 3

  static getInstance(): BulkPrintQueue {
    if (!BulkPrintQueue.instance) {
      BulkPrintQueue.instance = new BulkPrintQueue()
    }
    return BulkPrintQueue.instance
  }

  async addJob(jobId: string, processor: () => Promise<void>): Promise<void> {
    // Wait if we're at max capacity
    while (this.processingJobs.size >= this.maxConcurrentJobs) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    this.processingJobs.add(jobId)
    
    try {
      await processor()
    } finally {
      this.processingJobs.delete(jobId)
    }
  }

  getQueueStatus(): {
    processing: number
    maxConcurrent: number
    availableSlots: number
  } {
    return {
      processing: this.processingJobs.size,
      maxConcurrent: this.maxConcurrentJobs,
      availableSlots: this.maxConcurrentJobs - this.processingJobs.size
    }
  }

  isJobProcessing(jobId: string): boolean {
    return this.processingJobs.has(jobId)
  }
}

// Utility functions for CSV generation
export function generateCSVContent(data: any[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] ?? ''
        // Escape commas, quotes, and newlines in CSV values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ]
  
  return csvRows.join('\n')
}

// Utility function to format order data for CSV export
export function formatOrderForCSV(order: any, includeGSTBreakdown: boolean = true) {
  const customerName = order.customer 
    ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
    : 'Guest'

  const formatAddress = (address: any) => {
    if (!address) return ''
    return [
      address.address1,
      address.address2,
      address.city,
      address.province,
      address.zip,
      address.country
    ].filter(Boolean).join(', ')
  }

  const baseData = {
    orderNumber: order.name,
    orderDate: new Date(order.created_at).toLocaleDateString('en-IN'),
    customerName,
    customerEmail: order.email || '',
    customerPhone: order.phone || order.customer?.phone || '',
    shippingAddress: formatAddress(order.shipping_address),
    billingAddress: formatAddress(order.billing_address),
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    totalPrice: parseFloat(order.total_price),
    subtotalPrice: parseFloat(order.subtotal_price),
    totalTax: parseFloat(order.total_tax),
    totalDiscounts: parseFloat(order.total_discounts),
    currency: order.currency,
    itemCount: order.line_items.length,
    totalQuantity: order.line_items.reduce((sum: number, item: any) => sum + item.quantity, 0)
  }

  // Add GST breakdown if available and requested
  if (includeGSTBreakdown && order.gstBreakdown) {
    const gst = order.gstBreakdown
    return {
      ...baseData,
      gstType: gst.gstType,
      gstRate: gst.gstRate,
      taxableAmount: gst.taxableAmount,
      totalGstAmount: gst.totalGstAmount,
      cgstAmount: gst.cgstAmount || 0,
      sgstAmount: gst.sgstAmount || 0,
      igstAmount: gst.igstAmount || 0,
      hsnCode: gst.hsnCode || ''
    }
  }

  return baseData
}
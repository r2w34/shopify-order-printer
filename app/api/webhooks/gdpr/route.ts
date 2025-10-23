import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GDPR Compliance Webhooks Handler
 * Required by Shopify for App Store approval
 * Handles: customers/data_request, customers/redact, shop/redact
 */

export async function POST(request: NextRequest) {
  try {
    const topic = request.headers.get('x-shopify-topic')
    const shop = request.headers.get('x-shopify-shop-domain')
    const hmac = request.headers.get('x-shopify-hmac-sha256')
    
    const body = await request.text()
    const payload = JSON.parse(body)

    // Log the webhook
    await logWebhook(shop || '', topic || '', payload)

    // Route to appropriate handler
    switch (topic) {
      case 'customers/data_request':
        await handleCustomerDataRequest(payload)
        break
      
      case 'customers/redact':
        await handleCustomerRedact(payload)
        break
      
      case 'shop/redact':
        await handleShopRedact(payload)
        break
      
      default:
        console.warn(`Unknown GDPR topic: ${topic}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GDPR webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleCustomerDataRequest(payload: any) {
  const { shop_domain, customer } = payload
  console.log(`[GDPR] Customer data request for shop: ${shop_domain}, customer: ${customer?.email}`)
  
  await prisma.webhookLog.create({
    data: {
      shop: shop_domain,
      topic: 'customers/data_request',
      webhookId: `gdpr-data-request-${Date.now()}`,
      payload: payload,
      status: 'PROCESSED',
      processingTimeMs: 0,
      processedAt: new Date(),
    },
  })
}

async function handleCustomerRedact(payload: any) {
  const { shop_domain, customer } = payload
  console.log(`[GDPR] Customer redaction for shop: ${shop_domain}, customer: ${customer?.email}`)
  
  await prisma.webhookLog.create({
    data: {
      shop: shop_domain,
      topic: 'customers/redact',
      webhookId: `gdpr-customer-redact-${Date.now()}`,
      payload: payload,
      status: 'PROCESSED',
      processingTimeMs: 0,
      processedAt: new Date(),
    },
  })
}

async function handleShopRedact(payload: any) {
  const { shop_domain } = payload
  console.log(`[GDPR] Shop redaction for: ${shop_domain}`)
  
  await deleteAllShopData(shop_domain)
}

async function deleteAllShopData(shop: string) {
  await prisma.webhookLog.deleteMany({ where: { shop } })
  await prisma.printJob.deleteMany({ where: { shop } })
  await prisma.template.deleteMany({ where: { shop } })
  await prisma.session.deleteMany({ where: { shop } })
  await prisma.appSettings.deleteMany({ where: { shop } })
  await prisma.appInstallation.updateMany({
    where: { shop },
    data: { isActive: false, uninstalledAt: new Date() },
  })
  console.log(`[GDPR] Shop data deleted: ${shop}`)
}

async function logWebhook(shop: string, topic: string, payload: any) {
  try {
    await prisma.webhookLog.create({
      data: { shop, topic, webhookId: `webhook-${Date.now()}`, payload, status: 'RECEIVED' },
    })
  } catch (error) {
    console.error('Failed to log webhook:', error)
  }
}

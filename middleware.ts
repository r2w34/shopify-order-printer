import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and API routes that don't need auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/auth/error') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Check for Shopify shop parameter
  const shop = request.nextUrl.searchParams.get('shop')
  const host = request.nextUrl.searchParams.get('host')

  // Allow requests without shop parameter to pass through
  // The AppBridgeProvider will handle the logic client-side

  // Create response with security headers for embedded app
  const response = NextResponse.next()
  
  // Security headers for Shopify embedded apps
  response.headers.set('X-Frame-Options', 'ALLOWALL')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy for Shopify embedded apps
  const cspDirectives = [
    "default-src 'self'",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
    "connect-src 'self' https://*.myshopify.com https://monorail-edge.shopifysvc.com wss://*.myshopify.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://*.shopifycdn.com",
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://*.shopifycdn.com https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com https://cdn.shopify.com https://*.shopifycdn.com",
    "media-src 'self' https: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ]
  
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '))

  // Add shop parameter to response headers for client-side access
  if (shop) {
    response.headers.set('X-Shopify-Shop', shop)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (authentication routes)
     * - api/webhooks (webhook routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/error (error pages)
     */
    '/((?!api/auth|api/webhooks|auth/error|_next/static|_next/image|favicon.ico).*)',
  ],
}
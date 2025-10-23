'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Exit Iframe Component
 * Redirects the parent window to the OAuth flow when the app is loaded in an iframe
 * This is necessary for embedded apps that need to complete OAuth
 */
export function ExitIframe() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const shop = searchParams.get('shop')
    
    if (!shop) {
      return
    }

    // Check if we're in an iframe
    if (window.top !== window.self) {
      // Build the auth URL
      const authUrl = new URL('/api/auth', window.location.origin)
      authUrl.searchParams.set('shop', shop)
      
      // Get the host parameter if it exists
      const host = searchParams.get('host')
      if (host) {
        authUrl.searchParams.set('host', host)
      }

      // Redirect the parent window (break out of iframe)
      window.top!.location.href = authUrl.toString()
    }
  }, [searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-lg font-medium text-gray-700">Redirecting to Shopify authentication...</p>
        <p className="mt-2 text-sm text-gray-500">Please wait a moment.</p>
      </div>
    </div>
  )
}

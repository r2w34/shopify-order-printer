'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Provider as AppBridgeReactProvider } from '@shopify/app-bridge-react'

interface AppBridgeProviderProps {
  children: ReactNode
}

export function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    const shop = searchParams.get('shop')
    const host = searchParams.get('host')
    
    // If we have shop parameter, we're in Shopify context
    if (shop) {
      const appBridgeConfig = {
        apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY!,
        host: host || btoa(`${shop}/admin`),
        forceRedirect: true,
      }
      
      setConfig(appBridgeConfig)
    } else {
      // Not in Shopify context - check if we're on a route that needs auth
      const isAuthRoute = window.location.pathname.startsWith('/api/auth')
      const isWebhookRoute = window.location.pathname.startsWith('/api/webhooks')
      
      if (!isAuthRoute && !isWebhookRoute) {
        // Show a message asking to install the app
        console.log('No shop parameter - app needs to be accessed from Shopify admin')
      }
      
      // Set a dummy config to allow the app to render
      setConfig({
        apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY!,
        host: btoa('example.myshopify.com/admin'),
        forceRedirect: false,
      })
    }
  }, [searchParams])

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Initializing app...</p>
        </div>
      </div>
    )
  }

  return (
    <AppBridgeReactProvider config={config}>
      {children}
    </AppBridgeReactProvider>
  )
}
'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Provider as AppBridgeReactProvider } from '@shopify/app-bridge-react'

interface AppBridgeProviderProps {
  children: ReactNode
}

export function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<{apiKey: string, host: string, forceRedirect: boolean} | null>(null)

  useEffect(() => {
    const shop = searchParams.get('shop')
    const host = searchParams.get('host')
    
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY
    
    if (!apiKey) {
      console.error('NEXT_PUBLIC_SHOPIFY_API_KEY is not defined')
      return
    }
    
    // If we have shop parameter, we're in Shopify context
    if (shop && host) {
      setConfig({
        apiKey,
        host,
        forceRedirect: true,
      })
    } else if (shop) {
      // Shop but no host - create a host parameter
      setConfig({
        apiKey,
        host: btoa(`${shop}/admin`),
        forceRedirect: true,
      })
    } else {
      // Not in Shopify context - set a dummy config to allow rendering
      setConfig({
        apiKey,
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
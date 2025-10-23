'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

interface AppBridgeProviderProps {
  children: ReactNode
}

export function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  const searchParams = useSearchParams()
  const [isReady, setIsReady] = useState(false)
  const [appBridge, setAppBridge] = useState<any>(null)

  useEffect(() => {
    const shop = searchParams.get('shop')
    const host = searchParams.get('host')
    
    const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY
    
    if (!apiKey) {
      console.error('NEXT_PUBLIC_SHOPIFY_API_KEY is not defined')
      setIsReady(true)
      return
    }

    // Dynamically import App Bridge to avoid SSR issues
    import('@shopify/app-bridge').then((AppBridge) => {
      if (shop && host) {
        try {
          const app = AppBridge.createApp({
            apiKey,
            host,
          })
          setAppBridge(app)
          console.log('App Bridge initialized successfully')
        } catch (error) {
          console.error('Failed to initialize App Bridge:', error)
        }
      }
      setIsReady(true)
    }).catch((error) => {
      console.error('Failed to load App Bridge:', error)
      setIsReady(true)
    })
  }, [searchParams])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Initializing app...</p>
        </div>
      </div>
    )
  }

  // Don't use the React Provider - just initialize App Bridge and render children
  return <>{children}</>
}
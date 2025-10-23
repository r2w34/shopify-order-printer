'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TestPolaris } from '@/components/TestPolaris'
import { Page, Layout } from '@shopify/polaris'
import { AppErrorBoundary } from '@/lib/error-handling/AppErrorHandler'
import { ExitIframe } from '@/components/ExitIframe'

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4">Loading orders...</p>
      </div>
    </div>
  )
}

export default function ClientHomePage() {
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const shop = searchParams.get('shop')
  const host = searchParams.get('host')

  useEffect(() => {
    // Check if we have shop parameter
    if (!shop) {
      setIsLoading(false)
      return
    }

    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch(`/api/auth/session?shop=${shop}`)
        const data = await response.json()
        
        if (data.authenticated) {
          setIsAuthenticated(true)
        } else {
          // Not authenticated, need to go through OAuth
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [shop])

  // If no shop parameter, show installation message
  if (!shop) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">LetsPrint - Order Printer</h1>
          <p className="text-gray-600 mb-6">
            This app needs to be accessed from the Shopify Admin panel.
          </p>
          <div className="text-sm text-gray-500">
            <p className="mb-2">To install:</p>
            <ol className="text-left list-decimal list-inside space-y-1">
              <li>Go to your Shopify Partner Dashboard</li>
              <li>Select this app</li>
              <li>Click "Test on development store"</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  // If loading, show spinner
  if (isLoading) {
    return <LoadingSpinner />
  }

  // If not authenticated, trigger OAuth flow
  if (!isAuthenticated) {
    return <ExitIframe />
  }

  // Authenticated - show the app
  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Page title="Order Printer - GST Compliant">
          <Layout>
            <Layout.Section>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <h2 className="text-lg font-semibold text-green-800 mb-2">Welcome to LetsPrint!</h2>
                <p className="text-green-700">Your GST-compliant order printing solution for Indian stores.</p>
              </div>
            </Layout.Section>
            <Layout.Section>
              <TestPolaris />
            </Layout.Section>
          </Layout>
        </Page>
      </Suspense>
    </AppErrorBoundary>
  )
}
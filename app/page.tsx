import dynamicImport from 'next/dynamic'

// Dynamically import the client component to prevent SSR issues with Polaris
const ClientHomePage = dynamicImport(
  () => import('@/components/ClientHomePage'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }
)

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return <ClientHomePage />
}
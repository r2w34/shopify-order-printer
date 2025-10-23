import { Session } from '@shopify/shopify-api'
import { prisma } from './db'

// Database-backed session storage for production use
class DatabaseSessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      await prisma.session.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope,
          expires: session.expires,
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id?.toString(),
          firstName: session.onlineAccessInfo?.associated_user?.first_name,
          lastName: session.onlineAccessInfo?.associated_user?.last_name,
          email: session.onlineAccessInfo?.associated_user?.email,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
          locale: session.onlineAccessInfo?.associated_user?.locale,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
        },
        update: {
          state: session.state,
          scope: session.scope,
          expires: session.expires,
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id?.toString(),
          firstName: session.onlineAccessInfo?.associated_user?.first_name,
          lastName: session.onlineAccessInfo?.associated_user?.last_name,
          email: session.onlineAccessInfo?.associated_user?.email,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner || false,
          locale: session.onlineAccessInfo?.associated_user?.locale,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator || false,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified || false,
        },
      })
      return true
    } catch (error) {
      console.error('Failed to store session:', error)
      return false
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const dbSession = await prisma.session.findUnique({
        where: { id },
      })

      if (!dbSession) {
        return undefined
      }

      // Convert database session to Shopify Session object
      const session = new Session({
        id: dbSession.id,
        shop: dbSession.shop,
        state: dbSession.state || '',
        isOnline: dbSession.isOnline,
      })

      session.scope = dbSession.scope || undefined
      session.expires = dbSession.expires || undefined
      session.accessToken = dbSession.accessToken || undefined

      if (dbSession.userId) {
        session.onlineAccessInfo = {
          associated_user: {
            id: parseInt(dbSession.userId),
            first_name: dbSession.firstName || '',
            last_name: dbSession.lastName || '',
            email: dbSession.email || '',
            account_owner: dbSession.accountOwner,
            locale: dbSession.locale || 'en',
            collaborator: dbSession.collaborator,
            email_verified: dbSession.emailVerified,
          },
        }
      }

      return session
    } catch (error) {
      console.error('Failed to load session:', error)
      return undefined
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id },
      })
      return true
    } catch (error) {
      console.error('Failed to delete session:', error)
      return false
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      await prisma.session.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      })
      return true
    } catch (error) {
      console.error('Failed to delete sessions:', error)
      return false
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const dbSessions = await prisma.session.findMany({
        where: { 
          shop,
          OR: [
            { expires: null },
            { expires: { gt: new Date() } }
          ]
        },
        orderBy: { createdAt: 'desc' },
      })

      return dbSessions.map(dbSession => {
        const session = new Session({
          id: dbSession.id,
          shop: dbSession.shop,
          state: dbSession.state || '',
          isOnline: dbSession.isOnline,
        })

        session.scope = dbSession.scope || undefined
        session.expires = dbSession.expires || undefined
        session.accessToken = dbSession.accessToken || undefined

        if (dbSession.userId) {
          session.onlineAccessInfo = {
            associated_user: {
              id: parseInt(dbSession.userId),
              first_name: dbSession.firstName || '',
              last_name: dbSession.lastName || '',
              email: dbSession.email || '',
              account_owner: dbSession.accountOwner,
              locale: dbSession.locale || 'en',
              collaborator: dbSession.collaborator,
              email_verified: dbSession.emailVerified,
            },
          }
        }

        return session
      })
    } catch (error) {
      console.error('Failed to find sessions by shop:', error)
      return []
    }
  }

  async deleteAllSessionsForShop(shop: string): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: { shop },
      })
      return result.count
    } catch (error) {
      console.error('Failed to delete all sessions for shop:', error)
      return 0
    }
  }

  async getAllSessions(): Promise<Session[]> {
    try {
      const dbSessions = await prisma.session.findMany()
      
      return dbSessions.map(dbSession => {
        const session = new Session({
          id: dbSession.id,
          shop: dbSession.shop,
          state: dbSession.state || '',
          isOnline: dbSession.isOnline,
        })

        session.scope = dbSession.scope || undefined
        session.expires = dbSession.expires || undefined
        session.accessToken = dbSession.accessToken || undefined

        return session
      })
    } catch (error) {
      console.error('Failed to get all sessions:', error)
      return []
    }
  }

  async getSessionCount(): Promise<number> {
    try {
      return await prisma.session.count()
    } catch (error) {
      console.error('Failed to get session count:', error)
      return 0
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      await prisma.session.deleteMany()
    } catch (error) {
      console.error('Failed to clear all sessions:', error)
    }
  }
}

export const sessionStorage = new DatabaseSessionStorage()

// Helper function to get session from request
export async function getSession(request: Request): Promise<{ shop: string; accessToken: string } | null> {
  try {
    // Extract shop from query params or headers
    const url = new URL(request.url)
    const shop = url.searchParams.get('shop') || request.headers.get('x-shopify-shop')
    
    if (!shop) {
      return null
    }

    // Find active session for this shop
    const sessions = await sessionStorage.findSessionsByShop(shop)
    
    if (!sessions || sessions.length === 0) {
      return null
    }

    // Get the most recent valid session
    const validSession = sessions.find(session => {
      // Check if session is not expired
      if (session.expires && session.expires < new Date()) {
        return false
      }
      // Check if session has access token
      if (!session.accessToken) {
        return false
      }
      return true
    })

    if (!validSession || !validSession.accessToken) {
      return null
    }

    return {
      shop: validSession.shop,
      accessToken: validSession.accessToken
    }
  } catch (error) {
    console.error('Error getting session from request:', error)
    return null
  }
}
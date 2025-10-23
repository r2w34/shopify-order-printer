# Shopify Order Printer - Quick Reference Guide

## 📚 Documentation Index

This repository contains comprehensive documentation:

1. **IMPLEMENTATION_PLAN.md** - Complete implementation roadmap
2. **ARCHITECTURE_WORKFLOW.md** - Detailed technical documentation
3. **QUICK_REFERENCE.md** - This file (quick reference)

---

## 🚀 Quick Start

### For Developers

```bash
# 1. Clone and install
git clone <repository-url>
cd shopify-order-printer
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Shopify credentials

# 3. Start development server
npm run dev

# 4. Open in browser
# Visit the ngrok URL provided by Shopify CLI
```

### Environment Variables (Required)

```bash
# Shopify (Get from Partner Dashboard)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_WEBHOOK_SECRET=generate_random_32_chars
NEXT_PUBLIC_SHOPIFY_API_KEY=same_as_api_key

# Security
SESSION_SECRET=generate_random_32_chars

# Database (Local dev uses SQLite)
DATABASE_URL=sqlite:database.sqlite

# Indian GST Settings
DEFAULT_STORE_STATE=Gujarat
DEFAULT_GST_RATES_BELOW_1000=0.05
DEFAULT_GST_RATES_ABOVE_1000=0.12
```

---

## 📋 What's Implemented ✅

### Core Features
- ✅ Shopify OAuth authentication
- ✅ Order fetching with GraphQL
- ✅ Indian GST calculations (CGST/SGST/IGST)
- ✅ PDF invoice generation
- ✅ CSV export with GST breakdown
- ✅ Template management system
- ✅ Bulk PDF generation
- ✅ Webhook handling
- ✅ T-shirt product utilities
- ✅ Polaris UI components

### Services Implemented
- ✅ `OrderService` - Order management
- ✅ `GSTService` - Tax calculations
- ✅ `PDFService` - PDF generation
- ✅ `CSVExportService` - CSV export
- ✅ `TemplateService` - Template CRUD
- ✅ `BulkPrintService` - Bulk operations
- ✅ `WebhookService` - Webhook processing
- ✅ `FileStorageService` - File management

---

## ⚠️ Critical Issues (Must Fix Before Production)

### 🔴 Priority 1: Session Storage
**File**: `lib/session.ts`  
**Issue**: Using in-memory storage (won't work in production)  
**Fix**: Implement database-backed session storage

```typescript
// Current (In-Memory):
class MemorySessionStorage {
  private sessions: Map<string, Session> = new Map()
  // ❌ Lost on restart, doesn't scale
}

// Needed (Database):
class DatabaseSessionStorage {
  async storeSession(session) {
    await prisma.session.create({ data: session })
  }
  // ✅ Persistent, scalable
}
```

### 🔴 Priority 2: Session Retrieval
**File**: `lib/session.ts` lines 64-77  
**Issue**: Returns mock data  
**Fix**: Implement real token validation

```typescript
// Current:
return {
  shop: 'test-shop.myshopify.com',  // ❌ Mock
  accessToken: 'test-token'
}

// Needed:
const sessionId = extractFromCookie(request)
const session = await loadSession(sessionId)
return session  // ✅ Real data
```

### 🔴 Priority 3: Database Integration
**Issue**: SQL schema exists but not connected  
**Files**: `scripts/setup-production-db.sql`  
**Fix**: Set up Prisma ORM

```bash
# Steps needed:
1. npm install @prisma/client prisma
2. Create prisma/schema.prisma
3. npx prisma migrate dev
4. Update services to use Prisma
```

### 🔴 Priority 4: Environment Configuration
**File**: `shopify.app.toml`  
**Issue**: Placeholder URLs  
**Fix**: Update with real deployment URLs

```toml
# Current:
application_url = "https://your-ngrok-url.ngrok.io/"  # ❌

# Needed:
application_url = "https://your-real-app.com/"  # ✅
```

---

## 🛠️ Implementation Priorities

### Week 1: Critical Fixes
1. **Database Setup**
   - Install Prisma
   - Create schema
   - Set up PostgreSQL
   
2. **Session Management**
   - Implement DatabaseSessionStorage
   - Fix getSession() function
   - Test authentication flow

### Week 2: Production Ready
3. **Error Tracking**
   - Add Sentry
   - Implement logging
   
4. **Security**
   - Add rate limiting
   - GDPR webhooks
   - Audit dependencies

### Week 3: Deployment
5. **Deploy to Production**
   - Configure Vercel/Railway
   - Set up production database
   - Test end-to-end

---

## 📁 Important Files to Know

### Authentication
- `lib/auth.ts` - OAuth flow logic
- `lib/session.ts` - Session management ⚠️ NEEDS FIX
- `app/api/auth/route.ts` - Auth endpoints

### Order Processing
- `lib/services/orderService.ts` - Main order logic
- `lib/services/orderGraphQLService.ts` - GraphQL queries
- `lib/services/gstService.ts` - GST calculations
- `app/api/orders/route.ts` - Orders API

### PDF & Export
- `lib/services/pdfService.ts` - PDF generation
- `lib/services/csvExportService.ts` - CSV export
- `lib/services/bulkPrintService.ts` - Bulk operations

### Configuration
- `shopify.app.toml` - Shopify app config ⚠️ NEEDS UPDATE
- `.env.example` - Environment template
- `next.config.js` - Next.js config

---

## 🔍 How GST Calculation Works

### Decision Logic

```
Order Total: ₹850
Customer State: Maharashtra
Store State: Gujarat

Step 1: Compare states
Maharashtra ≠ Gujarat → Interstate → IGST

Step 2: Determine rate
₹850 < ₹1000 → 5% rate

Step 3: Calculate
IGST = ₹850 × 5% = ₹42.50
Total = ₹850 + ₹42.50 = ₹892.50
```

### Same State Example

```
Order Total: ₹1200
Customer State: Gujarat
Store State: Gujarat

Step 1: Compare states
Gujarat = Gujarat → Intrastate → CGST + SGST

Step 2: Determine rate
₹1200 ≥ ₹1000 → 12% rate

Step 3: Calculate
Total GST = ₹1200 × 12% = ₹144
CGST = ₹144 ÷ 2 = ₹72
SGST = ₹144 ÷ 2 = ₹72
Total = ₹1200 + ₹144 = ₹1344
```

---

## 📊 API Endpoints Quick Reference

### Orders
```
GET  /api/orders              - List orders with GST
GET  /api/orders/[id]         - Single order details
```

### Print
```
POST /api/print               - Generate single PDF
POST /api/print/bulk          - Create bulk print job
GET  /api/print/jobs/[jobId]  - Check job status
GET  /api/print/download/[id] - Download PDF
```

### Export
```
POST /api/export/csv          - Generate CSV
```

### Templates
```
GET  /api/templates           - List templates
POST /api/templates           - Create template
PUT  /api/templates/[id]      - Update template
```

### Settings
```
GET  /api/settings            - Get app settings
PUT  /api/settings            - Update settings
```

### Auth
```
GET  /api/auth                - Start OAuth
GET  /api/auth/callback       - OAuth callback
```

### Webhooks
```
POST /api/webhooks/orders     - Order webhooks
POST /api/webhooks/app/uninstalled - Uninstall webhook
```

---

## 🧪 Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run type checking
npm run type-check

# Run linter
npm run lint

# Build for production
npm run build
```

---

## 🚢 Deployment Checklist

### Pre-Deploy
- [ ] Fix session storage (use database)
- [ ] Update shopify.app.toml URLs
- [ ] Set up production database (PostgreSQL)
- [ ] Generate secure secrets
- [ ] Configure environment variables
- [ ] Run tests
- [ ] Build successfully

### Deploy
- [ ] Deploy to Vercel/Railway
- [ ] Run database migrations
- [ ] Test OAuth flow
- [ ] Test order fetching
- [ ] Test PDF generation
- [ ] Verify webhooks work

### Post-Deploy
- [ ] Set up monitoring (Sentry)
- [ ] Configure alerts
- [ ] Document deployment
- [ ] Create rollback plan

---

## 🐛 Common Issues & Solutions

### Issue: "Session not found"
**Cause**: In-memory session storage lost  
**Solution**: Restart dev server or fix session storage

### Issue: "Failed to fetch orders"
**Cause**: Invalid access token or expired session  
**Solution**: Reinstall app to get new token

### Issue: "PDF generation failed"
**Cause**: Puppeteer not installed  
**Solution**: `npm install puppeteer`

### Issue: "HMAC validation failed"
**Cause**: Wrong webhook secret  
**Solution**: Update SHOPIFY_WEBHOOK_SECRET in .env

---

## 📚 Additional Resources

### Shopify Documentation
- **App Development**: https://shopify.dev/docs/apps
- **GraphQL API**: https://shopify.dev/docs/api/admin-graphql
- **Webhooks**: https://shopify.dev/docs/apps/webhooks
- **App Store**: https://shopify.dev/docs/apps/store/requirements

### Tools
- **Shopify CLI**: https://shopify.dev/docs/apps/tools/cli
- **Polaris**: https://polaris.shopify.com/
- **Next.js**: https://nextjs.org/docs

---

## 💡 Pro Tips

1. **Use Shopify CLI for development** - Auto-manages ngrok and environment
2. **Test with development store** - Don't use production store for testing
3. **Check webhook logs** - Database stores all webhook deliveries
4. **Monitor GST calculations** - Verify against sample invoices
5. **Keep sessions short** - Forces reauth during development, catches issues

---

## 🎯 Next Steps

1. **Read IMPLEMENTATION_PLAN.md** for detailed roadmap
2. **Read ARCHITECTURE_WORKFLOW.md** for technical details
3. **Fix critical issues** (session storage, database)
4. **Deploy to staging** for testing
5. **Submit to Shopify App Store**

---

## 📞 Support & Contact

**Documentation**: See IMPLEMENTATION_PLAN.md and ARCHITECTURE_WORKFLOW.md  
**Issues**: Check common issues section above  
**Code Structure**: See ARCHITECTURE_WORKFLOW.md component breakdown

---

**Version**: 1.0  
**Last Updated**: 2025-10-23  
**Status**: Complete

---

## 🎬 Quick Commands Cheat Sheet

```bash
# Development
npm run dev                    # Start dev server
npm run shopify:dev           # Start with Shopify CLI (recommended)

# Testing
npm test                      # Run tests
npm run test:ui               # Run tests with UI
npm run type-check            # Check TypeScript

# Building
npm run build                 # Build for production
npm run start                 # Start production server

# Database (when set up)
npx prisma migrate dev        # Run migrations
npx prisma studio             # Open DB admin UI

# Deployment
npm run deploy:vercel         # Deploy to Vercel
npm run deploy:railway        # Deploy to Railway

# Utilities
npm run health:check          # Check app health
npm run lint                  # Run linter
```

---

**Happy Coding! 🚀**

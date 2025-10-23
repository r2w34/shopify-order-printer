# Migration Guide: Next.js to Shopify Remix Template

## Overview

This document outlines the migration from the Next.js App Router implementation to the official Shopify Remix (React Router) template. The Remix template is the recommended approach for Shopify apps and will resolve all routing and authentication issues.

---

## Why Migrate to Remix?

### Issues with Next.js Implementation:
- ❌ Complex routing issues with Shopify embedded apps
- ❌ React Error #130 (component rendering undefined)
- ❌ Authentication flow problems
- ❌ App Bridge integration challenges
- ❌ 404 errors in Shopify admin

### Benefits of Remix Template:
- ✅ Official Shopify-recommended structure
- ✅ Built-in authentication with `@shopify/shopify-app-remix`
- ✅ Proper App Bridge integration
- ✅ File-based routing that works with Shopify
- ✅ Session management out of the box
- ✅ GDPR webhook handlers included
- ✅ Prisma database integration
- ✅ TypeScript support

---

## Current Setup

**Template Cloned:** `shopify-app-template-remix`
**Location:** `/workspace/shopify-order-printer-remix`
**Configuration:** Updated with your app credentials

### Files Already Configured:
- ✅ `shopify.app.toml` - App configuration with client_id, scopes, webhooks
- ✅ `package.json` - App name and description updated

---

## Migration Steps

### Phase 1: Setup & Installation (15 minutes)

1. **Install Dependencies**
   ```bash
   cd /workspace/shopify-order-printer-remix
   npm install
   ```

2. **Set Environment Variables**
   Create `.env` file:
   ```env
   SHOPIFY_API_KEY=5a5fa193e345adea3497281c7f8d7c5f
   SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
   SCOPES=read_analytics,read_content,read_customers,read_inventory,read_locations,read_orders,read_product_listings,read_products,read_reports,read_shipping,write_content,write_files
   HOST=https://letsprint.indigenservices.com
   ```

3. **Initialize Database**
   ```bash
   npm run setup
   ```

---

### Phase 2: Copy Business Logic (30-45 minutes)

#### 2.1 Database Schema

Copy your Prisma schema from the old app and merge with the new one:

**Old Location:** `/workspace/shopify-order-printer/prisma/schema.prisma`
**New Location:** `/workspace/shopify-order-printer-remix/prisma/schema.prisma`

**Models to Keep from Template:**
- `Session` (required for Shopify auth)

**Models to Add from Old App:**
- `AppInstallation`
- `AppSettings`
- `Template`
- `PrintJob`
- `WebhookLog`

#### 2.2 GST Calculator

Copy the GST calculation logic:

**Old:** `/workspace/shopify-order-printer/lib/utils/gstCalculator.ts`
**New:** `/workspace/shopify-order-printer-remix/app/utils/gstCalculator.ts`

Create the directory and copy the file:
```bash
mkdir -p app/utils
cp ../shopify-order-printer/lib/utils/gstCalculator.ts app/utils/
```

#### 2.3 PDF Generation Service

Copy PDF generation logic:

**Old:** `/workspace/shopify-order-printer/lib/services/pdfService.ts`
**New:** `/workspace/shopify-order-printer-remix/app/services/pdfService.ts`

```bash
mkdir -p app/services
cp ../shopify-order-printer/lib/services/pdfService.ts app/services/
```

#### 2.4 CSV Export Service

**Old:** `/workspace/shopify-order-printer/lib/services/csvService.ts`
**New:** `/workspace/shopify-order-printer-remix/app/services/csvService.ts`

```bash
cp ../shopify-order-printer/lib/services/csvService.ts app/services/
```

---

### Phase 3: Create Routes (45-60 minutes)

Remix uses file-based routing. Create these files in `app/routes/`:

#### 3.1 Main App Page

**File:** `app/routes/app._index.tsx`

```typescript
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  return json({
    shop: session.shop,
  });
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();
  
  return (
    <Page title="LetsPrint - Order Printer">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingMd">
              Welcome to LetsPrint! 🎉
            </Text>
            <Text as="p" variant="bodyMd">
              GST-compliant order printing for your Indian store: {shop}
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

#### 3.2 Orders List Page

**File:** `app/routes/app.orders.tsx`

```typescript
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, DataTable } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  // Fetch orders from Shopify
  const response = await admin.graphql(
    `#graphql
      query {
        orders(first: 50) {
          edges {
            node {
              id
              name
              createdAt
              totalPrice
              customer {
                displayName
              }
            }
          }
        }
      }`
  );
  
  const {
    data: {
      orders: { edges },
    },
  } = await response.json();
  
  return json({ orders: edges });
};

export default function Orders() {
  const { orders } = useLoaderData<typeof loader>();
  
  const rows = orders.map(({ node }) => [
    node.name,
    node.customer?.displayName || "Guest",
    node.totalPrice,
    new Date(node.createdAt).toLocaleDateString(),
  ]);
  
  return (
    <Page title="Orders">
      <Layout>
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text"]}
              headings={["Order", "Customer", "Total", "Date"]}
              rows={rows}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

#### 3.3 Settings Page

**File:** `app/routes/app.settings.tsx`

```typescript
import { json } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, TextField, Button } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Load settings from database
  // const settings = await prisma.appSettings.findUnique({
  //   where: { shop: session.shop }
  // });
  
  return json({ shop: session.shop });
};

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  
  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <TextField
                label="Default GST Rate"
                name="gstRate"
                autoComplete="off"
              />
              <Button submit>Save Settings</Button>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

#### 3.4 GDPR Webhooks

**File:** `app/routes/webhooks.gdpr.tsx`

```typescript
import { ActionFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action: ActionFunction = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Handle customer data request
      console.log(`Customer data request for ${shop}`);
      break;
      
    case "CUSTOMERS_REDACT":
      // Handle customer data deletion
      console.log(`Customer redaction for ${shop}`);
      break;
      
    case "SHOP_REDACT":
      // Handle shop data deletion
      await db.session.deleteMany({ where: { shop } });
      console.log(`Shop data redacted for ${shop}`);
      break;
  }

  return new Response();
};
```

---

### Phase 4: Build & Test Locally (15 minutes)

1. **Build the App**
   ```bash
   npm run build
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Test in Browser**
   - Shopify CLI will provide a URL
   - Install the app on your development store
   - Test all features

---

### Phase 5: Deploy to Production (30 minutes)

#### 5.1 Update Server Files

```bash
# SSH to server
ssh root@72.60.99.154

# Stop current app
pm2 stop letsprint

# Backup old app
mv /var/www/letsprint /var/www/letsprint-nextjs-backup

# Clone new app
cd /var/www
git clone https://github.com/r2w34/shopify-order-printer.git letsprint
cd letsprint

# Checkout the remix branch (after you push it)
git checkout remix-migration
```

#### 5.2 Configure Environment

```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
SHOPIFY_API_KEY=5a5fa193e345adea3497281c7f8d7c5f
SHOPIFY_API_SECRET=YOUR_SHOPIFY_API_SECRET_HERE
SCOPES=read_analytics,read_content,read_customers,read_inventory,read_locations,read_orders,read_product_listings,read_products,read_reports,read_shipping,write_content,write_files
HOST=https://letsprint.indigenservices.com
DATABASE_URL=postgresql://shopify_user:ShopifyApp2024@localhost:5432/shopify_order_printer
EOF
```

#### 5.3 Install & Build

```bash
npm install
npm run setup
npm run build
```

#### 5.4 Update PM2 Configuration

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: "letsprint",
    script: "npm",
    args: "start",
    cwd: "/var/www/letsprint",
    env: {
      NODE_ENV: "production",
      PORT: 3002
    },
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_restarts: 10,
    min_uptime: "10s"
  }]
}
EOF

pm2 start ecosystem.config.js
pm2 save
```

---

## Key Differences: Next.js vs Remix

| Feature | Next.js (Old) | Remix (New) |
|---------|---------------|-------------|
| Routing | App Router (`app/` directory) | File-based (`app/routes/`) |
| Data Loading | `async` components + `fetch` | `loader` functions |
| Authentication | Custom implementation | `@shopify/shopify-app-remix` |
| App Bridge | Manual `Provider` setup | Built-in integration |
| Sessions | Custom Prisma storage | Built-in Prisma adapter |
| API Routes | `app/api/*/route.ts` | `app/routes/*.tsx` with `action` |
| Forms | Client-side `fetch` | `<Form>` component |
| Server Code | Server Components | `loader`/`action` functions |

---

## Testing Checklist

After deployment, test:

- [ ] App loads in Shopify admin without errors
- [ ] Authentication works (OAuth flow)
- [ ] Orders page displays correctly
- [ ] GST calculations are accurate
- [ ] PDF generation works
- [ ] CSV export works
- [ ] Settings can be saved
- [ ] Webhooks are received
- [ ] GDPR compliance webhooks work
- [ ] App can be uninstalled

---

## Rollback Plan

If issues occur, rollback to Next.js version:

```bash
ssh root@72.60.99.154
pm2 stop letsprint
rm -rf /var/www/letsprint
mv /var/www/letsprint-nextjs-backup /var/www/letsprint
cd /var/www/letsprint
pm2 restart letsprint
```

---

## Next Steps

1. ✅ Template cloned and configured
2. ⏳ Install dependencies
3. ⏳ Migrate database schema
4. ⏳ Copy business logic (GST, PDF, CSV)
5. ⏳ Create routes
6. ⏳ Test locally
7. ⏳ Deploy to production
8. ⏳ Verify in Shopify admin

---

## Resources

- [Shopify Remix Documentation](https://shopify.dev/docs/apps/build/scaffold-app)
- [Remix Documentation](https://remix.run/docs)
- [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge)
- [Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)

---

**Migration Status:** Template Ready - Awaiting Code Migration

**Estimated Total Time:** 2-3 hours

**Completion:** 0% (Template setup complete, business logic migration pending)

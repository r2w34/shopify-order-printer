# Shopify Order Printer - Architecture & Workflow Documentation

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Detailed Component Breakdown](#detailed-component-breakdown)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Database Schema](#database-schema)
6. [Service Layer Details](#service-layer-details)
7. [Frontend Architecture](#frontend-architecture)
8. [State Management](#state-management)
9. [Error Handling Patterns](#error-handling-patterns)
10. [Security Architecture](#security-architecture)

---

## 1. System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SHOPIFY ADMIN                           │
│              (Merchant Interface)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ OAuth 2.0 / App Bridge
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  EMBEDDED SHOPIFY APP                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            NEXT.JS APPLICATION                        │  │
│  │  ┌────────────────┐      ┌────────────────────────┐  │  │
│  │  │   Frontend     │      │    API Routes          │  │  │
│  │  │   (React)      │◄────►│   (Serverless)         │  │  │
│  │  │  - Polaris UI  │      │  - Auth                │  │  │
│  │  │  - App Bridge  │      │  - Orders              │  │  │
│  │  │  - React Query │      │  - Print/Export        │  │  │
│  │  └────────────────┘      └──────────┬─────────────┘  │  │
│  │                                      │                  │  │
│  │  ┌────────────────────────────────┬─▼──────────────┐  │  │
│  │  │      SERVICE LAYER             │                 │  │  │
│  │  │  - OrderService                │                 │  │  │
│  │  │  - GSTService                  │                 │  │  │
│  │  │  - PDFService                  │                 │  │  │
│  │  │  - CSVExportService            │                 │  │  │
│  │  │  - TemplateService             │                 │  │  │
│  │  │  - BulkPrintService            │                 │  │  │
│  │  └────────────────┬───────────────┘                 │  │  │
│  └───────────────────┼─────────────────────────────────┘  │
└────────────────────┬─┼─────────────────────────────────────┘
                     │ │
        ┌────────────┘ └─────────────┐
        │                             │
┌───────▼────────┐           ┌────────▼──────────┐
│   SHOPIFY      │           │   DATABASE        │
│   ADMIN API    │           │   (PostgreSQL)    │
│                │           │                   │
│  - GraphQL     │           │  - Sessions       │
│  - REST        │           │  - Templates      │
│  - Webhooks    │           │  - Settings       │
└────────────────┘           │  - Print Jobs     │
                             │  - Webhook Logs   │
                             └───────────────────┘
                                      │
                             ┌────────▼──────────┐
                             │  FILE STORAGE     │
                             │  (Local/Cloud)    │
                             │                   │
                             │  - PDFs           │
                             │  - CSVs           │
                             └───────────────────┘
```

### Technology Stack Layers

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│  React 18 + TypeScript + Shopify Polaris + App Bridge  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   APPLICATION LAYER                      │
│  Next.js 14 (App Router) + API Routes + Middleware     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                  │
│  Services + Utilities + State Management                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    DATA ACCESS LAYER                     │
│  Prisma ORM + Session Storage + File Storage            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                  │
│  PostgreSQL + Redis + Shopify API + Cloud Storage       │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Component Breakdown

### 2.1 Authentication Flow Components

#### File: `lib/auth.ts`

**Purpose**: Handles Shopify OAuth 2.0 authentication flow

**Key Functions**:

1. **`initiateOAuth(shop: string, request: NextRequest)`**
   - **Input**: Shop domain (e.g., "mystore.myshopify.com"), HTTP request
   - **Process**:
     ```
     1. Validate shop domain format
     2. Check if shop exists in our database
     3. Generate OAuth state parameter (CSRF protection)
     4. Construct authorization URL with:
        - client_id (from env)
        - scopes (read_orders, etc.)
        - redirect_uri (/api/auth/callback)
        - state (random token)
     5. Return authorization URL
     ```
   - **Output**: `{ success: true, redirectUrl: "https://..." }`

2. **`handleOAuthCallback(request: NextRequest)`**
   - **Input**: Callback request with code, shop, state params
   - **Process**:
     ```
     1. Verify state parameter (CSRF check)
     2. Exchange authorization code for access token
     3. Validate HMAC signature from Shopify
     4. Create session object:
        {
          id: unique_id,
          shop: shop_domain,
          accessToken: token,
          scope: granted_scopes,
          expires: expiry_timestamp,
          isOnline: false
        }
     5. Store session in sessionStorage
     6. Create webhook subscriptions
     7. Return session
     ```
   - **Output**: `{ success: true, session: Session }`

3. **`getSessionFromRequest(request: NextRequest)`**
   - **Input**: HTTP request with shop parameter
   - **Process**:
     ```
     1. Extract shop from query params or headers
     2. Query sessionStorage.findSessionsByShop(shop)
     3. Filter for active sessions (not expired)
     4. Validate scopes match required scopes
     5. Return most recent valid session
     ```
   - **Output**: `Session | null`

**Usage Example**:
```typescript
// In /api/auth/route.ts
const { shop } = request.nextUrl.searchParams
const result = await initiateOAuth(shop, request)
if (result.success) {
  return NextResponse.redirect(result.redirectUrl)
}

// In /api/auth/callback/route.ts
const result = await handleOAuthCallback(request)
if (result.success) {
  // Redirect to app home
  return NextResponse.redirect('/orders')
}

// In any protected API route
const session = await getSessionFromRequest(request)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### 2.2 Session Management Components

#### File: `lib/session.ts`

**Current Implementation**: In-memory storage (⚠️ for development only)

**Session Object Structure**:
```typescript
interface Session {
  id: string                    // Unique session ID
  shop: string                  // Shop domain
  state: string                 // OAuth state
  isOnline: boolean             // Online vs offline token
  scope: string                 // Granted scopes
  expires?: Date                // Expiration timestamp
  accessToken: string           // Shopify access token
  userId?: string               // Shop owner user ID
  firstName?: string            // Owner first name
  lastName?: string             // Owner last name
  email?: string                // Owner email
  accountOwner: boolean         // Is account owner
  locale?: string               // Shop locale
  collaborator: boolean         // Is collaborator
  emailVerified: boolean        // Email verified
}
```

**Key Methods**:

1. **`storeSession(session: Session): Promise<boolean>`**
   - Stores session in storage backend
   - Returns true if successful
   
2. **`loadSession(id: string): Promise<Session | undefined>`**
   - Loads session by ID
   - Returns session or undefined if not found
   
3. **`deleteSession(id: string): Promise<boolean>`**
   - Deletes session
   - Returns true if successful
   
4. **`findSessionsByShop(shop: string): Promise<Session[]>`**
   - Finds all sessions for a shop
   - Used for retrieving active shop sessions

**Production Implementation Needed**:
```typescript
import { PrismaClient } from '@prisma/client'

class DatabaseSessionStorage {
  private prisma = new PrismaClient()
  
  async storeSession(session: Session): Promise<boolean> {
    try {
      await this.prisma.session.upsert({
        where: { id: session.id },
        create: {
          id: session.id,
          shop: session.shop,
          accessToken: session.accessToken,
          scope: session.scope,
          expires: session.expires,
          isOnline: session.isOnline,
          userId: session.userId,
          // ... other fields
        },
        update: {
          accessToken: session.accessToken,
          expires: session.expires,
          // ... other fields
        }
      })
      return true
    } catch (error) {
      console.error('Failed to store session:', error)
      return false
    }
  }
  
  async loadSession(id: string): Promise<Session | undefined> {
    const session = await this.prisma.session.findUnique({
      where: { id }
    })
    
    if (!session) return undefined
    
    // Convert Prisma model to Session object
    return {
      id: session.id,
      shop: session.shop,
      accessToken: session.accessToken,
      // ... map all fields
    }
  }
  
  async findSessionsByShop(shop: string): Promise<Session[]> {
    const sessions = await this.prisma.session.findMany({
      where: { 
        shop,
        OR: [
          { expires: null },
          { expires: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return sessions.map(s => ({
      id: s.id,
      shop: s.shop,
      // ... map all fields
    }))
  }
}
```

---

### 2.3 Order Service Components

#### File: `lib/services/orderService.ts`

**Purpose**: Manages order operations with GST calculations

**Architecture**:
```
OrderService
    │
    ├──► OrderGraphQLService (fetches from Shopify)
    ├──► GSTService (calculates taxes)
    └──► Returns OrderWithGST
```

**Key Methods**:

1. **`getOrdersWithGST(session, options)`**
   
   **Flow**:
   ```
   Input: { limit: 50, cursor: null, status: 'paid' }
   
   Step 1: Build GraphQL query filter
   ├─ status → "financial_status:paid"
   ├─ dateFrom → "created_at:>='2024-01-01T00:00:00Z'"
   └─ dateTo → "created_at:<='2024-12-31T23:59:59Z'"
   
   Step 2: Execute GraphQL query
   ├─ orderGraphQLService.getOrders({
   │    first: 50,
   │    after: cursor,
   │    query: "financial_status:paid"
   │  })
   │
   └─ Returns: {
        data: [Order1, Order2, ...],
        pageInfo: {
          hasNextPage: true,
          endCursor: "eyJsYXN0X2..."
        }
      }
   
   Step 3: Transform & calculate GST
   ├─ For each order:
   │  ├─ Transform GraphQL format to internal format
   │  ├─ Extract customer state from address
   │  ├─ Compare with store state
   │  ├─ Calculate GST type (CGST/SGST or IGST)
   │  ├─ Apply GST rate (5% or 12%)
   │  └─ Add gstBreakdown field
   │
   └─ Returns OrderWithGST[]
   
   Output: {
     orders: [OrderWithGST, ...],
     hasNextPage: true,
     cursor: "eyJsYXN0X2..."
   }
   ```

2. **`getOrderById(session, orderId)`**
   
   **Flow**:
   ```
   Input: orderId = "gid://shopify/Order/123456"
   
   Step 1: Fetch single order
   └─ orderGraphQLService.getOrder(orderId)
   
   Step 2: Calculate GST
   ├─ gstService.addGSTToOrder(order)
   │  ├─ Get customer state
   │  ├─ Determine GST type
   │  ├─ Calculate amounts
   │  └─ Add HSN codes
   │
   └─ Return OrderWithGST
   
   Output: {
     ...order,
     gstBreakdown: {
       gstType: 'CGST_SGST',
       gstRate: 0.05,
       cgst: 42.50,
       sgst: 42.50,
       igst: 0,
       totalGST: 85.00,
       baseAmount: 850.00,
       totalAmount: 935.00,
       hsnCode: '6109'
     }
   }
   ```

3. **`getOrdersForBulkPrint(session, options)`**
   
   **Use Case**: Bulk PDF generation or CSV export
   
   **Flow**:
   ```
   Input: {
     dateFrom: Date('2024-01-01'),
     dateTo: Date('2024-01-31'),
     orderIds: ['123', '456'],  // optional
     includeGSTSummary: true
   }
   
   Step 1: Fetch orders
   ├─ If orderIds provided:
   │  └─ orderGraphQLService.getOrdersByIds(orderIds)
   │
   └─ Else if date range:
      └─ orderGraphQLService.getOrdersByDateRange(dateFrom, dateTo)
   
   Step 2: Calculate GST for all orders
   └─ gstService.addGSTToOrders(orders)
   
   Step 3: Generate GST summary (if requested)
   └─ gstService.createGSTSummary(orders)
      ├─ Total CGST: ₹1,250.00
      ├─ Total SGST: ₹1,250.00
      ├─ Total IGST: ₹3,450.00
      ├─ Total GST: ₹5,950.00
      ├─ Base Amount: ₹49,583.33
      └─ Total Amount: ₹55,533.33
   
   Output: {
     orders: OrderWithGST[],
     gstSummary: {...}
   }
   ```

---

### 2.4 GST Service Components

#### File: `lib/services/gstService.ts`

**Purpose**: Indian GST calculations and compliance

**GST Logic**:

```
┌─────────────────────────────────────────────────────────┐
│           GST CALCULATION DECISION TREE                  │
└─────────────────────────────────────────────────────────┘

              Is customer in same state as store?
                          │
            ┌─────────────┴─────────────┐
           YES                          NO
            │                            │
    ┌───────▼────────┐          ┌───────▼────────┐
    │  CGST + SGST   │          │      IGST      │
    │  (Intrastate)  │          │  (Interstate)  │
    └───────┬────────┘          └───────┬────────┘
            │                            │
    ┌───────▼────────┐          ┌───────▼────────┐
    │  Split 50/50   │          │   Full Amount  │
    │  CGST: 2.5%    │          │   IGST: 5%     │
    │  SGST: 2.5%    │          │   (below ₹1000)│
    │  (below ₹1000) │          │   or           │
    │  or            │          │   IGST: 12%    │
    │  CGST: 6%      │          │   (above ₹1000)│
    │  SGST: 6%      │          │                │
    │  (above ₹1000) │          │                │
    └────────────────┘          └────────────────┘
```

**Key Methods**:

1. **`addGSTToOrder(order: ShopifyOrder): OrderWithGST`**
   
   **Code Walkthrough**:
   ```typescript
   addGSTToOrder(order: ShopifyOrder): OrderWithGST {
     // Step 1: Get customer state
     const customerState = this.extractCustomerState(order)
     // From shipping address: order.shipping_address?.province
     // E.g., "Maharashtra", "Gujarat", etc.
     
     // Step 2: Determine GST type
     const gstType = this.determineGSTType(customerState, this.storeState)
     // If customerState === storeState → 'CGST_SGST'
     // Else → 'IGST'
     
     // Step 3: Get order total
     const baseAmount = parseFloat(order.subtotal_price)
     // E.g., ₹850.00
     
     // Step 4: Determine GST rate
     const gstRate = this.getGSTRate(baseAmount)
     // If baseAmount < 1000 → 0.05 (5%)
     // If baseAmount >= 1000 → 0.12 (12%)
     
     // Step 5: Calculate GST amounts
     const totalGST = baseAmount * gstRate
     // E.g., ₹850.00 * 0.05 = ₹42.50
     
     let cgst = 0, sgst = 0, igst = 0
     
     if (gstType === 'CGST_SGST') {
       cgst = totalGST / 2  // ₹21.25
       sgst = totalGST / 2  // ₹21.25
     } else {
       igst = totalGST      // ₹42.50
     }
     
     // Step 6: Get HSN code
     const hsnCode = this.getHSNCodeForTextiles(order.line_items[0])
     // Default: '6109' for T-shirts
     
     // Step 7: Construct result
     return {
       ...order,
       gstBreakdown: {
         gstType,
         gstRate,
         cgst,
         sgst,
         igst,
         totalGST,
         baseAmount,
         totalAmount: baseAmount + totalGST,
         hsnCode,
         customerState,
         storeState: this.storeState
       }
     }
   }
   ```

2. **`calculateLineItemGST(order: ShopifyOrder)`**
   
   **Purpose**: Per-item GST breakdown
   
   **Flow**:
   ```
   Input: Order with multiple line items
   
   For each line item:
   ├─ Extract item details:
   │  ├─ Product: "Cotton Round Neck T-Shirt"
   │  ├─ Variant: "M / Blue"
   │  ├─ Quantity: 2
   │  └─ Price: ₹450.00
   │
   ├─ Extract T-shirt details:
   │  ├─ Size: M
   │  ├─ Color: Blue
   │  ├─ Material: Cotton
   │  └─ HSN: 6109
   │
   ├─ Calculate GST:
   │  ├─ Base amount: ₹450.00 × 2 = ₹900.00
   │  ├─ GST rate: 5% (below ₹1000)
   │  ├─ GST type: CGST_SGST (same state)
   │  ├─ CGST: ₹22.50
   │  ├─ SGST: ₹22.50
   │  └─ Total: ₹945.00
   │
   └─ Return line item with GST breakdown
   
   Output: {
     lineItems: [
       {
         lineItem: {...},
         gstBreakdown: {...},
         tshirtDetails: {size, color, material}
       },
       ...
     ],
     orderTotal: {
       baseAmount: ₹900.00,
       totalGST: ₹45.00,
       totalAmount: ₹945.00
     }
   }
   ```

3. **`validateOrderForGST(order: ShopifyOrder)`**
   
   **Validation Rules**:
   ```typescript
   validateOrderForGST(order) {
     const errors = []
     
     // Must have shipping address
     if (!order.shipping_address) {
       errors.push('Missing shipping address')
     }
     
     // Must have state/province
     if (!order.shipping_address?.province) {
       errors.push('Missing customer state')
     }
     
     // Must have line items
     if (!order.line_items || order.line_items.length === 0) {
       errors.push('No line items found')
     }
     
     // Must have valid amounts
     if (parseFloat(order.total_price) <= 0) {
       errors.push('Invalid order total')
     }
     
     return {
       isValid: errors.length === 0,
       errors
     }
   }
   ```

---

### 2.5 PDF Service Components

#### File: `lib/services/pdfService.ts`

**Purpose**: Generate professional PDF invoices with GST

**PDF Generation Pipeline**:

```
┌─────────────────────────────────────────────────────────┐
│              PDF GENERATION PIPELINE                     │
└─────────────────────────────────────────────────────────┘

Step 1: Prepare Data
├─ Fetch order with GST
├─ Get template configuration
├─ Load business info (GSTIN, address)
└─ Get company logo

Step 2: Render HTML
├─ Load HTML template
├─ Inject order data
├─ Inject GST breakdown
├─ Inject business info
├─ Apply CSS styling
└─ Generate complete HTML

Step 3: Configure Puppeteer
├─ Launch headless browser
├─ Set page size (A4)
├─ Set margins
├─ Enable print background
└─ Set header/footer

Step 4: Generate PDF
├─ Load HTML in browser
├─ Wait for rendering
├─ Generate PDF buffer
└─ Close browser

Step 5: Save & Return
├─ Save to file storage
├─ Generate download URL
└─ Return file info
```

**Key Methods**:

1. **`generateOrderPDF(orderId, templateId, session)`**
   
   **Detailed Flow**:
   ```typescript
   async generateOrderPDF(orderId, templateId, session) {
     // STEP 1: Fetch data
     const order = await orderService.getOrderById(session, orderId)
     const template = await templateService.getTemplate(templateId)
     const businessInfo = await settingsService.getBusinessInfo(session.shop)
     
     // STEP 2: Prepare template data
     const templateData = {
       order: {
         number: order.order_number,
         date: formatDate(order.created_at),
         customer: {
           name: getCustomerFullName(order.customer),
           email: order.email,
           phone: order.phone,
           address: formatAddress(order.shipping_address)
         },
         items: order.line_items.map(item => ({
           name: item.name,
           sku: item.sku,
           quantity: item.quantity,
           price: formatCurrency(item.price),
           total: formatCurrency(parseFloat(item.price) * item.quantity)
         })),
         totals: {
           subtotal: formatCurrency(order.gstBreakdown.baseAmount),
           cgst: formatCurrency(order.gstBreakdown.cgst),
           sgst: formatCurrency(order.gstBreakdown.sgst),
           igst: formatCurrency(order.gstBreakdown.igst),
           total: formatCurrency(order.gstBreakdown.totalAmount)
         },
         gst: {
           type: order.gstBreakdown.gstType,
           rate: (order.gstBreakdown.gstRate * 100) + '%',
           hsnCode: order.gstBreakdown.hsnCode
         }
       },
       business: {
         name: businessInfo.name,
         gstin: businessInfo.gstin,
         address: businessInfo.address,
         phone: businessInfo.phone,
         email: businessInfo.email,
         logo: businessInfo.logo
       },
       template: {
         primaryColor: template.styling.primaryColor,
         fontFamily: template.styling.fontFamily
       }
     }
     
     // STEP 3: Render HTML
     const html = this.renderTemplate(template.html, templateData)
     
     // STEP 4: Launch Puppeteer
     const browser = await puppeteer.launch({
       headless: true,
       args: ['--no-sandbox', '--disable-setuid-sandbox']
     })
     
     const page = await browser.newPage()
     await page.setContent(html, { waitUntil: 'networkidle0' })
     
     // STEP 5: Generate PDF
     const pdf = await page.pdf({
       format: 'A4',
       printBackground: true,
       margin: {
         top: '20mm',
         right: '15mm',
         bottom: '20mm',
         left: '15mm'
       },
       displayHeaderFooter: true,
       headerTemplate: this.getHeaderTemplate(businessInfo),
       footerTemplate: this.getFooterTemplate(order)
     })
     
     await browser.close()
     
     // STEP 6: Save file
     const filename = `order-${order.order_number}-${Date.now()}.pdf`
     const filepath = await fileStorageService.saveFile(filename, pdf)
     
     // STEP 7: Return
     return {
       success: true,
       filepath,
       downloadUrl: `/api/print/download/${filename}`,
       filename,
       size: pdf.length
     }
   }
   ```

2. **`generateBulkPDF(orderIds, templateId, session)`**
   
   **Process**:
   ```
   Input: orderIds = ['123', '456', '789']
   
   Step 1: Generate individual PDFs
   ├─ For each orderId:
   │  ├─ Generate PDF
   │  ├─ Save to temp directory
   │  └─ Track progress (33%, 66%, 100%)
   │
   └─ Result: [pdf1.pdf, pdf2.pdf, pdf3.pdf]
   
   Step 2: Merge PDFs
   ├─ Use pdf-lib or similar
   ├─ Create master PDF document
   ├─ For each PDF:
   │  ├─ Load PDF
   │  ├─ Copy pages
   │  └─ Append to master
   │
   └─ Save merged PDF
   
   Step 3: Cleanup
   ├─ Delete temporary individual PDFs
   └─ Return merged PDF
   
   Output: {
     success: true,
     filepath: '/uploads/bulk-123456.pdf',
     orderCount: 3,
     size: 1234567
   }
   ```

---

### 2.6 CSV Export Service

#### File: `lib/services/csvExportService.ts`

**Purpose**: Export orders to CSV with GST breakdown

**CSV Format**:
```csv
Order Number,Date,Customer Name,Customer Email,Customer Phone,Shipping Address,Product,SKU,Quantity,Unit Price,Line Total,Base Amount,CGST,SGST,IGST,Total GST,Total Amount,HSN Code,GST Rate,Payment Status
#1001,2024-01-15,John Doe,john@example.com,+91-9876543210,"123 Street, Mumbai, MH 400001","Cotton T-Shirt - M / Blue",TSH-001-M-BLU,2,425.00,850.00,850.00,21.25,21.25,0.00,42.50,892.50,6109,5%,paid
#1002,2024-01-15,Jane Smith,jane@example.com,+91-9876543211,"456 Road, Delhi, DL 110001","Printed T-Shirt - L / Red",TSH-002-L-RED,1,1200.00,1200.00,1200.00,0.00,0.00,144.00,144.00,1344.00,6109,12%,paid
```

**Key Method**:

```typescript
async generateCSV(options: {
  dateFrom: Date,
  dateTo: Date,
  shop: string,
  session: Session
}) {
  // Step 1: Fetch orders
  const { orders } = await orderService.getOrdersForBulkPrint(session, {
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    includeGSTSummary: true
  })
  
  // Step 2: Define CSV structure
  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'orderNumber', title: 'Order Number' },
      { id: 'date', title: 'Date' },
      { id: 'customerName', title: 'Customer Name' },
      { id: 'customerEmail', title: 'Customer Email' },
      { id: 'customerPhone', title: 'Customer Phone' },
      { id: 'shippingAddress', title: 'Shipping Address' },
      { id: 'product', title: 'Product' },
      { id: 'sku', title: 'SKU' },
      { id: 'quantity', title: 'Quantity' },
      { id: 'unitPrice', title: 'Unit Price' },
      { id: 'lineTotal', title: 'Line Total' },
      { id: 'baseAmount', title: 'Base Amount' },
      { id: 'cgst', title: 'CGST' },
      { id: 'sgst', title: 'SGST' },
      { id: 'igst', title: 'IGST' },
      { id: 'totalGST', title: 'Total GST' },
      { id: 'totalAmount', title: 'Total Amount' },
      { id: 'hsnCode', title: 'HSN Code' },
      { id: 'gstRate', title: 'GST Rate' },
      { id: 'paymentStatus', title: 'Payment Status' }
    ]
  })
  
  // Step 3: Transform orders to CSV rows
  const records = []
  
  for (const order of orders) {
    // One row per line item
    for (const item of order.line_items) {
      records.push({
        orderNumber: `#${order.order_number}`,
        date: formatDate(order.created_at, 'YYYY-MM-DD'),
        customerName: getCustomerFullName(order.customer),
        customerEmail: order.email || '',
        customerPhone: order.phone || '',
        shippingAddress: formatAddress(order.shipping_address),
        product: item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: (parseFloat(item.price) * item.quantity).toFixed(2),
        baseAmount: order.gstBreakdown.baseAmount.toFixed(2),
        cgst: order.gstBreakdown.cgst.toFixed(2),
        sgst: order.gstBreakdown.sgst.toFixed(2),
        igst: order.gstBreakdown.igst.toFixed(2),
        totalGST: order.gstBreakdown.totalGST.toFixed(2),
        totalAmount: order.gstBreakdown.totalAmount.toFixed(2),
        hsnCode: order.gstBreakdown.hsnCode,
        gstRate: `${(order.gstBreakdown.gstRate * 100).toFixed(0)}%`,
        paymentStatus: order.financial_status
      })
    }
  }
  
  // Step 4: Write CSV
  await csvWriter.writeRecords(records)
  
  // Step 5: Return file info
  return {
    success: true,
    filepath,
    filename,
    recordCount: records.length,
    orderCount: orders.length,
    downloadUrl: `/api/export/download/${filename}`
  }
}
```

---

## 3. Data Flow Diagrams

### 3.1 Complete Order Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│                  ORDER LIFECYCLE                         │
└──────────────────────────────────────────────────────────┘

1. Customer places order on Shopify store
        ↓
   [Shopify sends webhook: orders/create]
        ↓
2. App receives webhook: POST /api/webhooks/orders
        ↓
   [Webhook handler processes event]
        ↓
   - Verify webhook signature
   - Log to webhook_logs table
   - Invalidate order cache
   - Send 200 OK response
        ↓
3. Merchant opens app and views orders
        ↓
   [GET /api/orders]
        ↓
   - Validate session
   - Fetch orders from Shopify GraphQL
   - Calculate GST for each order
   - Return orders with GST breakdown
        ↓
4. Merchant clicks "Print" on an order
        ↓
   [POST /api/print { orderId, templateId }]
        ↓
   - Validate session
   - Fetch order with GST
   - Load template
   - Generate HTML
   - Create PDF with Puppeteer
   - Save to file storage
   - Return download URL
        ↓
5. Merchant downloads PDF
        ↓
   [GET /api/print/download/:fileKey]
        ↓
   - Validate session
   - Check file exists
   - Stream file to browser
   - Log download
        ↓
6. (Optional) Merchant exports to CSV
        ↓
   [POST /api/export/csv { dateFrom, dateTo }]
        ↓
   - Validate session
   - Fetch orders in date range
   - Calculate GST
   - Generate CSV
   - Save to file storage
   - Return download URL
        ↓
7. (Scheduled) Cleanup old files
        ↓
   [Cron job: dataCleanupService]
        ↓
   - Find files older than 30 days
   - Delete files
   - Log cleanup activity
```

---

### 3.2 Webhook Processing Flow

```
┌──────────────────────────────────────────────────────────┐
│            WEBHOOK PROCESSING FLOW                       │
└──────────────────────────────────────────────────────────┘

Shopify triggers event (e.g., order created)
        ↓
Shopify sends POST to /api/webhooks/orders
        ↓
┌───────────────────────────────────────┐
│  Webhook Signature Verification       │
│  ├─ Extract X-Shopify-Hmac-Sha256     │
│  ├─ Calculate expected HMAC           │
│  ├─ Compare signatures                │
│  └─ Reject if invalid                 │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Parse Webhook Payload                │
│  ├─ Extract shop domain               │
│  ├─ Extract webhook topic             │
│  ├─ Parse JSON body                   │
│  └─ Extract order/data                │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Log Webhook to Database              │
│  INSERT INTO webhook_logs             │
│  (shop, topic, payload, status)       │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Route to Topic Handler               │
│  ├─ orders/create → handleOrderCreate │
│  ├─ orders/updated → handleOrderUpdate│
│  ├─ orders/paid → handleOrderPaid     │
│  └─ app/uninstalled → handleUninstall │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Process Webhook                      │
│  ├─ Update cache                      │
│  ├─ Trigger notifications             │
│  ├─ Update database                   │
│  └─ Execute business logic            │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Return 200 OK to Shopify             │
│  (Must respond within 5 seconds)      │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  Background Processing (if needed)    │
│  ├─ Send emails                       │
│  ├─ Generate reports                  │
│  └─ Update analytics                  │
└───────────────────────────────────────┘
```

---

## 4. API Endpoints Reference

### Authentication Endpoints

#### `GET /api/auth`
**Purpose**: Initiate OAuth flow

**Parameters**:
- `shop` (query, required): Shop domain (e.g., "mystore.myshopify.com")

**Response**:
- 302 Redirect to Shopify authorization page

**Example**:
```
GET /api/auth?shop=mystore.myshopify.com

→ 302 https://mystore.myshopify.com/admin/oauth/authorize?
     client_id=abc123&
     scope=read_orders,write_files&
     redirect_uri=https://myapp.com/api/auth/callback&
     state=random_state_token
```

---

#### `GET /api/auth/callback`
**Purpose**: Handle OAuth callback

**Parameters**:
- `shop` (query, required): Shop domain
- `code` (query, required): Authorization code
- `state` (query, required): State token
- `hmac` (query, required): HMAC signature

**Response**:
```json
{
  "success": true,
  "session": {
    "shop": "mystore.myshopify.com",
    "accessToken": "shpat_...",
    "scope": "read_orders,write_files"
  }
}
```

**Example**:
```
GET /api/auth/callback?
    shop=mystore.myshopify.com&
    code=abc123&
    state=xyz789&
    hmac=signature

→ Create session
→ 302 /orders
```

---

### Order Endpoints

#### `GET /api/orders`
**Purpose**: Fetch orders with GST breakdown

**Authentication**: Required (session)

**Parameters**:
- `shop` (query, required): Shop domain
- `limit` (query, optional): Number of orders (default: 50)
- `cursor` (query, optional): Pagination cursor
- `status` (query, optional): Financial status filter

**Response**:
```json
{
  "orders": [
    {
      "id": "gid://shopify/Order/123",
      "order_number": 1001,
      "created_at": "2024-01-15T10:30:00Z",
      "customer": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "total_price": "935.00",
      "gstBreakdown": {
        "gstType": "CGST_SGST",
        "gstRate": 0.05,
        "cgst": 21.25,
        "sgst": 21.25,
        "igst": 0,
        "totalGST": 42.50,
        "baseAmount": 850.00,
        "totalAmount": 892.50,
        "hsnCode": "6109",
        "customerState": "Gujarat",
        "storeState": "Gujarat"
      }
    }
  ],
  "hasNextPage": true,
  "cursor": "eyJsYXN0X2lkIjoiMTIzIn0="
}
```

---

#### `GET /api/orders/[id]`
**Purpose**: Fetch single order with GST

**Authentication**: Required

**Parameters**:
- `id` (path, required): Order ID
- `shop` (query, required): Shop domain

**Response**:
```json
{
  "order": {
    "id": "gid://shopify/Order/123",
    "order_number": 1001,
    "line_items": [...],
    "gstBreakdown": {...}
  }
}
```

---

### Print Endpoints

#### `POST /api/print`
**Purpose**: Generate PDF for single order

**Authentication**: Required

**Request Body**:
```json
{
  "orderId": "gid://shopify/Order/123",
  "templateId": "default",
  "shop": "mystore.myshopify.com"
}
```

**Response**:
```json
{
  "success": true,
  "filepath": "/uploads/order-1001-1234567890.pdf",
  "filename": "order-1001-1234567890.pdf",
  "downloadUrl": "/api/print/download/order-1001-1234567890.pdf",
  "size": 125678
}
```

---

#### `POST /api/print/bulk`
**Purpose**: Generate bulk PDF for multiple orders

**Authentication**: Required

**Request Body**:
```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "templateId": "default",
  "shop": "mystore.myshopify.com"
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "job-1234567890",
  "status": "pending",
  "message": "Bulk print job created"
}
```

---

#### `GET /api/print/jobs/[jobId]`
**Purpose**: Check bulk print job status

**Authentication**: Required

**Response**:
```json
{
  "job": {
    "id": "job-1234567890",
    "status": "processing",
    "progress": 65,
    "orderCount": 100,
    "processedCount": 65,
    "filepath": null,
    "error": null
  }
}
```

When complete:
```json
{
  "job": {
    "id": "job-1234567890",
    "status": "completed",
    "progress": 100,
    "orderCount": 100,
    "processedCount": 100,
    "filepath": "/uploads/bulk-1234567890.pdf",
    "downloadUrl": "/api/print/download/bulk-1234567890.pdf",
    "error": null
  }
}
```

---

### Export Endpoints

#### `POST /api/export/csv`
**Purpose**: Export orders to CSV

**Authentication**: Required

**Request Body**:
```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "shop": "mystore.myshopify.com"
}
```

**Response**:
```json
{
  "success": true,
  "filepath": "/uploads/orders-2024-01.csv",
  "filename": "orders-2024-01.csv",
  "downloadUrl": "/api/export/download/orders-2024-01.csv",
  "recordCount": 250,
  "orderCount": 100,
  "size": 45678
}
```

---

### Template Endpoints

#### `GET /api/templates`
**Purpose**: List all templates

**Authentication**: Required

**Response**:
```json
{
  "templates": [
    {
      "id": "default",
      "name": "Default Template",
      "isDefault": true,
      "preview": "/previews/default.png"
    },
    {
      "id": "custom-1",
      "name": "Custom Template",
      "isDefault": false,
      "preview": "/previews/custom-1.png"
    }
  ]
}
```

---

#### `POST /api/templates`
**Purpose**: Create new template

**Authentication**: Required

**Request Body**:
```json
{
  "name": "My Template",
  "layoutConfig": {
    "showLogo": true,
    "showCustomerDetails": true,
    "showGSTBreakdown": true
  },
  "styling": {
    "primaryColor": "#5C6AC4",
    "fontFamily": "Arial",
    "fontSize": 12
  }
}
```

**Response**:
```json
{
  "success": true,
  "template": {
    "id": "template-123",
    "name": "My Template",
    ...
  }
}
```

---

### Settings Endpoints

#### `GET /api/settings`
**Purpose**: Get app settings

**Authentication**: Required

**Response**:
```json
{
  "settings": {
    "storeState": "Gujarat",
    "gstin": "24AAAAA0000A1Z5",
    "businessName": "My T-Shirt Store",
    "businessAddress": "123 Street, City, State",
    "gstRateBelow1000": 0.05,
    "gstRateAbove1000": 0.12,
    "defaultTemplateId": "default"
  }
}
```

---

#### `PUT /api/settings`
**Purpose**: Update app settings

**Authentication**: Required

**Request Body**:
```json
{
  "storeState": "Maharashtra",
  "gstin": "27AAAAA0000A1Z5",
  "gstRateBelow1000": 0.05,
  "gstRateAbove1000": 0.12
}
```

**Response**:
```json
{
  "success": true,
  "settings": {...}
}
```

---

### Webhook Endpoints

#### `POST /api/webhooks/orders`
**Purpose**: Handle order webhooks

**Headers**:
- `X-Shopify-Topic`: Webhook topic (e.g., "orders/create")
- `X-Shopify-Hmac-Sha256`: HMAC signature
- `X-Shopify-Shop-Domain`: Shop domain

**Body**: Shopify order object

**Response**:
```json
{ "success": true }
```

---

#### `POST /api/webhooks/app/uninstalled`
**Purpose**: Handle app uninstallation

**Response**:
```json
{ "success": true }
```

---

## 5. Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  state VARCHAR(255),
  isOnline BOOLEAN DEFAULT FALSE,
  scope VARCHAR(1000),
  expires TIMESTAMP,
  accessToken VARCHAR(255),
  userId VARCHAR(255),
  firstName VARCHAR(255),
  lastName VARCHAR(255),
  email VARCHAR(255),
  accountOwner BOOLEAN DEFAULT FALSE,
  locale VARCHAR(10),
  collaborator BOOLEAN DEFAULT FALSE,
  emailVerified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sessions_shop (shop),
  INDEX idx_sessions_expires (expires)
);
```

**Purpose**: Store Shopify OAuth sessions
**Relationships**: None
**Access Pattern**: Find by shop, check expiration

---

### App Settings Table
```sql
CREATE TABLE app_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop VARCHAR(255) NOT NULL UNIQUE,
  store_state VARCHAR(100) DEFAULT 'Gujarat',
  gstin VARCHAR(15),
  business_name VARCHAR(255),
  business_address TEXT,
  business_phone VARCHAR(20),
  business_email VARCHAR(255),
  gst_rate_below_1000 DECIMAL(4,3) DEFAULT 0.050,
  gst_rate_above_1000 DECIMAL(4,3) DEFAULT 0.120,
  default_template_id VARCHAR(255),
  settings_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Purpose**: Store per-shop app configuration
**Relationships**: One-to-one with shop
**Access Pattern**: Find by shop

---

### Templates Table
```sql
CREATE TABLE templates (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  layout_config JSON,
  business_info JSON,
  styling_config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_templates_shop (shop),
  INDEX idx_templates_default (shop, is_default)
);
```

**Purpose**: Store custom PDF templates
**Relationships**: Many-to-one with shop
**Access Pattern**: Find by shop, filter by default

---

### Print Jobs Table
```sql
CREATE TABLE print_jobs (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  job_type ENUM('pdf', 'csv') NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  order_ids JSON,
  date_range_start DATE,
  date_range_end DATE,
  file_path VARCHAR(500),
  file_size BIGINT,
  error_message TEXT,
  progress_percentage INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_print_jobs_shop (shop),
  INDEX idx_print_jobs_status (status),
  INDEX idx_print_jobs_created (created_at)
);
```

**Purpose**: Track bulk print/export jobs
**Relationships**: Many-to-one with shop
**Access Pattern**: Find by shop and status, order by created_at

---

### Webhook Logs Table
```sql
CREATE TABLE webhook_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  webhook_id VARCHAR(255),
  payload JSON,
  headers JSON,
  status ENUM('received', 'processed', 'failed') DEFAULT 'received',
  error_message TEXT,
  processing_time_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  INDEX idx_webhook_logs_shop (shop),
  INDEX idx_webhook_logs_topic (topic),
  INDEX idx_webhook_logs_status (status),
  INDEX idx_webhook_logs_created (created_at)
);
```

**Purpose**: Log webhook deliveries for debugging
**Relationships**: Many-to-one with shop
**Access Pattern**: Find recent by shop, filter by topic/status

---

## 6. Service Layer Details

### Service Responsibilities

```
OrderService
├─ Fetches orders from Shopify
├─ Orchestrates GST calculations
├─ Provides filtered/paginated results
└─ Validates order data

GSTService
├─ Determines GST type (CGST/SGST vs IGST)
├─ Calculates GST rates and amounts
├─ Assigns HSN codes
└─ Validates GST requirements

PDFService
├─ Renders HTML templates
├─ Generates PDFs with Puppeteer
├─ Manages PDF options (size, format)
└─ Handles file storage

CSVExportService
├─ Formats order data for CSV
├─ Generates CSV files
├─ Handles column mappings
└─ Manages file storage

TemplateService
├─ CRUD operations for templates
├─ Manages default templates
├─ Validates template structure
└─ Provides template previews

BulkPrintService
├─ Creates background jobs
├─ Manages job queue
├─ Tracks progress
├─ Merges multiple PDFs
└─ Handles failures and retries

WebhookService
├─ Verifies webhook signatures
├─ Routes to topic handlers
├─ Logs webhook events
└─ Manages webhook subscriptions

FileStorageService
├─ Saves generated files
├─ Manages file paths
├─ Handles file cleanup
└─ Generates download URLs

GraphQLClient
├─ Manages Shopify API connection
├─ Handles authentication
├─ Executes GraphQL queries
└─ Handles rate limiting
```

---

## 7. Frontend Architecture

### Component Hierarchy

```
App
└─ AppProvider (Context)
    └─ PolarisProvider (UI Framework)
        └─ AppBridgeProvider (Shopify Integration)
            └─ QueryProvider (Data Fetching)
                └─ AppLayout
                    ├─ AppNavigation
                    │   ├─ Orders Link
                    │   ├─ Templates Link
                    │   ├─ Bulk Print Link
                    │   └─ Settings Link
                    │
                    └─ Route Content
                        ├─ /orders
                        │   └─ OrdersList
                        │       ├─ OrdersFilters
                        │       ├─ OrdersTable
                        │       └─ OrderDetail (modal)
                        │           ├─ CustomerInfo
                        │           ├─ LineItems
                        │           ├─ GSTBreakdown
                        │           └─ PrintButton
                        │
                        ├─ /templates
                        │   └─ TemplatesList
                        │       ├─ TemplateCard[]
                        │       └─ TemplateEditor (modal)
                        │           ├─ LayoutConfig
                        │           ├─ StylingOptions
                        │           └─ Preview
                        │
                        ├─ /bulk-print
                        │   └─ BulkPrintInterface
                        │       ├─ DateRangePicker
                        │       ├─ TemplateSelector
                        │       ├─ GenerateButton
                        │       └─ JobsList
                        │           └─ JobStatus[]
                        │
                        └─ /settings
                            └─ AppSettings
                                ├─ GSTSettings
                                ├─ BusinessInfo
                                └─ SaveButton
```

### Custom Hooks

```typescript
// hooks/useOrders.ts
export function useOrders(options) {
  return useQuery({
    queryKey: ['orders', options],
    queryFn: () => fetchOrders(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// hooks/usePrint.ts
export function usePrint() {
  return useMutation({
    mutationFn: (data) => printOrder(data),
    onSuccess: () => {
      showToast('PDF generated successfully')
    },
    onError: (error) => {
      showToast(error.message, { error: true })
    }
  })
}

// hooks/useSettings.ts
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries(['settings'])
      showToast('Settings saved')
    }
  })
}
```

---

## 8. State Management

### React Query Cache Structure

```
React Query Cache
├─ orders
│   ├─ ['orders', { limit: 50, status: 'paid' }]
│   ├─ ['orders', { limit: 50, cursor: 'abc123' }]
│   └─ ['order', 'gid://shopify/Order/123']
│
├─ templates
│   ├─ ['templates']
│   └─ ['template', 'template-123']
│
├─ settings
│   └─ ['settings']
│
├─ jobs
│   ├─ ['jobs']
│   └─ ['job', 'job-123']
│
└─ businessInfo
    └─ ['businessInfo']
```

### Cache Invalidation Strategy

```typescript
// On successful order print
queryClient.invalidateQueries(['order', orderId])

// On successful settings update
queryClient.invalidateQueries(['settings'])

// On webhook received (orders/updated)
queryClient.invalidateQueries(['orders'])

// On successful template creation
queryClient.invalidateQueries(['templates'])

// On successful bulk job completion
queryClient.invalidateQueries(['jobs'])
queryClient.invalidateQueries(['orders']) // May affect order list
```

---

## 9. Error Handling Patterns

### API Route Error Handling

```typescript
// app/api/orders/route.ts
export async function GET(request: NextRequest) {
  try {
    // Step 1: Validate session
    const session = await getSessionFromRequest(request)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }
    
    // Step 2: Validate input
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    if (limit < 1 || limit > 250) {
      return NextResponse.json(
        { error: 'Invalid limit', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    // Step 3: Execute operation
    const result = await getOrdersWithGST(session, { limit })
    
    return NextResponse.json(result)
    
  } catch (error) {
    // Log error
    console.error('Orders fetch error:', error)
    
    // Send to Sentry (in production)
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error)
    }
    
    // Return generic error
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders',
        code: 'INTERNAL_ERROR',
        message: error.message
      },
      { status: 500 }
    )
  }
}
```

### Frontend Error Handling

```typescript
// components/orders/OrdersList.tsx
function OrdersList() {
  const { data, isLoading, isError, error } = useOrders()
  
  if (isLoading) {
    return <Spinner />
  }
  
  if (isError) {
    return (
      <Banner status="critical">
        <p>Failed to load orders: {error.message}</p>
        <Button onClick={() => refetch()}>
          Retry
        </Button>
      </Banner>
    )
  }
  
  return (
    <DataTable data={data.orders} />
  )
}
```

---

## 10. Security Architecture

### Authentication Security

```
┌─────────────────────────────────────────────────────────┐
│            SECURITY LAYERS                               │
└─────────────────────────────────────────────────────────┘

Layer 1: OAuth 2.0
├─ Shopify-managed authentication
├─ HMAC signature verification
├─ State parameter for CSRF protection
└─ Secure token storage

Layer 2: Session Management
├─ Secure session cookies (httpOnly, secure)
├─ Session expiration
├─ Session validation on each request
└─ Session revocation on logout

Layer 3: API Authorization
├─ Shop verification
├─ Scope validation
├─ Rate limiting
└─ Request validation

Layer 4: Data Protection
├─ Encrypted database connections
├─ Secure file storage
├─ HTTPS-only communication
└─ Secret management

Layer 5: Webhook Security
├─ HMAC signature verification
├─ Timestamp validation
├─ IP whitelist (optional)
└─ Replay attack prevention
```

### Webhook Signature Verification

```typescript
function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
  
  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(signature)
  )
}
```

---

## Conclusion

This architecture document provides a comprehensive view of the Shopify Order Printer application's structure, data flows, and implementation details. Use this as a reference when:

1. **Understanding Code**: Navigate the codebase efficiently
2. **Debugging Issues**: Trace data flow and identify problem areas
3. **Adding Features**: Understand where new code fits
4. **Onboarding**: Help new developers understand the system
5. **Deployment**: Understand dependencies and requirements

For implementation guidance, refer to the **IMPLEMENTATION_PLAN.md** document.

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-23  
**Status**: Complete

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  TextField,
  InlineStack,
  BlockStack,
  Text,
  Pagination,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;
  
  // Build GraphQL query with search
  let queryFilter = "";
  if (searchQuery) {
    queryFilter = `query: "${searchQuery}"`;
  }

  const response = await admin.graphql(
    `#graphql
      query getOrders($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                displayName
                email
              }
              shippingAddress {
                province
              }
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `,
    {
      variables: {
        first: limit,
        query: searchQuery || null,
      },
    }
  );

  const {
    data: { orders },
  } = await response.json();

  return json({
    orders: orders.edges,
    pageInfo: orders.pageInfo,
    searchQuery,
    shop: session.shop,
  });
};

export default function Orders() {
  const { orders, pageInfo, searchQuery, shop } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(searchQuery);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    setSearchParams(params);
  }, [search, setSearchParams]);

  const handleClearSearch = useCallback(() => {
    setSearch("");
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const rows = orders.map(({ node }: any) => {
    const orderId = node.id.split("/").pop();
    const statusBadge = (
      <Badge tone={node.displayFulfillmentStatus === "FULFILLED" ? "success" : "attention"}>
        {node.displayFulfillmentStatus}
      </Badge>
    );
    const paymentBadge = (
      <Badge tone={node.displayFinancialStatus === "PAID" ? "success" : "warning"}>
        {node.displayFinancialStatus}
      </Badge>
    );

    return [
      <Link to={`/app/orders/${orderId}`} style={{ color: "#2c6ecb", textDecoration: "none" }}>
        {node.name}
      </Link>,
      node.customer?.displayName || "Guest",
      node.customer?.email || "-",
      node.shippingAddress?.province || "-",
      `₹${parseFloat(node.totalPriceSet.shopMoney.amount).toFixed(2)}`,
      statusBadge,
      paymentBadge,
      new Date(node.createdAt).toLocaleDateString("en-IN"),
      <Button
        size="slim"
        onClick={() => navigate(`/app/orders/${orderId}/print`)}
      >
        Print Invoice
      </Button>,
    ];
  });

  return (
    <Page
      title="Orders"
      subtitle={`Manage and print invoices for ${shop}`}
      primaryAction={{
        content: "Bulk Print",
        onAction: () => navigate("/app/bulk-print"),
      }}
    >
      <BlockStack gap="400">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="300" align="space-between">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      value={search}
                      onChange={handleSearchChange}
                      placeholder="Search by order number, customer name, email..."
                      autoComplete="off"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleSearch();
                      }}
                    />
                  </div>
                  <Button onClick={handleSearch}>Search</Button>
                  {searchQuery && (
                    <Button onClick={handleClearSearch}>Clear</Button>
                  )}
                </InlineStack>

                {searchQuery && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Showing results for: <strong>{searchQuery}</strong>
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card padding="0">
              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Order",
                  "Customer",
                  "Email",
                  "State",
                  "Amount",
                  "Fulfillment",
                  "Payment",
                  "Date",
                  "Actions",
                ]}
                rows={rows}
                footerContent={
                  <div style={{ padding: "16px", textAlign: "center" }}>
                    {orders.length === 0 ? (
                      <Text as="p" variant="bodyMd">
                        No orders found. {searchQuery && "Try a different search term."}
                      </Text>
                    ) : (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Showing {orders.length} orders
                      </Text>
                    )}
                  </div>
                }
              />
            </Card>
          </Layout.Section>

          {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
            <Layout.Section>
              <Card>
                <InlineStack align="center">
                  <Pagination
                    hasPrevious={pageInfo.hasPreviousPage}
                    hasNext={pageInfo.hasNextPage}
                    onPrevious={() => {
                      // Implement pagination
                    }}
                    onNext={() => {
                      // Implement pagination
                    }}
                  />
                </InlineStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}

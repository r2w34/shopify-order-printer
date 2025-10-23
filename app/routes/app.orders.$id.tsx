import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Divider,
  Box,
} from "@shopify/polaris";
import { calculateGST } from "../utils/gstCalculator";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const orderId = params.id;

  const response = await admin.graphql(
    `#graphql
      query getOrder($id: ID!) {
        order(id: $id) {
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
          subtotalPriceSet {
            shopMoney {
              amount
            }
          }
          totalTaxSet {
            shopMoney {
              amount
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
            }
          }
          customer {
            displayName
            email
            phone
          }
          shippingAddress {
            address1
            address2
            city
            province
            provinceCode
            zip
            country
          }
          billingAddress {
            address1
            address2
            city
            province
            provinceCode
            zip
            country
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                  }
                }
                variant {
                  sku
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: `gid://shopify/Order/${orderId}`,
      },
    }
  );

  const { data } = await response.json();
  
  if (!data?.order) {
    throw new Response("Order not found", { status: 404 });
  }

  // Calculate GST
  const storeState = "Gujarat"; // Get from settings
  const customerState = data.order.shippingAddress?.province || "Gujarat";
  
  const gstCalculation = calculateGST({
    subtotal: parseFloat(data.order.subtotalPriceSet.shopMoney.amount),
    shipping: parseFloat(data.order.totalShippingPriceSet.shopMoney.amount),
    storeState,
    customerState,
    gstRate: 0.18, // Get from settings
  });

  return json({
    order: data.order,
    gstCalculation,
    shop: session.shop,
  });
};

export default function OrderDetail() {
  const { order, gstCalculation, shop } = useLoaderData<typeof loader>();

  return (
    <Page
      title={`Order ${order.name}`}
      backAction={{ content: "Orders", url: "/app/orders" }}
      primaryAction={{
        content: "Print Invoice",
        onAction: () => {
          // Implement print
          window.open(`/app/orders/${order.id.split("/").pop()}/print`, "_blank");
        },
      }}
      secondaryActions={[
        {
          content: "Download PDF",
          onAction: () => {
            // Implement download
          },
        },
        {
          content: "Email Invoice",
          onAction: () => {
            // Implement email
          },
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Order Details
                </Text>
                <InlineStack gap="200">
                  <Badge
                    tone={
                      order.displayFulfillmentStatus === "FULFILLED"
                        ? "success"
                        : "attention"
                    }
                  >
                    {order.displayFulfillmentStatus}
                  </Badge>
                  <Badge
                    tone={
                      order.displayFinancialStatus === "PAID" ? "success" : "warning"
                    }
                  >
                    {order.displayFinancialStatus}
                  </Badge>
                </InlineStack>
              </InlineStack>

              <Divider />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>Order Date:</strong>{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Customer:</strong> {order.customer?.displayName || "Guest"}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Email:</strong> {order.customer?.email || "-"}
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>Phone:</strong> {order.customer?.phone || "-"}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Shipping Address
                </Text>
                {order.shippingAddress && (
                  <BlockStack gap="100">
                    <Text as="p" variant="bodyMd">
                      {order.shippingAddress.address1}
                    </Text>
                    {order.shippingAddress.address2 && (
                      <Text as="p" variant="bodyMd">
                        {order.shippingAddress.address2}
                      </Text>
                    )}
                    <Text as="p" variant="bodyMd">
                      {order.shippingAddress.city}, {order.shippingAddress.province}{" "}
                      {order.shippingAddress.zip}
                    </Text>
                    <Text as="p" variant="bodyMd">
                      {order.shippingAddress.country}
                    </Text>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  GST Calculation
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd">
                      Subtotal:
                    </Text>
                    <Text as="p" variant="bodyMd">
                      ₹{gstCalculation.subtotal.toFixed(2)}
                    </Text>
                  </InlineStack>
                  
                  {gstCalculation.isInterstate ? (
                    <InlineStack align="space-between">
                      <Text as="p" variant="bodyMd">
                        IGST (18%):
                      </Text>
                      <Text as="p" variant="bodyMd">
                        ₹{gstCalculation.igst.toFixed(2)}
                      </Text>
                    </InlineStack>
                  ) : (
                    <>
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodyMd">
                          CGST (9%):
                        </Text>
                        <Text as="p" variant="bodyMd">
                          ₹{gstCalculation.cgst.toFixed(2)}
                        </Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="p" variant="bodyMd">
                          SGST (9%):
                        </Text>
                        <Text as="p" variant="bodyMd">
                          ₹{gstCalculation.sgst.toFixed(2)}
                        </Text>
                      </InlineStack>
                    </>
                  )}

                  <Divider />

                  <InlineStack align="space-between">
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      Total:
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="bold">
                      ₹{gstCalculation.total.toFixed(2)}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Line Items
              </Text>

              <Box>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                      <th style={{ textAlign: "left", padding: "12px" }}>Item</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>SKU</th>
                      <th style={{ textAlign: "center", padding: "12px" }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Price</th>
                      <th style={{ textAlign: "right", padding: "12px" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lineItems.edges.map(({ node }: any) => (
                      <tr key={node.id} style={{ borderBottom: "1px solid #f1f2f3" }}>
                        <td style={{ padding: "12px" }}>{node.title}</td>
                        <td style={{ padding: "12px" }}>{node.variant?.sku || "-"}</td>
                        <td style={{ textAlign: "center", padding: "12px" }}>
                          {node.quantity}
                        </td>
                        <td style={{ textAlign: "right", padding: "12px" }}>
                          ₹{parseFloat(node.originalUnitPriceSet.shopMoney.amount).toFixed(2)}
                        </td>
                        <td style={{ textAlign: "right", padding: "12px" }}>
                          ₹{parseFloat(node.discountedTotalSet.shopMoney.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

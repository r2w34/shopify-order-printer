import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Banner,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch recent orders count
  const response = await admin.graphql(
    `#graphql
      query {
        orders(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }`
  );

  const {
    data: { orders },
  } = await response.json();

  return json({
    shop: session.shop,
    hasOrders: orders.edges.length > 0,
  });
};

export default function Index() {
  const { shop, hasOrders } = useLoaderData<typeof loader>();

  return (
    <Page title="LetsPrint - Order Printer">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Welcome to LetsPrint! 🎉
                </Text>
                <Text as="p" variant="bodyMd">
                  Your GST-compliant order printing solution for Indian Shopify stores.
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Connected store: <strong>{shop}</strong>
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Quick Actions
                </Text>
                
                <InlineStack gap="300">
                  <Link to="/app/orders">
                    <Button>View Orders</Button>
                  </Link>
                  
                  <Link to="/app/settings">
                    <Button>Configure Settings</Button>
                  </Link>
                  
                  <Link to="/app/templates">
                    <Button>Manage Templates</Button>
                  </Link>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Features
                </Text>
                
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    ✓ GST calculation (CGST, SGST, IGST)
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ PDF invoice generation
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ CSV export for bulk orders
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Custom templates
                  </Text>
                  <Text as="p" variant="bodyMd">
                    ✓ Bulk print operations
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {!hasOrders && (
            <Layout.Section>
              <Banner tone="info">
                <p>
                  You don't have any orders yet. Once you start receiving orders,
                  you'll be able to print them with GST calculations from the Orders page.
                </p>
              </Banner>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Button,
  InlineStack,
  Text,
  Banner,
  Checkbox,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

// Indian States for GST
const INDIAN_STATES = [
  { label: "Andhra Pradesh", value: "Andhra Pradesh" },
  { label: "Arunachal Pradesh", value: "Arunachal Pradesh" },
  { label: "Assam", value: "Assam" },
  { label: "Bihar", value: "Bihar" },
  { label: "Chhattisgarh", value: "Chhattisgarh" },
  { label: "Goa", value: "Goa" },
  { label: "Gujarat", value: "Gujarat" },
  { label: "Haryana", value: "Haryana" },
  { label: "Himachal Pradesh", value: "Himachal Pradesh" },
  { label: "Jharkhand", value: "Jharkhand" },
  { label: "Karnataka", value: "Karnataka" },
  { label: "Kerala", value: "Kerala" },
  { label: "Madhya Pradesh", value: "Madhya Pradesh" },
  { label: "Maharashtra", value: "Maharashtra" },
  { label: "Manipur", value: "Manipur" },
  { label: "Meghalaya", value: "Meghalaya" },
  { label: "Mizoram", value: "Mizoram" },
  { label: "Nagaland", value: "Nagaland" },
  { label: "Odisha", value: "Odisha" },
  { label: "Punjab", value: "Punjab" },
  { label: "Rajasthan", value: "Rajasthan" },
  { label: "Sikkim", value: "Sikkim" },
  { label: "Tamil Nadu", value: "Tamil Nadu" },
  { label: "Telangana", value: "Telangana" },
  { label: "Tripura", value: "Tripura" },
  { label: "Uttar Pradesh", value: "Uttar Pradesh" },
  { label: "Uttarakhand", value: "Uttarakhand" },
  { label: "West Bengal", value: "West Bengal" },
  { label: "Delhi", value: "Delhi" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get or create app settings
  let settings = await db.appSettings.findUnique({
    where: { shop: session.shop },
  });

  if (!settings) {
    // Create installation record if doesn't exist
    await db.appInstallation.upsert({
      where: { shop: session.shop },
      create: { shop: session.shop },
      update: {},
    });

    // Create default settings
    settings = await db.appSettings.create({
      data: {
        shop: session.shop,
        defaultGstRate: 0.18,
        storeState: "Gujarat",
      },
    });
  }

  return json({ settings, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const settingsData = {
    defaultGstRate: parseFloat(formData.get("defaultGstRate") as string),
    gstNumber: formData.get("gstNumber") as string,
    companyName: formData.get("companyName") as string,
    companyAddress: formData.get("companyAddress") as string,
    storeState: formData.get("storeState") as string,
    pdfHeaderText: formData.get("pdfHeaderText") as string,
    pdfFooterText: formData.get("pdfFooterText") as string,
    includeLogo: formData.get("includeLogo") === "true",
    logoUrl: formData.get("logoUrl") as string,
  };

  await db.appSettings.upsert({
    where: { shop: session.shop },
    update: settingsData,
    create: {
      shop: session.shop,
      ...settingsData,
    },
  });

  return json({ success: true, message: "Settings saved successfully!" });
};

export default function Settings() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [formState, setFormState] = useState({
    defaultGstRate: (settings.defaultGstRate * 100).toString(),
    gstNumber: settings.gstNumber || "",
    companyName: settings.companyName || "",
    companyAddress: settings.companyAddress || "",
    storeState: settings.storeState,
    pdfHeaderText: settings.pdfHeaderText || "",
    pdfFooterText: settings.pdfFooterText || "",
    includeLogo: settings.includeLogo,
    logoUrl: settings.logoUrl || "",
  });

  const [saved, setSaved] = useState(false);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("defaultGstRate", (parseFloat(formState.defaultGstRate) / 100).toString());
    formData.append("gstNumber", formState.gstNumber);
    formData.append("companyName", formState.companyName);
    formData.append("companyAddress", formState.companyAddress);
    formData.append("storeState", formState.storeState);
    formData.append("pdfHeaderText", formState.pdfHeaderText);
    formData.append("pdfFooterText", formState.pdfFooterText);
    formData.append("includeLogo", formState.includeLogo.toString());
    formData.append("logoUrl", formState.logoUrl);

    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [formState, submit]);

  return (
    <Page
      title="Settings"
      subtitle="Configure GST and invoice settings"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
      }}
    >
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Settings saved successfully!
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                GST Configuration
              </Text>

              <TextField
                label="GST Number"
                value={formState.gstNumber}
                onChange={(value) =>
                  setFormState({ ...formState, gstNumber: value })
                }
                placeholder="22AAAAA0000A1Z5"
                helpText="Your 15-digit GST identification number"
                autoComplete="off"
              />

              <TextField
                label="Company Name"
                value={formState.companyName}
                onChange={(value) =>
                  setFormState({ ...formState, companyName: value })
                }
                placeholder="Your Company Name"
                autoComplete="off"
              />

              <TextField
                label="Company Address"
                value={formState.companyAddress}
                onChange={(value) =>
                  setFormState({ ...formState, companyAddress: value })
                }
                placeholder="Complete business address"
                multiline={3}
                autoComplete="off"
              />

              <Select
                label="Store State"
                options={INDIAN_STATES}
                value={formState.storeState}
                onChange={(value) =>
                  setFormState({ ...formState, storeState: value })
                }
                helpText="Used for CGST/SGST vs IGST calculation"
              />

              <TextField
                label="Default GST Rate (%)"
                type="number"
                value={formState.defaultGstRate}
                onChange={(value) =>
                  setFormState({ ...formState, defaultGstRate: value })
                }
                suffix="%"
                helpText="Default: 18% (9% CGST + 9% SGST or 18% IGST)"
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Invoice Customization
              </Text>

              <Checkbox
                label="Include logo on invoice"
                checked={formState.includeLogo}
                onChange={(value) =>
                  setFormState({ ...formState, includeLogo: value })
                }
              />

              {formState.includeLogo && (
                <TextField
                  label="Logo URL"
                  value={formState.logoUrl}
                  onChange={(value) =>
                    setFormState({ ...formState, logoUrl: value })
                  }
                  placeholder="https://example.com/logo.png"
                  autoComplete="off"
                />
              )}

              <TextField
                label="Invoice Header Text"
                value={formState.pdfHeaderText}
                onChange={(value) =>
                  setFormState({ ...formState, pdfHeaderText: value })
                }
                placeholder="Tax Invoice"
                autoComplete="off"
              />

              <TextField
                label="Invoice Footer Text"
                value={formState.pdfFooterText}
                onChange={(value) =>
                  setFormState({ ...formState, pdfFooterText: value })
                }
                placeholder="Thank you for your business!"
                multiline={2}
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                HSN Code Management
              </Text>

              <Text as="p" variant="bodyMd" tone="subdued">
                HSN (Harmonized System of Nomenclature) codes are required for GST compliance.
                Assign HSN codes to your products for accurate tax reporting.
              </Text>

              <InlineStack align="end">
                <Button url="/app/hsn-codes">
                  Manage HSN Codes
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Connected Store
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Shop:</strong> {shop}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

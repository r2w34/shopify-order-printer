import { type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request
  );

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Customer requests their data
      // You should return all data you have about this customer
      await db.webhookLog.create({
        data: {
          shop,
          topic: "customers/data_request",
          webhookId: `gdpr-${Date.now()}`,
          payload: payload,
          status: "PROCESSED",
        },
      });
      
      console.log(`Customer data request for shop: ${shop}`);
      // TODO: Implement actual data export
      break;

    case "CUSTOMERS_REDACT":
      // Customer requests deletion of their data (GDPR Right to be Forgotten)
      await db.webhookLog.create({
        data: {
          shop,
          topic: "customers/redact",
          webhookId: `gdpr-${Date.now()}`,
          payload: payload,
          status: "PROCESSED",
        },
      });
      
      console.log(`Customer data redaction for shop: ${shop}`);
      // TODO: Implement customer data deletion
      break;

    case "SHOP_REDACT":
      // Shop uninstalled app and requests deletion of all data (48 hours after uninstall)
      console.log(`Shop redaction request for: ${shop}`);
      
      // Delete all data for this shop
      await db.webhookLog.deleteMany({ where: { shop } });
      await db.printJob.deleteMany({ where: { shop } });
      await db.template.deleteMany({ where: { shop } });
      await db.appSettings.deleteMany({ where: { shop } });
      await db.session.deleteMany({ where: { shop } });
      await db.appInstallation.updateMany({
        where: { shop },
        data: { isActive: false, uninstalledAt: new Date() },
      });
      
      console.log(`All data deleted for shop: ${shop}`);
      break;

    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }

  return new Response();
};

import { requireRouteAccess } from "../../lib/access";

const orderStates = [
  "new",
  "allocated",
  "picking",
  "packed",
  "shipped",
  "cancelled",
  "exception"
];

export default async function OrdersPage() {
  await requireRouteAccess("/orders", ["admin", "manager", "picker", "packer"]);

  return (
    <section className="section-block" aria-labelledby="orders-heading">
      <div className="section-header">
        <p className="eyebrow">Orders</p>
        <h1 id="orders-heading">Fulfillment lifecycle</h1>
      </div>

      <div className="status-row">
        {orderStates.map((state) => (
          <span className="status-chip" key={state}>
            {state}
          </span>
        ))}
      </div>

      <p className="hero-copy">
        Shopify and WooCommerce orders enter through integrations, reserve stock during
        allocation, and only advance after scan-confirmed task completion.
      </p>
    </section>
  );
}

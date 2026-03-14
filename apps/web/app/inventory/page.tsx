import { requireRouteAccess } from "../../lib/access";
import { getInventoryOverview } from "../../lib/api";

export default async function InventoryPage() {
  const session = await requireRouteAccess("/inventory", ["admin", "manager"]);
  const records = await getInventoryOverview(session);
  const totalOnHand = records.reduce((sum, record) => sum + record.onHandQuantity, 0);
  const totalAllocated = records.reduce((sum, record) => sum + record.allocatedQuantity, 0);
  const totalAvailable = records.reduce(
    (sum, record) => sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
    0
  );

  return (
    <section className="section-block" aria-labelledby="inventory-heading">
      <div className="section-header">
        <p className="eyebrow">Inventory</p>
        <h1 id="inventory-heading">Live inventory balances</h1>
      </div>

      <div className="detail-grid">
        <article className="detail-card">
          <strong>On-hand</strong>
          <p>{totalOnHand} units across active bins.</p>
        </article>
        <article className="detail-card">
          <strong>Allocated</strong>
          <p>{totalAllocated} units reserved against outbound demand.</p>
        </article>
        <article className="detail-card">
          <strong>Available</strong>
          <p>{totalAvailable} units ready for allocation after damage and holds.</p>
        </article>
      </div>

      <div className="inventory-grid">
        {records.map((record) => {
          const available = record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity;

          return (
            <article className="inventory-card" key={record.id}>
              <div>
                <strong>{record.productName}</strong>
                <p>
                  {record.sku} • bin {record.binCode}
                </p>
              </div>
              <dl>
                <div>
                  <dt>On-hand</dt>
                  <dd>{record.onHandQuantity}</dd>
                </div>
                <div>
                  <dt>Allocated</dt>
                  <dd>{record.allocatedQuantity}</dd>
                </div>
                <div>
                  <dt>Damaged</dt>
                  <dd>{record.damagedQuantity}</dd>
                </div>
                <div>
                  <dt>Available</dt>
                  <dd>{available}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

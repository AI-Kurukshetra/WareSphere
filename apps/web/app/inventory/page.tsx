import { requireRouteAccess } from "../../lib/access";
import { getInventoryOverview } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await requireRouteAccess("/inventory", ["admin", "manager"]);
  const records = await getInventoryOverview(session);
  const totalOnHand = records.reduce((sum, record) => sum + record.onHandQuantity, 0);
  const totalAllocated = records.reduce((sum, record) => sum + record.allocatedQuantity, 0);
  const totalDamaged = records.reduce((sum, record) => sum + record.damagedQuantity, 0);
  const totalAvailable = records.reduce(
    (sum, record) => sum + (record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity),
    0
  );

  return (
    <section className="section-block" aria-labelledby="inventory-heading">
      <div className="section-header">
        <p className="eyebrow">Inventory</p>
        <h1 id="inventory-heading">Live inventory balances</h1>
        <p className="section-note">
          Review what is free to allocate, what is already committed, and which bins need attention.
        </p>
      </div>

      <div className="summary-strip" aria-label="Inventory summary">
        <article className="summary-card">
          <p className="summary-label">On-hand units</p>
          <strong className="summary-value">{totalOnHand}</strong>
          <p className="summary-note">{records.length} active bin balances</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Allocated</p>
          <strong className="summary-value">{totalAllocated}</strong>
          <p className="summary-note">Reserved against outbound demand</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Available</p>
          <strong className="summary-value">{totalAvailable}</strong>
          <p className="summary-note">Ready for new allocation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Damaged / hold</p>
          <strong className="summary-value">{totalDamaged}</strong>
          <p className="summary-note">Requires manager review</p>
        </article>
      </div>

      <div className="inventory-grid">
        {records.length === 0 ? (
          <article className="empty-state">
            <strong>No live inventory yet</strong>
            <p>Once receiving and put-away are active, the bin balances will appear here.</p>
          </article>
        ) : (
          records.map((record) => {
            const available = record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity;
            const tone = record.damagedQuantity > 0 ? "warning" : available > 0 ? "positive" : "stable";

            return (
              <article className="inventory-card" key={record.id}>
                <div className="card-topline">
                  <div>
                    <strong>{record.productName}</strong>
                    <p>
                      {record.sku} • bin {record.binCode}
                    </p>
                  </div>
                  <span className={`status-chip status-chip--${tone}`}>{available} available</span>
                </div>

                <div className="inventory-stat-row">
                  <div className="inventory-stat">
                    <span>On-hand</span>
                    <strong>{record.onHandQuantity}</strong>
                  </div>
                  <div className="inventory-stat">
                    <span>Allocated</span>
                    <strong>{record.allocatedQuantity}</strong>
                  </div>
                  <div className="inventory-stat">
                    <span>Damaged</span>
                    <strong>{record.damagedQuantity}</strong>
                  </div>
                  <div className="inventory-stat">
                    <span>Free stock</span>
                    <strong>{available}</strong>
                  </div>
                </div>

                <dl>
                  <div>
                    <dt>SKU</dt>
                    <dd>{record.sku}</dd>
                  </div>
                  <div>
                    <dt>Bin</dt>
                    <dd>{record.binCode}</dd>
                  </div>
                  <div>
                    <dt>Allocation state</dt>
                    <dd>{record.allocatedQuantity > 0 ? "Reserved" : "Open"}</dd>
                  </div>
                  <div>
                    <dt>Risk</dt>
                    <dd>{record.damagedQuantity > 0 ? "Review required" : "Clear"}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

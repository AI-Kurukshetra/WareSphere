import { requireRouteAccess } from "../../lib/access";

const dispositions = ["restock", "quarantine", "damage"];

export default async function ReturnsPage() {
  await requireRouteAccess("/returns", ["admin", "manager", "receiver"]);

  return (
    <section className="section-block" aria-labelledby="returns-heading">
      <div className="section-header">
        <p className="eyebrow">Returns</p>
        <h1 id="returns-heading">Disposition-driven intake</h1>
      </div>

      <div className="status-row">
        {dispositions.map((item) => (
          <span className="status-chip" key={item}>
            {item}
          </span>
        ))}
      </div>

      <p className="hero-copy">
        Every return is linked to an order when possible, classified during intake, and sent back
        to stock only through an auditable inventory movement.
      </p>
    </section>
  );
}

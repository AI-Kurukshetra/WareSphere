import type { DashboardMetric, WorkflowCard } from "@wms/shared";

type OverviewGridProps = {
  metrics: DashboardMetric[];
  workflows: WorkflowCard[];
};

export function OverviewGrid({ metrics, workflows }: OverviewGridProps) {
  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Single-warehouse MVP</p>
          <h1 className="hero-title">Warehouse control tuned for barcode-first operations.</h1>
        </div>
        <p className="hero-copy">
          Launch inventory, receiving, fulfillment, and returns from one command center. The
          current scaffold is wired around the operational states defined in the SRS.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Key warehouse metrics">
        {metrics.map((metric) => (
          <article className={`metric-card metric-card--${metric.emphasis}`} key={metric.id}>
            <p className="metric-label">{metric.label}</p>
            <strong className="metric-value">{metric.value}</strong>
            <p className="metric-change">{metric.change}</p>
          </article>
        ))}
      </section>

      <section className="section-block" aria-labelledby="workflow-cards-heading">
        <div className="section-header">
          <p className="eyebrow">Operational lanes</p>
          <h2 id="workflow-cards-heading">Start with the flows that move stock.</h2>
        </div>

        <div className="workflow-grid">
          {workflows.map((workflow) => (
            <a className="workflow-card" href={workflow.href} key={workflow.id}>
              <span className="workflow-owner">{workflow.owner}</span>
              <strong>{workflow.title}</strong>
              <p>{workflow.description}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}


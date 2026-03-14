import Link from "next/link";

import type { DashboardMetric, WorkflowCard } from "@wms/shared";

type OverviewGridProps = {
  metrics: DashboardMetric[];
  workflows: WorkflowCard[];
};

export function OverviewGrid({ metrics, workflows }: OverviewGridProps) {
  const spotlightWorkflows = workflows.slice(0, 4);

  return (
    <>
      <section className="hero-panel">
        <div className="hero-main">
          <p className="eyebrow">Single-warehouse MVP</p>
          <h1 className="hero-title">Simple warehouse control for barcode-first teams.</h1>
          <p className="hero-copy">
            Run receiving, counts, inventory, outbound execution, and returns from one console.
            The current product shape favors clear roles, fast scanning, and auditable stock movement.
          </p>
          <div className="hero-highlights">
            <span className="status-chip status-chip--accent">Receiving live</span>
            <span className="status-chip status-chip--warning">Counts in motion</span>
            <span className="status-chip status-chip--stable">Role-aware actions</span>
            <span className="status-chip status-chip--positive">Audit trail active</span>
          </div>

          <div className="hero-ribbon" aria-label="Warehouse rhythm">
            {metrics.slice(0, 3).map((metric) => (
              <article className="hero-ribbon-card" key={metric.id}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.change}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit">
            {spotlightWorkflows.map((workflow) => (
              <article className="hero-node" key={workflow.id}>
                <span>{workflow.owner}</span>
                <strong>{workflow.title}</strong>
              </article>
            ))}

            <div className="hero-core">
              <span className="hero-core-mark">AK</span>
              <strong>Live floor control</strong>
              <p>Receive, count, dispatch.</p>
            </div>

            <div className="hero-ring hero-ring--outer" />
            <div className="hero-ring hero-ring--inner" />
            <div className="hero-ring hero-ring--pulse" />
          </div>
        </div>

        <aside className="hero-aside" aria-label="Operating principles">
          <p className="eyebrow">Shift pulse</p>
          <div className="signal-list">
            <article className="signal-card">
              <strong>Scan before commit</strong>
              <p>Inbound and outbound work only advances after bin or barcode confirmation.</p>
            </article>
            <article className="signal-card">
              <strong>One lane, one owner</strong>
              <p>Managers release work. Operators complete it. The system keeps the trail clean.</p>
            </article>
            <article className="signal-card">
              <strong>Variance stays visible</strong>
              <p>Counts and manual corrections remain auditable before inventory moves forward.</p>
            </article>
          </div>
        </aside>
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
            <Link className="workflow-card" href={workflow.href} key={workflow.id}>
              <span className="workflow-owner">{workflow.owner}</span>
              <strong>{workflow.title}</strong>
              <p>{workflow.description}</p>
              <span className="workflow-link">Open workflow</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

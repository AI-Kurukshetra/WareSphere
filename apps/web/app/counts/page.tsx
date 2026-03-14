import { requireRouteAccess } from "../../lib/access";
import { getCountQueue, getInventoryOverview } from "../../lib/api";
import {
  adjustInventoryAction,
  confirmCountAction,
  releaseCountTaskAction
} from "./actions";

export const dynamic = "force-dynamic";

type CountsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const resultCopy: Record<string, string> = {
  "count-released": "Cycle count task released and ready for confirmation.",
  "count-confirmed": "Cycle count confirmed and inventory balances refreshed.",
  "inventory-adjusted": "Manual stock correction posted with an audit trail."
};

export default async function CountsPage({ searchParams }: CountsPageProps) {
  const params = await searchParams;
  const session = await requireRouteAccess("/counts", ["admin", "manager", "receiver"]);
  const [records, countTasks] = await Promise.all([
    getInventoryOverview(session),
    getCountQueue(session)
  ]);

  const result = readValue(params.result);
  const error = readValue(params.error);
  const reference = readValue(params.ref) ?? readValue(params.task);
  const message = readValue(params.message);
  const openCountTasks = countTasks.filter((task) => task.status !== "completed");
  const completedCountTasks = countTasks.filter((task) => task.status === "completed");
  const varianceTasks = completedCountTasks.filter((task) => (task.varianceQuantity ?? 0) !== 0);
  const openTargets = new Set(openCountTasks.map((task) => `${task.productId}:${task.binCode}`));
  const netVariance = varianceTasks.reduce((sum, task) => sum + (task.varianceQuantity ?? 0), 0);
  const canReleaseCount = session.role === "admin" || session.role === "manager";
  const canConfirmCount = canReleaseCount || session.role === "receiver";
  const canAdjustInventory = canReleaseCount;

  return (
    <section className="section-block" aria-labelledby="counts-heading">
      <div className="section-header">
        <p className="eyebrow">Cycle counts</p>
        <h1 id="counts-heading">Variance review and stock correction</h1>
        <p className="section-note">
          Release bin counts, confirm the scanned quantity, then correct stock only when the
          variance requires a manager decision.
        </p>
      </div>

      <div className="status-row">
        <span className="status-chip status-chip--stable">open counts queue work</span>
        <span className="status-chip status-chip--warning">variance stays auditable</span>
        <span className="status-chip status-chip--positive">manual adjustments are manager-only</span>
      </div>

      <div className="summary-strip" aria-label="Counts summary">
        <article className="summary-card">
          <p className="summary-label">Open counts</p>
          <strong className="summary-value">{openCountTasks.length}</strong>
          <p className="summary-note">Waiting for a bin and barcode confirmation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Completed counts</p>
          <strong className="summary-value">{completedCountTasks.length}</strong>
          <p className="summary-note">Closed with expected and counted quantities recorded</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Variance tasks</p>
          <strong className="summary-value">{varianceTasks.length}</strong>
          <p className="summary-note">Completed counts that changed stock</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Net variance</p>
          <strong className="summary-value">{formatVariance(netVariance)}</strong>
          <p className="summary-note">Positive adds stock, negative confirms shrink</p>
        </article>
      </div>

      {result ? (
        <p className="inline-message inline-message--positive">
          {reference ? `${reference}: ` : ""}
          {resultCopy[result] ?? "Count workflow action completed."}
        </p>
      ) : null}

      {error ? (
        <p className="inline-message inline-message--error">
          {reference ? `${reference}: ` : ""}
          {message ?? "The count workflow action could not be completed."}
        </p>
      ) : null}

      <div className="lane-grid">
        <section className="lane-panel" aria-labelledby="count-release-heading">
          <div className="section-header">
            <p className="eyebrow">Release</p>
            <h2 id="count-release-heading">Inventory ready for count</h2>
            <p className="section-note">
              Managers release a fresh count when a bin needs verification or follow-up.
            </p>
          </div>

          <div className="task-list">
            {records.length === 0 ? (
              <article className="empty-state">
                <strong>No inventory records are available</strong>
                <p>Receiving and put-away will create countable stock here automatically.</p>
              </article>
            ) : (
              records.map((record) => {
                const targetKey = `${record.productId}:${record.binCode}`;
                const countAlreadyOpen = openTargets.has(targetKey);

                return (
                  <article className="task-card" key={record.id}>
                    <div className="card-topline">
                      <div>
                        <strong>{record.productName}</strong>
                        <p>
                          {record.sku} • {record.binCode}
                        </p>
                      </div>
                      <span className={`status-chip status-chip--${countAlreadyOpen ? "warning" : "positive"}`}>
                        {countAlreadyOpen ? "count open" : "ready"}
                      </span>
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
                        <dd>{record.onHandQuantity - record.allocatedQuantity - record.damagedQuantity}</dd>
                      </div>
                    </dl>

                    <section className="action-panel" aria-labelledby={`${record.id}-release`}>
                      <div>
                        <p className="eyebrow">Cycle count</p>
                        <h2 id={`${record.id}-release`}>Release task</h2>
                        <p className="helper-copy">
                          This snapshots the current on-hand quantity and creates a scan-first count.
                        </p>
                      </div>

                      {canReleaseCount ? (
                        countAlreadyOpen ? (
                          <p className="helper-copy helper-copy--muted">
                            A count task for this SKU and bin is already open.
                          </p>
                        ) : (
                          <form action={releaseCountTaskAction} className="action-form">
                            <input name="inventoryId" type="hidden" value={record.id} />
                            <input
                              name="inventoryRef"
                              type="hidden"
                              value={`${record.sku} • ${record.binCode}`}
                            />
                            <button className="session-button" type="submit">
                              Release cycle count
                            </button>
                          </form>
                        )
                      ) : (
                        <p className="helper-copy helper-copy--muted">
                          Managers release counts. Receivers can confirm the tasks below.
                        </p>
                      )}
                    </section>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="count-queue-heading">
          <div className="section-header">
            <p className="eyebrow">Queue</p>
            <h2 id="count-queue-heading">Open count tasks</h2>
            <p className="section-note">
              Scan the product and confirm the physical quantity in the assigned bin.
            </p>
          </div>

          <div className="task-list">
            {openCountTasks.length === 0 ? (
              <article className="empty-state">
                <strong>No count tasks are waiting</strong>
                <p>Release a count from the inventory lane when a bin needs verification.</p>
              </article>
            ) : (
              openCountTasks.map((task) => (
                <article className="task-card" key={task.id}>
                  <div className="card-topline">
                    <div>
                      <strong>{task.productName}</strong>
                      <p>
                        {task.id} • {task.sku}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getTaskTone(task.status)}`}>
                      {formatStatus(task.status)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>Bin</dt>
                      <dd>{task.binCode}</dd>
                    </div>
                    <div>
                      <dt>System quantity</dt>
                      <dd>{task.expectedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Counted</dt>
                      <dd>{task.countedQuantity ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Variance</dt>
                      <dd>{task.varianceQuantity === null ? "Pending" : formatVariance(task.varianceQuantity)}</dd>
                    </div>
                  </dl>

                  <section className="action-panel" aria-labelledby={`${task.id}-confirm`}>
                    <div>
                      <p className="eyebrow">Count confirmation</p>
                      <h2 id={`${task.id}-confirm`}>Confirm counted quantity</h2>
                      <p className="helper-copy">
                        Enter the physical count. The task will close and post a count adjustment if needed.
                      </p>
                    </div>

                    {canConfirmCount ? (
                      <form action={confirmCountAction} className="action-form">
                        <input name="taskId" type="hidden" value={task.id} />

                        <div className="field-grid">
                          <div className="field-group">
                            <label className="field-label" htmlFor={`${task.id}-bin`}>
                              Bin
                            </label>
                            <input
                              className="text-input"
                              defaultValue={task.binCode}
                              id={`${task.id}-bin`}
                              name="binCode"
                              required
                              type="text"
                            />
                          </div>

                          <div className="field-group">
                            <label className="field-label" htmlFor={`${task.id}-barcode`}>
                              Barcode
                            </label>
                            <input
                              className="text-input"
                              defaultValue={task.barcode}
                              id={`${task.id}-barcode`}
                              name="barcode"
                              required
                              type="text"
                            />
                          </div>

                          <div className="field-group">
                            <label className="field-label" htmlFor={`${task.id}-counted`}>
                              Counted quantity
                            </label>
                            <input
                              className="text-input"
                              defaultValue={task.expectedQuantity}
                              id={`${task.id}-counted`}
                              min={0}
                              name="countedQuantity"
                              required
                              type="number"
                            />
                          </div>
                        </div>

                        <button className="session-button" type="submit">
                          Confirm count
                        </button>
                      </form>
                    ) : (
                      <p className="helper-copy helper-copy--muted">
                        This role cannot confirm count tasks.
                      </p>
                    )}
                  </section>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="manual-adjustments-heading">
          <div className="section-header">
            <p className="eyebrow">Corrections</p>
            <h2 id="manual-adjustments-heading">Manual inventory adjustments</h2>
            <p className="section-note">
              Use this only when the count cannot resolve the stock picture alone. Every change stays audited.
            </p>
          </div>

          <div className="task-list">
            {canAdjustInventory ? (
              records.map((record) => (
                <article className="task-card" key={`${record.id}-adjust`}>
                  <div className="card-topline">
                    <div>
                      <strong>{record.productName}</strong>
                      <p>
                        {record.sku} • {record.binCode}
                      </p>
                    </div>
                    <span className="status-chip status-chip--accent">{record.onHandQuantity} on-hand</span>
                  </div>

                  <dl>
                    <div>
                      <dt>Allocated</dt>
                      <dd>{record.allocatedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Damaged</dt>
                      <dd>{record.damagedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Minimum allowed</dt>
                      <dd>{record.allocatedQuantity + record.damagedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Bin</dt>
                      <dd>{record.binCode}</dd>
                    </div>
                  </dl>

                  <form action={adjustInventoryAction} className="action-form">
                    <input name="inventoryId" type="hidden" value={record.id} />
                    <input
                      name="inventoryRef"
                      type="hidden"
                      value={`${record.sku} • ${record.binCode}`}
                    />

                    <div className="field-grid">
                      <div className="field-group">
                        <label className="field-label" htmlFor={`${record.id}-delta`}>
                          Quantity delta
                        </label>
                        <input
                          className="text-input"
                          id={`${record.id}-delta`}
                          name="quantityDelta"
                          placeholder="Use -1, 2, etc."
                          required
                          step={1}
                          type="number"
                        />
                      </div>

                      <div className="field-group">
                        <label className="field-label" htmlFor={`${record.id}-reason`}>
                          Reason
                        </label>
                        <input
                          className="text-input"
                          defaultValue="cycle count variance"
                          id={`${record.id}-reason`}
                          name="reasonCode"
                          required
                          type="text"
                        />
                      </div>
                    </div>

                    <button className="session-button" type="submit">
                      Post manual adjustment
                    </button>
                  </form>
                </article>
              ))
            ) : (
              <article className="empty-state">
                <strong>Manual corrections are manager-only</strong>
                <p>Receivers should complete the count task and escalate any unresolved variance.</p>
              </article>
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="completed-counts-heading">
          <div className="section-header">
            <p className="eyebrow">History</p>
            <h2 id="completed-counts-heading">Completed counts</h2>
            <p className="section-note">
              Closed counts remain visible here so the warehouse team can review the variance trail.
            </p>
          </div>

          <div className="task-list">
            {completedCountTasks.length === 0 ? (
              <article className="empty-state">
                <strong>No counts have been completed yet</strong>
                <p>Confirmed counts will stay here with their expected quantity and final variance.</p>
              </article>
            ) : (
              completedCountTasks.map((task) => (
                <article className="task-card" key={`${task.id}-history`}>
                  <div className="card-topline">
                    <div>
                      <strong>{task.productName}</strong>
                      <p>
                        {task.id} • {task.binCode}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getVarianceTone(task.varianceQuantity ?? 0)}`}>
                      {formatVariance(task.varianceQuantity ?? 0)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>SKU</dt>
                      <dd>{task.sku}</dd>
                    </div>
                    <div>
                      <dt>Expected</dt>
                      <dd>{task.expectedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Counted</dt>
                      <dd>{task.countedQuantity ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{formatStatus(task.status)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function readValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getTaskTone(status: string) {
  switch (status) {
    case "completed":
      return "positive";
    case "blocked":
      return "warning";
    default:
      return "accent";
  }
}

function getVarianceTone(variance: number) {
  if (variance === 0) {
    return "positive";
  }

  return "warning";
}

function formatVariance(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

import { requireRouteAccess } from "../../lib/access";
import { getOrderOverview, getPackingQueue, getPickingQueue, getShipments } from "../../lib/api";
import {
  allocateOrderAction,
  confirmPackAction,
  confirmPickAction,
  dispatchShipmentAction
} from "./actions";

export const dynamic = "force-dynamic";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const orderStates = ["new", "allocated", "picking", "packed", "shipped", "cancelled", "exception"];
const resultCopy: Record<string, string> = {
  allocated: "Allocation completed and pick tasks were released.",
  "pick-confirmed": "Pick confirmation recorded and the queue was refreshed.",
  "pack-confirmed": "Packing completed and the shipment record is ready for dispatch.",
  "shipment-dispatched": "Shipment dispatch recorded and the order was moved to shipped."
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const session = await requireRouteAccess("/orders", ["admin", "manager", "picker", "packer"]);
  const [orders, pickingTasks, packingTasks, shipments] = await Promise.all([
    getOrderOverview(session),
    getPickingQueue(session),
    getPackingQueue(session),
    getShipments(session)
  ]);
  const result = readValue(params.result);
  const error = readValue(params.error);
  const reference =
    readValue(params.ref) ??
    readValue(params.order) ??
    readValue(params.task) ??
    readValue(params.shipment);
  const message = readValue(params.message);
  const canAllocate = session.role === "admin" || session.role === "manager";
  const canConfirmPick = canAllocate || session.role === "picker";
  const canConfirmPack = canAllocate || session.role === "packer";
  const canDispatchShipment = canConfirmPack;
  const newOrders = orders.filter((order) => order.status === "new").length;
  const allocatedOrders = orders.filter((order) => order.status === "allocated").length;
  const openPickTasks = pickingTasks.filter((task) => task.status !== "completed").length;
  const openPackTasks = packingTasks.filter((task) => task.status !== "completed").length;
  const readyToDispatch = shipments.filter((shipment) => shipment.status === "packed").length;
  const shippedOrders = orders.filter((order) => order.status === "shipped").length;

  return (
    <section className="section-block" aria-labelledby="orders-heading">
      <div className="section-header">
        <p className="eyebrow">Orders</p>
        <h1 id="orders-heading">Outbound allocation, packing, and shipping</h1>
        <p className="section-note">
          Managers reserve inventory, pickers remove stock from storage, and packers close the
          order with package and tracking confirmation.
        </p>
      </div>

      <div className="status-row">
        {orderStates.map((state) => (
          <span className={`status-chip status-chip--${getOrderTone(state)}`} key={state}>
            {formatStatus(state)}
          </span>
        ))}
      </div>

      <div className="summary-strip" aria-label="Orders summary">
        <article className="summary-card">
          <p className="summary-label">New orders</p>
          <strong className="summary-value">{newOrders}</strong>
          <p className="summary-note">Waiting for allocation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Allocated</p>
          <strong className="summary-value">{allocatedOrders}</strong>
          <p className="summary-note">Stock already reserved</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Open pick tasks</p>
          <strong className="summary-value">{openPickTasks}</strong>
          <p className="summary-note">Still waiting on floor confirmation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Open pack tasks</p>
          <strong className="summary-value">{openPackTasks}</strong>
          <p className="summary-note">Released after every order is fully picked</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Ready to dispatch</p>
          <strong className="summary-value">{readyToDispatch}</strong>
          <p className="summary-note">Packed shipments waiting for tracking confirmation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Shipped orders</p>
          <strong className="summary-value">{shippedOrders}</strong>
          <p className="summary-note">Outbound lane fully completed</p>
        </article>
      </div>

      {result ? (
        <p className="inline-message inline-message--positive">
          {reference ? `${reference}: ` : ""}
          {resultCopy[result] ?? "Order workflow action completed."}
        </p>
      ) : null}

      {error ? (
        <p className="inline-message inline-message--error">
          {reference ? `${reference}: ` : ""}
          {message ?? "The order workflow action could not be completed."}
        </p>
      ) : null}

      <div className="lane-grid">
        <section className="lane-panel" aria-labelledby="order-backlog-heading">
          <div className="section-header">
            <p className="eyebrow">Backlog</p>
            <h2 id="order-backlog-heading">Order backlog</h2>
          </div>

          <div className="task-list">
            {orders.length === 0 ? (
              <article className="empty-state">
                <strong>No active orders yet</strong>
                <p>Commerce imports and manual order release will surface here once enabled.</p>
              </article>
            ) : (
              orders.map((order) => (
                <article className="task-card" key={order.id}>
                  <div className="card-topline">
                    <div>
                      <strong>{order.id}</strong>
                      <p>
                        {order.customerName} • {order.sourceChannel}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getOrderTone(order.status)}`}>
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>Lines</dt>
                      <dd>{order.lineCount}</dd>
                    </div>
                    <div>
                      <dt>Ordered</dt>
                      <dd>{order.unitsOrdered}</dd>
                    </div>
                    <div>
                      <dt>Picked</dt>
                      <dd>{order.unitsPicked}</dd>
                    </div>
                    <div>
                      <dt>Packed</dt>
                      <dd>{order.unitsPacked}</dd>
                    </div>
                  </dl>

                  <div className="item-list">
                    {order.items.map((item) => (
                      <div className="item-row" key={`${order.id}-${item.productId}`}>
                        <div className="item-meta">
                          <strong>{item.productName}</strong>
                          <p>{item.sku}</p>
                        </div>
                        <div className="item-qty">
                          <span>
                            Ordered <strong>{item.orderedQuantity}</strong>
                          </span>
                          <span>
                            Allocated <strong>{item.allocatedQuantity}</strong>
                          </span>
                          <span>
                            Picked <strong>{item.pickedQuantity}</strong>
                          </span>
                          <span>
                            Packed <strong>{item.packedQuantity}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="task-actions">
                    <section className="action-panel" aria-labelledby={`${order.id}-allocation`}>
                      <div>
                        <p className="eyebrow">Manager step</p>
                        <h2 id={`${order.id}-allocation`}>Allocate stock</h2>
                        <p className="helper-copy">
                          Reserve available inventory and release pick work for the floor team.
                        </p>
                      </div>

                      {canAllocate && order.status === "new" ? (
                        <form action={allocateOrderAction} className="action-form">
                          <input name="orderId" type="hidden" value={order.id} />
                          <button className="session-button" type="submit">
                            Allocate and release picks
                          </button>
                        </form>
                      ) : (
                        <p className="helper-copy helper-copy--muted">
                          {order.status === "new"
                            ? "Manager access is required to allocate this order."
                            : `Order is already in ${formatStatus(order.status)}.`}
                        </p>
                      )}
                    </section>

                    <section className="action-panel" aria-labelledby={`${order.id}-ship-target`}>
                      <div>
                        <p className="eyebrow">Ship target</p>
                        <h2 id={`${order.id}-ship-target`}>Requested ship time</h2>
                        <p className="helper-copy">
                          {order.requestedShipAt
                            ? formatTimestamp(order.requestedShipAt)
                            : "No requested ship timestamp is set yet."}
                        </p>
                      </div>

                      <p className="helper-copy helper-copy--muted">
                        Packing tasks release automatically once the final pick is confirmed.
                      </p>
                    </section>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="pick-queue-heading">
          <div className="section-header">
            <p className="eyebrow">Execution</p>
            <h2 id="pick-queue-heading">Picking queue</h2>
          </div>

          <div className="task-list">
            {pickingTasks.length === 0 ? (
              <article className="empty-state">
                <strong>No pick tasks released</strong>
                <p>Allocated orders will generate picker work here automatically.</p>
              </article>
            ) : (
              pickingTasks.map((task) => {
                const remainingQuantity = task.expectedQuantity - task.pickedQuantity;
                const completionRatio = Math.round((task.pickedQuantity / task.expectedQuantity) * 100);

                return (
                  <article className="task-card" key={task.id}>
                    <div className="card-topline">
                      <div>
                        <strong>{task.id}</strong>
                        <p>
                          {task.orderId} • {task.customerName}
                        </p>
                      </div>
                      <span className={`status-chip status-chip--${getPickTone(task.status)}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>SKU</dt>
                        <dd>{task.sku}</dd>
                      </div>
                      <div>
                        <dt>Source bin</dt>
                        <dd>{task.sourceBin}</dd>
                      </div>
                      <div>
                        <dt>Expected</dt>
                        <dd>{task.expectedQuantity}</dd>
                      </div>
                      <div>
                        <dt>Picked</dt>
                        <dd>{task.pickedQuantity}</dd>
                      </div>
                    </dl>

                    <div className="progress-meta">
                      <div className="progress-copy">
                        <strong>{completionRatio}% complete</strong>
                        <p>{remainingQuantity} units remaining for this pick</p>
                      </div>
                      <div className="progress-bar" aria-hidden="true">
                        <span style={{ width: `${completionRatio}%` }} />
                      </div>
                    </div>

                    <div className="task-actions">
                      <section className="action-panel" aria-labelledby={`${task.id}-pick`}>
                        <div>
                          <p className="eyebrow">Picker step</p>
                          <h2 id={`${task.id}-pick`}>Confirm pick</h2>
                          <p className="helper-copy">
                            Scan the assigned bin and SKU before removing stock from storage.
                          </p>
                        </div>

                        {canConfirmPick && task.status !== "completed" ? (
                          <form action={confirmPickAction} className="action-form">
                            <input name="taskId" type="hidden" value={task.id} />

                            <div className="field-grid">
                              <div className="field-group">
                                <label className="field-label" htmlFor={`${task.id}-sourceBin`}>
                                  Source bin
                                </label>
                                <input
                                  className="text-input"
                                  defaultValue={task.sourceBin}
                                  id={`${task.id}-sourceBin`}
                                  name="sourceBin"
                                  required
                                  type="text"
                                />
                              </div>

                              <div className="field-group">
                                <label className="field-label" htmlFor={`${task.id}-quantity`}>
                                  Quantity
                                </label>
                                <input
                                  className="text-input"
                                  defaultValue={remainingQuantity}
                                  id={`${task.id}-quantity`}
                                  max={remainingQuantity}
                                  min={1}
                                  name="quantity"
                                  required
                                  type="number"
                                />
                              </div>
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

                            <button className="session-button" type="submit">
                              Confirm pick
                            </button>
                          </form>
                        ) : (
                          <p className="helper-copy helper-copy--muted">
                            {task.status === "completed"
                              ? "This pick task is already complete."
                              : "Picker access is required to confirm this task."}
                          </p>
                        )}
                      </section>

                      <section className="action-panel" aria-labelledby={`${task.id}-details`}>
                        <div>
                          <p className="eyebrow">Task details</p>
                          <h2 id={`${task.id}-details`}>Pick assignment</h2>
                          <p className="helper-copy">
                            {task.productName} for {task.customerName}
                          </p>
                        </div>

                        <p className="helper-copy helper-copy--muted">
                          {task.assigneeName
                            ? `Assigned to ${task.assigneeName}.`
                            : "This task is currently unassigned."}
                        </p>
                        <p className="helper-copy helper-copy--muted">
                          Remaining quantity: {remainingQuantity}. Current status: {formatStatus(task.status)}.
                        </p>
                      </section>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="pack-queue-heading">
          <div className="section-header">
            <p className="eyebrow">Packing</p>
            <h2 id="pack-queue-heading">Packing queue</h2>
          </div>

          <div className="task-list">
            {packingTasks.length === 0 ? (
              <article className="empty-state">
                <strong>No pack tasks released yet</strong>
                <p>Once all picks on an order are complete, a packing task appears here automatically.</p>
              </article>
            ) : (
              packingTasks.map((task) => {
                const remainingQuantity = task.expectedQuantity - task.packedQuantity;
                const completionRatio = Math.round((task.packedQuantity / task.expectedQuantity) * 100);

                return (
                  <article className="task-card" key={task.id}>
                    <div className="card-topline">
                      <div>
                        <strong>{task.id}</strong>
                        <p>
                          {task.orderId} • {task.customerName}
                        </p>
                      </div>
                      <span className={`status-chip status-chip--${getPackTone(task.status)}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>

                    <dl>
                      <div>
                        <dt>Order</dt>
                        <dd>{task.orderId}</dd>
                      </div>
                      <div>
                        <dt>Expected</dt>
                        <dd>{task.expectedQuantity}</dd>
                      </div>
                      <div>
                        <dt>Packed</dt>
                        <dd>{task.packedQuantity}</dd>
                      </div>
                      <div>
                        <dt>Assignee</dt>
                        <dd>{task.assigneeName ?? "Open"}</dd>
                      </div>
                    </dl>

                    <div className="progress-meta">
                      <div className="progress-copy">
                        <strong>{completionRatio}% complete</strong>
                        <p>{remainingQuantity} units still waiting for carton confirmation</p>
                      </div>
                      <div className="progress-bar" aria-hidden="true">
                        <span style={{ width: `${completionRatio}%` }} />
                      </div>
                    </div>

                    <div className="task-actions">
                      <section className="action-panel" aria-labelledby={`${task.id}-pack`}>
                        <div>
                          <p className="eyebrow">Packer step</p>
                          <h2 id={`${task.id}-pack`}>Confirm packing</h2>
                          <p className="helper-copy">
                            Lock the package count once the picked units are in the outbound carton.
                          </p>
                        </div>

                        {canConfirmPack && task.status !== "completed" ? (
                          <form action={confirmPackAction} className="action-form">
                            <input name="taskId" type="hidden" value={task.id} />

                            <div className="field-group">
                              <label className="field-label" htmlFor={`${task.id}-packageCount`}>
                                Package count
                              </label>
                              <input
                                className="text-input"
                                defaultValue={1}
                                id={`${task.id}-packageCount`}
                                min={1}
                                name="packageCount"
                                required
                                type="number"
                              />
                            </div>

                            <button className="session-button" type="submit">
                              Confirm packing
                            </button>
                          </form>
                        ) : (
                          <p className="helper-copy helper-copy--muted">
                            {task.status === "completed"
                              ? "Packing is already complete for this order."
                              : "Packer access is required to confirm packing."}
                          </p>
                        )}
                      </section>

                      <section className="action-panel" aria-labelledby={`${task.id}-pack-details`}>
                        <div>
                          <p className="eyebrow">Shipment prep</p>
                          <h2 id={`${task.id}-pack-details`}>Outbound handoff</h2>
                          <p className="helper-copy">
                            Confirming packing creates or updates the shipment record for dispatch.
                          </p>
                        </div>

                        <p className="helper-copy helper-copy--muted">
                          {task.assigneeName
                            ? `Assigned to ${task.assigneeName}.`
                            : "This packing task is ready for the next available packer."}
                        </p>
                      </section>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="shipment-queue-heading">
          <div className="section-header">
            <p className="eyebrow">Dispatch</p>
            <h2 id="shipment-queue-heading">Shipment queue</h2>
          </div>

          <div className="task-list">
            {shipments.length === 0 ? (
              <article className="empty-state">
                <strong>No shipment records yet</strong>
                <p>Packed orders will create shipment records here before carrier dispatch is confirmed.</p>
              </article>
            ) : (
              shipments.map((shipment) => (
                <article className="task-card" key={shipment.id}>
                  <div className="card-topline">
                    <div>
                      <strong>{shipment.orderId}</strong>
                      <p>
                        {shipment.customerName} • {shipment.sourceChannel}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getShipmentTone(shipment.status)}`}>
                      {formatStatus(shipment.status)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>Packages</dt>
                      <dd>{shipment.packageCount}</dd>
                    </div>
                    <div>
                      <dt>Carrier</dt>
                      <dd>{shipment.carrierCode ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Service</dt>
                      <dd>{shipment.serviceLevel ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Tracking</dt>
                      <dd>{shipment.trackingNumber ?? "Pending"}</dd>
                    </div>
                  </dl>

                  <div className="task-actions">
                    <section className="action-panel" aria-labelledby={`${shipment.id}-dispatch`}>
                      <div>
                        <p className="eyebrow">Dispatch step</p>
                        <h2 id={`${shipment.id}-dispatch`}>Confirm shipment</h2>
                        <p className="helper-copy">
                          Capture the carrier, service, and tracking number before the order leaves the dock.
                        </p>
                      </div>

                      {canDispatchShipment && shipment.status === "packed" ? (
                        <form action={dispatchShipmentAction} className="action-form">
                          <input name="shipmentId" type="hidden" value={shipment.id} />

                          <div className="field-grid">
                            <div className="field-group">
                              <label className="field-label" htmlFor={`${shipment.id}-carrierCode`}>
                                Carrier
                              </label>
                              <input
                                className="text-input"
                                defaultValue={shipment.carrierCode ?? "delhivery"}
                                id={`${shipment.id}-carrierCode`}
                                name="carrierCode"
                                required
                                type="text"
                              />
                            </div>

                            <div className="field-group">
                              <label className="field-label" htmlFor={`${shipment.id}-serviceLevel`}>
                                Service level
                              </label>
                              <input
                                className="text-input"
                                defaultValue={shipment.serviceLevel ?? "surface"}
                                id={`${shipment.id}-serviceLevel`}
                                name="serviceLevel"
                                required
                                type="text"
                              />
                            </div>
                          </div>

                          <div className="field-group">
                            <label className="field-label" htmlFor={`${shipment.id}-trackingNumber`}>
                              Tracking number
                            </label>
                            <input
                              className="text-input"
                              defaultValue={shipment.trackingNumber ?? buildTrackingPlaceholder(shipment.orderId)}
                              id={`${shipment.id}-trackingNumber`}
                              name="trackingNumber"
                              required
                              type="text"
                            />
                          </div>

                          <button className="session-button" type="submit">
                            Confirm dispatch
                          </button>
                        </form>
                      ) : (
                        <p className="helper-copy helper-copy--muted">
                          {shipment.status === "dispatched"
                            ? "Dispatch is already complete for this shipment."
                            : "Shipment must be packed before dispatch is confirmed."}
                        </p>
                      )}
                    </section>

                    <section className="action-panel" aria-labelledby={`${shipment.id}-dispatch-details`}>
                      <div>
                        <p className="eyebrow">Timeline</p>
                        <h2 id={`${shipment.id}-dispatch-details`}>Shipment activity</h2>
                        <p className="helper-copy">
                          Packed {shipment.packedAt ? formatTimestamp(shipment.packedAt) : "Not yet"}
                        </p>
                      </div>

                      <p className="helper-copy helper-copy--muted">
                        {shipment.dispatchedAt
                          ? `Dispatched ${formatTimestamp(shipment.dispatchedAt)}.`
                          : "Waiting for carrier handoff confirmation."}
                      </p>
                    </section>
                  </div>
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
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function getOrderTone(status: string) {
  switch (status) {
    case "shipped":
      return "positive";
    case "packed":
    case "allocated":
    case "picking":
      return "accent";
    case "exception":
      return "warning";
    default:
      return "stable";
  }
}

function getPickTone(status: string) {
  switch (status) {
    case "completed":
      return "positive";
    case "in_progress":
      return "accent";
    case "blocked":
      return "warning";
    default:
      return "stable";
  }
}

function getPackTone(status: string) {
  switch (status) {
    case "completed":
      return "positive";
    case "in_progress":
      return "accent";
    case "blocked":
      return "warning";
    default:
      return "stable";
  }
}

function getShipmentTone(status: string) {
  switch (status) {
    case "dispatched":
      return "positive";
    case "packed":
      return "accent";
    case "failed":
      return "warning";
    default:
      return "stable";
  }
}

function buildTrackingPlaceholder(orderId: string) {
  return `TRK-${orderId.replaceAll(/[^A-Z0-9]+/gi, "").toUpperCase()}`;
}

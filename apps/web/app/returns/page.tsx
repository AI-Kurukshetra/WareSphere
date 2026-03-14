import { requireRouteAccess } from "../../lib/access";
import { getOrderOverview, getReturns } from "../../lib/api";
import { createReturnAction, processReturnAction } from "./actions";

export const dynamic = "force-dynamic";

type ReturnsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const returnStates = ["initiated", "restocked", "disposed"];
const resultCopy: Record<string, string> = {
  "return-created": "Return request captured and queued for receiver intake.",
  "return-processed": "Return disposition recorded and inventory balances were updated."
};

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const params = await searchParams;
  const session = await requireRouteAccess("/returns", ["admin", "manager", "receiver"]);
  const [orders, returns] = await Promise.all([
    getOrderOverview(session),
    getReturns(session)
  ]);

  const result = readValue(params.result);
  const error = readValue(params.error);
  const reference = readValue(params.ref) ?? readValue(params.returns) ?? readValue(params.order);
  const message = readValue(params.message);
  const shippedOrders = orders.filter((order) => order.status === "shipped");
  const eligibleLines = shippedOrders.flatMap((order) =>
    order.items
      .filter((item) => item.packedQuantity > 0)
      .map((item) => {
        const committedQuantity = getCommittedReturnQuantity(returns, order.id, item.sku);

        return {
          orderId: order.id,
          customerName: order.customerName,
          sourceChannel: order.sourceChannel,
          requestedShipAt: order.requestedShipAt,
          sku: item.sku,
          productName: item.productName,
          packedQuantity: item.packedQuantity,
          committedQuantity,
          returnableQuantity: Math.max(item.packedQuantity - committedQuantity, 0)
        };
      })
  );
  const pendingReturns = returns.filter((item) => item.status === "initiated" || item.status === "received");
  const completedReturns = returns.filter((item) => item.status === "restocked" || item.status === "disposed");
  const restockedUnits = completedReturns
    .filter((item) => item.status === "restocked")
    .reduce((sum, item) => sum + item.quantity, 0);
  const nonSellableUnits = completedReturns
    .filter((item) => item.status === "disposed")
    .reduce((sum, item) => sum + item.quantity, 0);
  const canCreateReturn = session.role === "admin" || session.role === "manager" || session.role === "receiver";
  const canProcessReturn = canCreateReturn;

  return (
    <section className="section-block" aria-labelledby="returns-heading">
      <div className="section-header">
        <p className="eyebrow">Returns</p>
        <h1 id="returns-heading">Return intake and stock recovery</h1>
        <p className="section-note">
          Create returns from shipped orders, then restock or isolate the units with a receiver
          confirmation.
        </p>
      </div>

      <div className="status-row">
        {returnStates.map((state) => (
          <span className={`status-chip status-chip--${getReturnTone(state)}`} key={state}>
            {formatStatus(state)}
          </span>
        ))}
        <span className="status-chip status-chip--warning">quarantine stays non-sellable</span>
      </div>

      <div className="summary-strip" aria-label="Returns summary">
        <article className="summary-card">
          <p className="summary-label">Shipped orders</p>
          <strong className="summary-value">{shippedOrders.length}</strong>
          <p className="summary-note">Eligible for return intake</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Returnable lines</p>
          <strong className="summary-value">
            {eligibleLines.filter((line) => line.returnableQuantity > 0).length}
          </strong>
          <p className="summary-note">Still open for new return requests</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Pending intake</p>
          <strong className="summary-value">{pendingReturns.length}</strong>
          <p className="summary-note">Waiting for barcode and disposition confirmation</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Restocked units</p>
          <strong className="summary-value">{restockedUnits}</strong>
          <p className="summary-note">Returned to sellable inventory</p>
        </article>
        <article className="summary-card">
          <p className="summary-label">Non-sellable units</p>
          <strong className="summary-value">{nonSellableUnits}</strong>
          <p className="summary-note">Held as quarantine or damage</p>
        </article>
      </div>

      {result ? (
        <p className="inline-message inline-message--positive">
          {reference ? `${reference}: ` : ""}
          {resultCopy[result] ?? "Return workflow action completed."}
        </p>
      ) : null}

      {error ? (
        <p className="inline-message inline-message--error">
          {reference ? `${reference}: ` : ""}
          {message ?? "The return workflow action could not be completed."}
        </p>
      ) : null}

      <div className="lane-grid">
        <section className="lane-panel" aria-labelledby="return-eligibility-heading">
          <div className="section-header">
            <p className="eyebrow">Eligibility</p>
            <h2 id="return-eligibility-heading">Shipped order lines</h2>
          </div>

          <div className="task-list">
            {eligibleLines.length === 0 ? (
              <article className="empty-state">
                <strong>No shipped orders are ready for return intake</strong>
                <p>Dispatch confirmation will surface returnable orders here automatically.</p>
              </article>
            ) : (
              eligibleLines.map((line) => (
                <article className="task-card" key={`${line.orderId}-${line.sku}`}>
                  <div className="card-topline">
                    <div>
                      <strong>{line.orderId}</strong>
                      <p>
                        {line.customerName} • {line.sourceChannel}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${line.returnableQuantity > 0 ? "accent" : "stable"}`}>
                      {line.returnableQuantity > 0 ? "returnable" : "exhausted"}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>SKU</dt>
                      <dd>{line.sku}</dd>
                    </div>
                    <div>
                      <dt>Packed</dt>
                      <dd>{line.packedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Queued/returned</dt>
                      <dd>{line.committedQuantity}</dd>
                    </div>
                    <div>
                      <dt>Ship time</dt>
                      <dd>{line.requestedShipAt ? formatTimestamp(line.requestedShipAt) : "Not set"}</dd>
                    </div>
                  </dl>

                  <div className="task-actions">
                    <section className="action-panel" aria-labelledby={`${line.orderId}-${line.sku}-initiate`}>
                      <div>
                        <p className="eyebrow">Return setup</p>
                        <h2 id={`${line.orderId}-${line.sku}-initiate`}>Create return request</h2>
                        <p className="helper-copy">
                          Capture the order line before the receiver scans the product back in.
                        </p>
                      </div>

                      {canCreateReturn && line.returnableQuantity > 0 ? (
                        <form action={createReturnAction} className="action-form">
                          <input name="orderId" type="hidden" value={line.orderId} />
                          <input name="sku" type="hidden" value={line.sku} />

                          <div className="field-grid">
                            <div className="field-group">
                              <label className="field-label" htmlFor={`${line.orderId}-${line.sku}-quantity`}>
                                Quantity
                              </label>
                              <input
                                className="text-input"
                                defaultValue={1}
                                id={`${line.orderId}-${line.sku}-quantity`}
                                max={line.returnableQuantity}
                                min={1}
                                name="quantity"
                                required
                                type="number"
                              />
                            </div>

                            <div className="field-group">
                              <label className="field-label" htmlFor={`${line.orderId}-${line.sku}-source-reference`}>
                                Return reference
                              </label>
                              <input
                                className="text-input"
                                defaultValue={buildReturnReference(line.orderId, line.sku)}
                                id={`${line.orderId}-${line.sku}-source-reference`}
                                name="sourceReference"
                                type="text"
                              />
                            </div>
                          </div>

                          <button className="session-button" type="submit">
                            Create return
                          </button>
                        </form>
                      ) : (
                        <p className="helper-copy helper-copy--muted">
                          {line.returnableQuantity > 0
                            ? "Receiver, manager, or admin access is required to create a return."
                            : "All packed quantity is already committed to existing returns."}
                        </p>
                      )}
                    </section>

                    <section className="action-panel" aria-labelledby={`${line.orderId}-${line.sku}-eligibility`}>
                      <div>
                        <p className="eyebrow">Availability</p>
                        <h2 id={`${line.orderId}-${line.sku}-eligibility`}>Returnable quantity</h2>
                        <p className="helper-copy">
                          {line.productName} still has {line.returnableQuantity} units available to return.
                        </p>
                      </div>

                      <p className="helper-copy helper-copy--muted">
                        Quarantine and damage stay non-sellable until dedicated review bins are modeled.
                      </p>
                    </section>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="return-intake-heading">
          <div className="section-header">
            <p className="eyebrow">Intake</p>
            <h2 id="return-intake-heading">Pending returns</h2>
          </div>

          <div className="task-list">
            {pendingReturns.length === 0 ? (
              <article className="empty-state">
                <strong>No return requests are waiting</strong>
                <p>New return requests will queue here for receiver confirmation.</p>
              </article>
            ) : (
              pendingReturns.map((returnRequest) => (
                <article className="task-card" key={returnRequest.id}>
                  <div className="card-topline">
                    <div>
                      <strong>{returnRequest.id}</strong>
                      <p>
                        {returnRequest.orderId} • {returnRequest.customerName}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getReturnTone(returnRequest.status)}`}>
                      {formatStatus(returnRequest.status)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>SKU</dt>
                      <dd>{returnRequest.sku}</dd>
                    </div>
                    <div>
                      <dt>Quantity</dt>
                      <dd>{returnRequest.quantity}</dd>
                    </div>
                    <div>
                      <dt>Reference</dt>
                      <dd>{returnRequest.sourceReference ?? "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Channel</dt>
                      <dd>{returnRequest.sourceChannel}</dd>
                    </div>
                  </dl>

                  <div className="task-actions">
                    <section className="action-panel" aria-labelledby={`${returnRequest.id}-process`}>
                      <div>
                        <p className="eyebrow">Receiver step</p>
                        <h2 id={`${returnRequest.id}-process`}>Confirm return</h2>
                        <p className="helper-copy">
                          Scan the SKU, choose a disposition, and record the destination bin.
                        </p>
                      </div>

                      {canProcessReturn ? (
                        <form action={processReturnAction} className="action-form">
                          <input name="returnId" type="hidden" value={returnRequest.id} />

                          <div className="field-grid">
                            <div className="field-group">
                              <label className="field-label" htmlFor={`${returnRequest.id}-barcode`}>
                                Barcode
                              </label>
                              <input
                                className="text-input"
                                defaultValue={returnRequest.barcode}
                                id={`${returnRequest.id}-barcode`}
                                name="barcode"
                                required
                                type="text"
                              />
                            </div>

                            <div className="field-group">
                              <label className="field-label" htmlFor={`${returnRequest.id}-destination`}>
                                Destination bin
                              </label>
                              <input
                                className="text-input"
                                defaultValue={returnRequest.destinationBin ?? "B-04-01"}
                                id={`${returnRequest.id}-destination`}
                                name="destinationBin"
                                required
                                type="text"
                              />
                            </div>
                          </div>

                          <div className="field-group">
                            <label className="field-label" htmlFor={`${returnRequest.id}-disposition`}>
                              Disposition
                            </label>
                            <select
                              className="text-input"
                              defaultValue="restock"
                              id={`${returnRequest.id}-disposition`}
                              name="disposition"
                            >
                              <option value="restock">Restock</option>
                              <option value="quarantine">Quarantine</option>
                              <option value="damage">Damage</option>
                            </select>
                          </div>

                          <button className="session-button" type="submit">
                            Confirm return
                          </button>
                        </form>
                      ) : (
                        <p className="helper-copy helper-copy--muted">
                          Receiver, manager, or admin access is required to process this return.
                        </p>
                      )}
                    </section>

                    <section className="action-panel" aria-labelledby={`${returnRequest.id}-details`}>
                      <div>
                        <p className="eyebrow">Product details</p>
                        <h2 id={`${returnRequest.id}-details`}>Item being returned</h2>
                        <p className="helper-copy">{returnRequest.productName}</p>
                      </div>

                      <p className="helper-copy helper-copy--muted">
                        Restock returns sellable stock to inventory. Quarantine and damage stay non-sellable.
                      </p>
                    </section>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="lane-panel" aria-labelledby="return-history-heading">
          <div className="section-header">
            <p className="eyebrow">History</p>
            <h2 id="return-history-heading">Completed returns</h2>
          </div>

          <div className="task-list">
            {completedReturns.length === 0 ? (
              <article className="empty-state">
                <strong>No returns have been completed yet</strong>
                <p>Processed returns will remain visible here as an audit-friendly history.</p>
              </article>
            ) : (
              completedReturns.map((returnRequest) => (
                <article className="task-card" key={returnRequest.id}>
                  <div className="card-topline">
                    <div>
                      <strong>{returnRequest.id}</strong>
                      <p>
                        {returnRequest.orderId} • {returnRequest.customerName}
                      </p>
                    </div>
                    <span className={`status-chip status-chip--${getReturnTone(returnRequest.status)}`}>
                      {formatStatus(returnRequest.status)}
                    </span>
                  </div>

                  <dl>
                    <div>
                      <dt>SKU</dt>
                      <dd>{returnRequest.sku}</dd>
                    </div>
                    <div>
                      <dt>Disposition</dt>
                      <dd>{returnRequest.disposition ? formatStatus(returnRequest.disposition) : "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Destination bin</dt>
                      <dd>{returnRequest.destinationBin ?? "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Processed at</dt>
                      <dd>{returnRequest.receivedAt ? formatTimestamp(returnRequest.receivedAt) : "Pending"}</dd>
                    </div>
                  </dl>

                  <p className="helper-copy helper-copy--muted">
                    {returnRequest.quantity} units of {returnRequest.productName} were handled as{" "}
                    {returnRequest.disposition ? formatStatus(returnRequest.disposition) : "pending"}.
                  </p>
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

function getReturnTone(status: string) {
  switch (status) {
    case "restocked":
      return "positive";
    case "disposed":
      return "warning";
    default:
      return "accent";
  }
}

function getCommittedReturnQuantity(
  returns: Array<{ orderId: string; sku: string; quantity: number }>,
  orderId: string,
  sku: string
) {
  return returns
    .filter((item) => item.orderId === orderId && item.sku === sku)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function buildReturnReference(orderId: string, sku: string) {
  return `RMA-${orderId}-${sku.replaceAll(/[^A-Z0-9]+/gi, "").toUpperCase()}`;
}

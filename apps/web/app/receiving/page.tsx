import { requireRouteAccess } from "../../lib/access";
import { getReceivingQueue } from "../../lib/api";
import { confirmReceiptAction, putAwayAction } from "./actions";

type ReceivingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const resultCopy: Record<string, string> = {
  "receipt-confirmed": "Receipt confirmation recorded and staging inventory refreshed.",
  "putaway-completed": "Put-away completed and the destination bin balance was updated."
};

export default async function ReceivingPage({ searchParams }: ReceivingPageProps) {
  const params = await searchParams;
  const session = await requireRouteAccess("/receiving", ["admin", "manager", "receiver"]);
  const tasks = await getReceivingQueue(session);
  const result = readValue(params.result);
  const error = readValue(params.error);
  const taskCode = readValue(params.task);
  const message = readValue(params.message);

  return (
    <section className="section-block" aria-labelledby="receiving-heading">
      <div className="section-header">
        <p className="eyebrow">Receiving</p>
        <h1 id="receiving-heading">Inbound queue</h1>
      </div>

      {result ? (
        <p className="inline-message inline-message--positive">
          {taskCode ? `${taskCode}: ` : ""}
          {resultCopy[result] ?? "Receiving action completed."}
        </p>
      ) : null}

      {error ? (
        <p className="inline-message inline-message--error">
          {taskCode ? `${taskCode}: ` : ""}
          {message ?? "The receiving action could not be completed."}
        </p>
      ) : null}

      <div className="task-list">
        {tasks.map((task) => {
          const remainingQuantity = task.expectedQuantity - task.receivedQuantity;
          const completionRatio = Math.round(
            (task.receivedQuantity / task.expectedQuantity) * 100
          );
          const canReceive = task.status !== "completed" && remainingQuantity > 0;
          const canPutAway = task.status !== "completed" && task.receivedQuantity > 0;

          return (
            <article className="task-card" key={task.id}>
              <div>
                <strong>{task.productName}</strong>
                <p>
                  {task.sku} • barcode {task.barcode}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Expected</dt>
                  <dd>{task.expectedQuantity}</dd>
                </div>
                <div>
                  <dt>Received</dt>
                  <dd>{task.receivedQuantity}</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>{remainingQuantity}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{task.stagingBin}</dd>
                </div>
                <div>
                  <dt>Destination</dt>
                  <dd>{task.destinationBin}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{task.status}</dd>
                </div>
              </dl>
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${completionRatio}%` }} />
              </div>

              <div className="task-actions">
                <section className="action-panel" aria-labelledby={`${task.id}-receive`}>
                  <div>
                    <p className="eyebrow">Step 1</p>
                    <h2 id={`${task.id}-receive`}>Confirm receipt</h2>
                    <p className="helper-copy">
                      Scan the inbound SKU and confirm the staged quantity for {task.stagingBin}.
                    </p>
                  </div>

                  {canReceive ? (
                    <form action={confirmReceiptAction} className="action-form">
                      <input name="taskCode" type="hidden" value={task.id} />
                      <input name="taskId" type="hidden" value={task.id} />

                      <div className="field-grid">
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

                      <button className="session-button" type="submit">
                        Confirm receipt
                      </button>
                    </form>
                  ) : (
                    <p className="helper-copy helper-copy--muted">
                      {task.status === "completed"
                        ? "Receipt is already complete for this task."
                        : "All expected units are already staged."}
                    </p>
                  )}
                </section>

                <section className="action-panel" aria-labelledby={`${task.id}-putaway`}>
                  <div>
                    <p className="eyebrow">Step 2</p>
                    <h2 id={`${task.id}-putaway`}>Complete put-away</h2>
                    <p className="helper-copy">
                      Confirm the destination bin once staged units are ready to move.
                    </p>
                  </div>

                  {canPutAway ? (
                    <form action={putAwayAction} className="action-form">
                      <input name="taskCode" type="hidden" value={task.id} />
                      <input name="taskId" type="hidden" value={task.id} />

                      <div className="field-group">
                        <label className="field-label" htmlFor={`${task.id}-destination`}>
                          Destination bin
                        </label>
                        <input
                          className="text-input"
                          defaultValue={task.destinationBin}
                          id={`${task.id}-destination`}
                          name="destinationBin"
                          required
                          type="text"
                        />
                      </div>

                      <button className="session-button" type="submit">
                        Complete put-away
                      </button>
                    </form>
                  ) : (
                    <p className="helper-copy helper-copy--muted">
                      {task.status === "completed"
                        ? "Put-away is already complete for this task."
                        : "Confirm receipt first to unlock put-away."}
                    </p>
                  )}
                </section>
              </div>
            </article>
          );
        })}
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

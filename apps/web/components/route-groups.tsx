import type { ApiRouteGroup } from "@wms/shared";

type RouteGroupsProps = {
  groups: ApiRouteGroup[];
};

export function RouteGroups({ groups }: RouteGroupsProps) {
  return (
    <section className="section-block" aria-labelledby="route-groups-heading">
      <div className="section-header">
        <p className="eyebrow">Backend surface</p>
        <h2 id="route-groups-heading">Initial API groups</h2>
        <p className="section-note">
          These route groups back the protected dashboard, receiving queue, inventory view, and
          outbound workflow screens.
        </p>
      </div>

      <div className="route-grid">
        {groups.map((group) => (
          <article className="route-card" key={group.slug}>
            <code>{group.slug}</code>
            <p>{group.summary}</p>
            <span>{group.owner}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

import { workflowCards } from "@wms/shared";

import { OverviewGrid } from "../components/overview-grid";
import { RouteGroups } from "../components/route-groups";
import { requireRouteAccess } from "../lib/access";
import { getDashboardMetrics, getRouteGroups } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireRouteAccess("/", ["admin", "manager"]);
  const [metrics, groups] = await Promise.all([getDashboardMetrics(session), getRouteGroups()]);

  return (
    <>
      <OverviewGrid metrics={metrics} workflows={workflowCards} />
      <RouteGroups groups={groups} />
    </>
  );
}

import Link from "next/link";

import {
  getDefaultPathForRole,
  getRoleProfiles,
  getSession,
  normalizeRedirectTarget,
  resolvePostSignInPath
} from "../../lib/session";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorCopy: Record<string, string> = {
  "invalid-role": "The selected local role is not supported.",
  "invalid-token": "The bearer token could not be parsed or is missing a supported role claim.",
  "missing-token": "Paste a bearer token before submitting the token sign-in form.",
  "auth-failed": "Invalid email or password. Check your credentials and try again.",
  "missing-credentials": "Email and password are required."
};

const reasonCopy: Record<string, string> = {
  forbidden: "This session does not have permission to open that page.",
  "session-expired": "Sign in again to refresh the protected API session."
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextTarget = normalizeRedirectTarget(readValue(params.next));
  const error = readValue(params.error);
  const reason = readValue(params.reason);
  const session = await getSession();
  const roleProfiles = getRoleProfiles();
  const isDevMode = process.env.ALLOW_DEV_AUTH_HEADERS === "true";
  const continuePath = session
    ? resolvePostSignInPath(session.role, nextTarget ?? getDefaultPathForRole(session.role))
    : null;

  return (
    <section className="section-block auth-shell" aria-labelledby="sign-in-heading">
      <div className="section-header">
        <p className="eyebrow">Access</p>
        <h1 id="sign-in-heading">Warehouse session sign-in</h1>
      </div>

      {reason ? (
        <p className="inline-message inline-message--warning">{reasonCopy[reason] ?? reason}</p>
      ) : null}
      {error ? (
        <p className="inline-message inline-message--error">{errorCopy[error] ?? error}</p>
      ) : null}

      {session ? (
        <div className="current-session">
          <div>
            <strong>{session.displayName}</strong>
            <p>
              {session.email} • {session.role}
            </p>
          </div>

          <div className="session-actions">
            <Link className="session-link" href={continuePath ?? "/"}>
              Continue
            </Link>
            <form action="/auth/sign-out" method="post">
              <button className="session-button" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="auth-grid">
        <div className="auth-panel">
          <h2>Local role sessions</h2>
          {!isDevMode ? (
            <p className="inline-message inline-message--warning">
              Dev auth is disabled. Set ALLOW_DEV_AUTH_HEADERS=true in .env.local to use these
              sessions.
            </p>
          ) : null}
          <p className="hero-copy">
            Use seeded warehouse users for fast local development against the protected API.
          </p>

          <div className="auth-card-grid">
            {Object.entries(roleProfiles).map(([role, profile]) => (
              <form action="/auth/dev-sign-in" className="auth-card" key={role} method="post">
                <input name="role" type="hidden" value={role} />
                <input name="redirectTo" type="hidden" value={nextTarget ?? profile.defaultPath} />
                <p className="eyebrow">{role}</p>
                <strong>{profile.displayName}</strong>
                <p>{profile.email}</p>
                <span className="status-chip">Default {profile.defaultPath}</span>
                <button className="session-button" type="submit">
                  Sign in as {role}
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="auth-panel">
          <h2>Email sign-in</h2>
          <p className="hero-copy">
            Sign in with your warehouse account credentials.
          </p>

          <form action="/auth/email-sign-in" className="token-form" method="post">
            <input name="redirectTo" type="hidden" value={nextTarget ?? "/"} />
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              className="text-input"
              id="email"
              name="email"
              type="email"
              placeholder="admin@local.test"
              autoComplete="email"
            />
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              className="text-input"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
            <button className="session-button" type="submit">
              Sign in
            </button>
          </form>
        </div>
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

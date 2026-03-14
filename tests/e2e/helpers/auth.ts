import { expect, type Page } from "@playwright/test";

const roleButtonLabel: Record<string, string> = {
  admin: "Sign in as admin",
  manager: "Sign in as manager",
  receiver: "Sign in as receiver",
  picker: "Sign in as picker",
  packer: "Sign in as packer"
};

const roleProfiles = {
  admin: {
    userId: "90000000-0000-0000-0000-000000000001",
    email: "admin@local.test",
    displayName: "Local Admin"
  },
  manager: {
    userId: "90000000-0000-0000-0000-000000000002",
    email: "manager@local.test",
    displayName: "Local Manager"
  },
  receiver: {
    userId: "90000000-0000-0000-0000-000000000003",
    email: "receiver@local.test",
    displayName: "Local Receiver"
  },
  picker: {
    userId: "90000000-0000-0000-0000-000000000004",
    email: "picker@local.test",
    displayName: "Local Picker"
  },
  packer: {
    userId: "90000000-0000-0000-0000-000000000005",
    email: "packer@local.test",
    displayName: "Local Packer"
  }
} as const;

export async function signInAsRole(
  page: Page,
  role: keyof typeof roleButtonLabel,
  nextPath = "/"
) {
  const profile = roleProfiles[role];

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: "wms_session",
      value: encodeSessionCookieValue({
        kind: "dev",
        userId: profile.userId,
        email: profile.email,
        displayName: profile.displayName,
        role
      }),
      url: "http://localhost:3000"
    }
  ]);

  await page.goto(nextPath);
  await page.waitForURL((url) => url.pathname === nextPath, { timeout: 15_000 });
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
}

function encodeSessionCookieValue(value: {
  kind: "dev";
  userId: string;
  email: string;
  displayName: string;
  role: keyof typeof roleButtonLabel;
}) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

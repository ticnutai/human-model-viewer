import type { Page } from "@playwright/test";

const SUPABASE_URL = "https://ouuixsnealrwymlvtjxr.supabase.co";
const STORAGE_KEY = "sb-ouuixsnealrwymlvtjxr-auth-token";

/** Fake authenticated user */
export const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Test User" },
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const MOCK_SESSION = {
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjk5OTk5OTk5OTl9.fake",
  refresh_token: "fake-refresh-token",
  expires_in: 9999999,
  expires_at: 9999999999,
  token_type: "bearer",
  user: MOCK_USER,
};

/**
 * Sets up mocked Supabase auth so the app sees a logged-in user.
 * Must be called before page.goto().
 */
export async function mockAuth(page: Page) {
  // 1. Inject the session into localStorage before any scripts run
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: STORAGE_KEY, session: MOCK_SESSION }
  );

  // 2. Intercept Supabase /auth/v1/user (called when validating the session)
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    })
  );

  // 3. Intercept the admin-role check
  await page.route(`${SUPABASE_URL}/rest/v1/user_roles*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );

  // 4. Intercept models list to return empty (fast load)
  await page.route(`${SUPABASE_URL}/rest/v1/models*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );

  // 5. Intercept model_categories
  await page.route(`${SUPABASE_URL}/rest/v1/model_categories*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );
}

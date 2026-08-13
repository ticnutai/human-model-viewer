import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:7011",
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
    // Give the app time to load 3D models
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          // WebGL is needed for Three.js
          args: ["--use-gl=swiftshader", "--disable-web-security"],
        },
      },
    },
    {
      name: "mobile-android",
      testMatch: /.*mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        locale: "he-IL",
        colorScheme: "dark",
        launchOptions: {
          args: ["--use-gl=swiftshader", "--disable-web-security"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 7011 --strictPort",
    url: "http://127.0.0.1:7011",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

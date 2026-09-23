import { expect, test } from "@playwright/test";
import { demoConfig, simulate } from "../../src/demo/engine";
import {
  ScenarioSchema,
  type Scenario,
  type ScenarioRequest,
} from "../../src/types/simulation";
import { number } from "../../src/utils/format";

test("API failure stays in API mode and does not silently switch to demo", async ({
  page,
}) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Backend unavailable for maintenance." },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText(
    "Backend unavailable for maintenance.",
  );
  await expect(
    page.getByRole("button", { name: "Start a new scenario" }),
  ).toHaveCount(0);
});

test("live flow sends only IDs; calculated results survive an AI service failure", async ({
  page,
}) => {
  let saved: Scenario | undefined;
  let submitted: ScenarioRequest | undefined;
  let creates = 0;
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/config") return route.fulfill({ json: demoConfig });
    if (path === "/api/preview")
      return route.fulfill({ json: simulate(route.request().postDataJSON()) });
    if (path === "/api/scenarios") {
      creates++;
      submitted = route.request().postDataJSON();
      saved = ScenarioSchema.parse({
        ...simulate(submitted!),
        id: "server-result",
        created_at: new Date().toISOString(),
        decisions: submitted!.decisions,
      });
      return route.fulfill({ status: 201, json: saved });
    }
    if (path.endsWith("/analysis"))
      return route.fulfill({
        status: 503,
        json: { detail: "AI provider unavailable. Retry shortly." },
      });
    return route.fulfill({ json: saved });
  });
  await page.goto("/#/simulate");
  for (const [category, initiative] of [
    ["Transport", "Bus-priority lanes"],
    ["Greening", "Neighborhood pocket park"],
    ["Social infrastructure", "Local clinic upgrade"],
    ["Safety", "Safer pedestrian crossings"],
    ["City services", "District maintenance crew"],
  ]) {
    await page.getByRole("tab", { name: category }).click();
    await page
      .getByRole("button", { name: `Select ${initiative}`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "See my city’s future" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysis is temporarily unavailable" }),
  ).toBeVisible();
  await expect(page.getByTestId("quality-score")).toHaveText(
    number(saved!.final.score),
  );
  await expect(
    page.getByRole("button", { name: "Retry analysis" }),
  ).toBeVisible();
  expect(creates).toBe(1);
  expect(Object.keys(submitted!).sort()).toEqual([
    "dataset_version",
    "decisions",
  ]);
  expect(
    submitted!.decisions.every(
      (d) => Object.keys(d).sort().join() === "district_id,initiative_id",
    ),
  ).toBe(true);
});

test("a slow obsolete preview cannot replace the latest decision results", async ({
  page,
}) => {
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: demoConfig }),
  );
  let slowRequestStarted = false;
  await page.route("**/api/preview", async (route) => {
    const request: ScenarioRequest = route.request().postDataJSON();
    if (request.decisions[0]?.initiative_id === "transport_bus_stops") {
      slowRequestStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    await route.fulfill({ json: simulate(request) }).catch(() => {});
  });
  await page.goto("/#/simulate");
  await page
    .getByRole("button", { name: "Select Better bus stops", exact: true })
    .click();
  await expect.poll(() => slowRequestStarted).toBe(true);
  await page
    .getByRole("button", { name: "Select Bus-priority lanes", exact: true })
    .click();
  const expected = number(
    simulate({
      dataset_version: "v1",
      decisions: [
        { initiative_id: "transport_bus_priority", district_id: "district_01" },
      ],
    }).final.score,
  );
  await expect(page.getByTestId("quality-score")).toHaveText(expected);
  await page.waitForTimeout(1100); // Deliberately allow the obsolete response to arrive.
  await expect(page.getByTestId("quality-score")).toHaveText(expected);
});

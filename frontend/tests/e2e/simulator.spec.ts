import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, category: string, name: string) {
  await page.getByRole("tab", { name: category, exact: false }).click();
  await page
    .getByRole("button", { name: `Select ${name}`, exact: true })
    .click();
}
test("completes, persists and compares plans; prevents overspending and releases replacement cost", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start a new scenario" }).click();
  await expect(
    page.getByRole("button", { name: "See my city’s future" }),
  ).toBeDisabled();
  await choose(page, "Transport", "Junction redesign");
  await choose(page, "Greening", "Green corridor");
  await choose(page, "Social infrastructure", "Education facility expansion");
  await page.getByRole("tab", { name: "Safety" }).click();
  await expect(
    page.getByRole("button", {
      name: "Select Safe-street redesign",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Select Better street lighting", exact: true })
    .click();
  await page.getByRole("tab", { name: "City services" }).click();
  await expect(
    page.getByRole("button", {
      name: "Select Reliable waste collection",
      exact: true,
    }),
  ).toBeDisabled();
  await choose(page, "Transport", "Bus-priority lanes");
  await choose(page, "City services", "Reliable waste collection");
  await expect(
    page.getByRole("button", { name: "See my city’s future" }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByText("5/5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "See my city’s future" }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s the city you shaped." }),
  ).toBeVisible();
  await expect(
    page.getByText("Rule-based explanation · no AI model was called"),
  ).toBeVisible();
  const first = await page.getByTestId("quality-score").textContent();
  await page.reload();
  await expect(page.getByTestId("quality-score")).toHaveText(first!);
  await page.getByRole("button", { name: "Refine this plan" }).click();
  await choose(page, "Transport", "Better bus stops");
  await page.getByRole("button", { name: "See my city’s future" }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s the city you shaped." }),
  ).toBeVisible();
  await expect(page.getByTestId("quality-score")).not.toHaveText(first!);
  await page.getByRole("link", { name: "Compare plans", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The numbers, side by side" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile layout has no horizontal overflow and supports keyboard category navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Five decisions.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Start a new scenario" }).click();
  await page.getByRole("tab", { name: "Transport" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Greening" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "See my city’s future" }),
  ).toBeVisible();
});

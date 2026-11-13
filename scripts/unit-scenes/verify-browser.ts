import { chromium, expect } from "@playwright/test";
const url = process.argv[2];
if (!url) throw new Error("Pass the preview URL");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const frames = () =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = () => {
          if (++n === 20) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url);
await expect(page.getByRole("heading", { name: "Great Heathmead, Haywards Heath" })).toBeVisible();
await expect(page.locator("canvas")).toBeVisible();
await page.waitForFunction(() => {
  const canvas = document.querySelector("canvas");
  return canvas && canvas.width > 300;
});
await frames();
await page.screenshot({ path: "/tmp/landing-unit-evidence/birds-eye.png", fullPage: false });
await page.getByRole("button", { name: "Floor plan", exact: true }).click();
await expect(page.getByRole("img", { name: /Editable floor plan/ })).toBeVisible();
await page.getByRole("button", { name: "Add sofa", exact: true }).click();
await page.getByLabel("Item name", { exact: true }).fill("Browser test sofa");
await page.getByLabel("width (m)", { exact: true }).fill("1.8");
await page.getByLabel("x (m)", { exact: true }).fill("2");
await page.getByLabel("z (m)", { exact: true }).fill("2");
await page.getByLabel("Rotation (°)", { exact: true }).fill("30");
await page.getByRole("button", { name: "Save layout", exact: true }).click();
await expect(page.getByRole("status")).toHaveText("Layout saved");
await page.reload();
await page.getByLabel("Selected furniture").selectOption({ label: "Browser test sofa" });
await expect(page.getByLabel("width (m)", { exact: true })).toHaveValue("1.8");
await expect(page.getByLabel("Rotation (°)", { exact: true })).toHaveValue("30");
await page.getByRole("button", { name: "Floor plan", exact: true }).click();
await page.screenshot({ path: "/tmp/landing-unit-evidence/floor-plan.png", fullPage: false });
await page.getByLabel("x (m)", { exact: true }).fill("-2");
await expect(page.getByText("Browser test sofa: Item extends outside a room")).toBeVisible();
await page.getByRole("button", { name: "Walkthrough", exact: true }).click();
await page.getByLabel("Current room", { exact: true }).selectOption({ label: "Entrance Hall" });
const canvas = page.locator("canvas");
await expect(canvas).toHaveAttribute("aria-label", /Walkthrough/);
await canvas.click();
await frames();
const before = await canvas.screenshot();
await page.keyboard.down("a");
await frames();
await page.keyboard.up("a");
await frames();
const after = await canvas.screenshot();
if (before.equals(after)) throw new Error("Walkthrough did not respond to keyboard turning");
await page.screenshot({ path: "/tmp/landing-unit-evidence/walkthrough.png", fullPage: false });
await page.getByRole("button", { name: "Reset to Muse output", exact: true }).click();
await page.getByText("Edit room corners", { exact: true }).click();
await page.getByLabel("Corner 1 x (m)", { exact: true }).fill("0.2");
await page.getByRole("button", { name: "Save layout", exact: true }).click();
await expect(page.getByRole("status")).toHaveText("Layout saved");
await page.reload();
await page.getByText("Edit room corners", { exact: true }).click();
await expect(page.getByLabel("Corner 1 x (m)", { exact: true })).toHaveValue("0.2");
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Floor plan", exact: true }).click();
await page.screenshot({ path: "/tmp/landing-unit-evidence/mobile.png", fullPage: false });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
if (overflow) throw new Error("Mobile horizontal overflow");
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "PASS: render, view modes, furniture editing, collision warning, save/reload, corner editing, mobile layout; no page errors",
);
await browser.close();

"use strict";
const assert = require("node:assert/strict");
const chromiumPackage = require("@sparticuz/chromium");
const chromium = chromiumPackage.default;
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { chromium: playwright } = require("playwright-core");

(async () => {
  fs.mkdirSync(path.join(__dirname, "../.tools"), { recursive: true });
  if (process.platform === "linux") {
    const libraryDir = await chromiumPackage.inflate(
      path.join(
        __dirname,
        "../node_modules/@sparticuz/chromium/bin/al2023.tar.br",
      ),
    );
    process.env.LD_LIBRARY_PATH =
      path.join(libraryDir, "lib") + ":" + (process.env.LD_LIBRARY_PATH || "");
  }
  let server;
  if (!process.env.BASE_URL) {
    server = spawn(process.execPath, ["scripts/serve.cjs"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: "3001" },
      stdio: ["ignore", "pipe", "inherit"],
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.once("exit", (code) =>
        reject(new Error("Test server exited: " + code)),
      );
      server.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("listening")) resolve();
      });
    });
  }
  let browser;
  try {
    browser = await playwright.launch({
      args: chromium.args.filter((arg) => arg !== "--single-process"),
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 940 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const base = process.env.BASE_URL || "http://127.0.0.1:3001";
    try {
      await page.goto(base + "/classic.html");
      await page.waitForSelector(".body-item");
      assert.equal(await page.locator(".body-item").count(), 9);
      assert.equal(await page.locator("#body-name").textContent(), "Earth");
      await page.locator("#play-btn").click();
      const elapsed = await page.locator("#elapsed").textContent();
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#elapsed").textContent(), elapsed);
      await page.locator('[data-id="jupiter"]').click();
      assert.equal(await page.locator("#body-name").textContent(), "Jupiter");
      await page.locator("#follow-btn").click();
      assert.equal(
        await page.locator("#view-title").textContent(),
        "FOLLOWING JUPITER",
      );
      await page.locator("#fit-btn").click();
      await page.locator("#zoom-in").click();
      assert.equal(await page.locator("#zoom-label").textContent(), "125%");
      await page.locator("#fit-btn").click();
      await page.locator("#save-btn").click();
      await page.locator("#add-btn").click();
      await page.locator("#new-name").fill("Test world");
      await page.locator("#new-mass").fill("42");
      await page.locator('#add-form [type="submit"]').click();
      const box = await page.locator("#space").boundingBox();
      await page.mouse.click(
        box.x + box.width * 0.7,
        box.y + box.height * 0.35,
      );
      assert.equal(await page.locator(".body-item").count(), 10);
      assert.equal(
        await page.locator("#body-name").textContent(),
        "Test world",
      );
      assert.match(await page.locator("#mass-value").textContent(), /42.00/);
      await page.locator("#save-btn").click();
      await page.locator("#remove-btn").click();
      assert.equal(await page.locator(".body-item").count(), 9);
      await page.locator("#load-btn").click();
      assert.equal(await page.locator(".body-item").count(), 10);
      await page.locator("#reset-btn").click();
      await page.locator("#confirm-reset").click();
      assert.equal(await page.locator(".body-item").count(), 9);
      await page.locator("#play-btn").click();
      await page.locator("#orbits-toggle").uncheck();
      await page.locator("#trails-toggle").uncheck();
      await page.locator("#labels-toggle").uncheck();
      await page.locator("#scale-toggle").uncheck();
      await page.locator("#scale-toggle").check();
      await page.locator("#orbits-toggle").check();
      await page.locator("#trails-toggle").check();
      await page.locator("#labels-toggle").check();
      // Malformed stored data leaves the current simulation untouched.
      await page.evaluate(() =>
        localStorage.setItem("solar-sandbox-v1", '{"version":9}'),
      );
      await page.locator("#load-btn").click();
      assert.match(
        await page.locator("#toast").textContent(),
        /Could not load/,
      );
      assert.equal(await page.locator(".body-item").count(), 9);
      await page.locator("#help-btn").click();
      assert.equal(
        await page.locator("#help-dialog").evaluate((el) => el.open),
        true,
      );
      await page.locator("#close-help").click();
      await page.waitForTimeout(3600);
      await page.screenshot({ path: ".tools/desktop.png" });
      console.log(
        "PASS desktop: selection, pause, zoom, follow, spawn, remove, save/load, reset, toggles, invalid save, help",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth > innerWidth),
        false,
      );
      await page.locator("#bodies-btn").click();
      await page.locator('[data-id="saturn"]').click();
      assert.equal(await page.locator("#body-name").textContent(), "Saturn");
      assert.equal(
        await page
          .locator("#body-panel")
          .evaluate((el) => el.classList.contains("open")),
        false,
      );
      assert.equal(await page.locator("#inspector").isVisible(), true);
      await page.locator("#close-inspector").click();
      assert.equal(await page.locator("#inspector").isVisible(), false);
      await page.screenshot({ path: ".tools/mobile.png" });
      console.log("PASS mobile: responsive layout, body drawer, selection");
      assert.deepEqual(errors, []);
      console.log("PASS no browser JavaScript errors");
      await page.close();
      await require("./aero-ui.cjs")(browser, base);
    } finally {
      if (browser) await browser.close();
    }
  } finally {
    if (server) server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

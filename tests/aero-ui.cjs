const assert = require("node:assert/strict");
module.exports = async function testAero(browser, base) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(base).origin) remote.push(r.url());
  });
  try {
    await page.goto(base);
    await page.waitForSelector("#body-select option", { state: "attached" });
    assert.equal(await page.locator("#body-select option").count(), 40);
    assert.equal(await page.locator("#body-name").textContent(), "Earth");
    await page.locator("#play").click();
    const epoch = await page.locator("#epoch").textContent();
    await page.waitForTimeout(300);
    assert.equal(await page.locator("#epoch").textContent(), epoch);
    await page.locator("#body-select").selectOption("saturn");
    assert.equal(await page.locator("#moon-count").textContent(), "7 moons");
    await page.locator("#focus").click();
    assert.match(await page.locator("#tracking-badge").textContent(), /Saturn/);
    await page.waitForTimeout(250);
    await page.locator("#reset-view").click();
    await page.locator("[data-tab=create]").click();
    assert.equal(await page.locator("[data-type]").count(), 8);
    await page.locator("[data-type=ice]").click();
    await page.locator("#new-name").fill("Screenshot world");
    await page.locator("#add-body").click();
    assert.equal(await page.locator("#body-select option").count(), 41);
    await page.locator("[data-tab=inspect]").click();
    assert.equal(
      await page.locator("#body-name").textContent(),
      "Screenshot world",
    );
    await page.locator("#save-part").click();
    await page.locator("[data-tab=library]").click();
    assert.equal(await page.locator("[data-part]").count(), 4);
    await page.locator("[data-pack=blue]").click();
    assert.match(
      await page.locator("[data-pack=blue]").getAttribute("class"),
      /active/,
    );
    await page.locator('[data-part="0"]').click();
    assert.equal(await page.locator("#body-select option").count(), 42);
    await page.locator("#save").click();
    await page.locator("#settings-btn").click();
    await page.locator("#start-date").fill("2029-11-29");
    await page.locator("#set-date").click();
    assert.match(await page.locator("#epoch").textContent(), /29 NOV 2029/);
    await page.locator("#auto-track").selectOption("saturn");
    assert.match(await page.locator("#tracking-badge").textContent(), /Saturn/);
    await page.locator("#orbits").uncheck();
    assert.equal(
      await page.locator("#toggle-orbits").getAttribute("aria-pressed"),
      "false",
    );
    await page.locator("#orbits").check();
    await page.locator("#measure-a").selectOption("sun");
    await page.locator("#measure-b").selectOption("earth");
    assert.match(await page.locator("#separation-au").textContent(), /AU/);
    await page.locator("#close-settings").click();
    await page.locator("#themes-btn").click();
    await page.locator("[data-theme-choice=aurora]").click();
    assert.equal(
      await page.locator("body").getAttribute("data-theme"),
      "aurora",
    );
    await page.locator("#load").click();
    assert.equal(await page.locator("#body-select option").count(), 42);
    assert.equal(
      await page.locator("body").getAttribute("data-theme"),
      "night",
    );
    await page.locator("#scenario").selectOption("inner");
    await page.locator("#confirm-ok").click();
    assert.equal(await page.locator("#body-select option").count(), 9);
    await page.locator("#gravity").click();
    assert.equal(
      await page.locator("#gravity").getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#gravity").click();
    await page.locator("#scenario").selectOption("solar");
    await page.locator("[data-tab=inspect]").click();
    await page.locator("#body-select").selectOption("jupiter");
    await page.locator("#remove").click();
    await page.locator("#confirm-ok").click();
    assert.equal(await page.locator("#body-select option").count(), 35);
    // Invalid saves must not mutate the running model.
    await page.evaluate(() =>
      localStorage.setItem("aero-save-v2", '{"state":{"version":77}}'),
    );
    await page.locator("#load").click();
    assert.equal(await page.locator("#body-select option").count(), 35);
    assert.match(
      await page.locator("#notification").textContent(),
      /Could not load/,
    );
    await page.locator("#scenario").selectOption("solar");
    await page.locator("#help-btn").click();
    await page.locator("#close-help").click();
    await page.locator("[data-tab=create]").click();
    await page.locator("[data-tab=library]").click();
    await page.locator(".classic-link").click();
    await page.waitForSelector(".body-item");
    assert.equal(await page.locator(".body-item").count(), 9);
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log(
      "PASS Aero desktop: 40 bodies, satellites, focus/follow, creation, local library, colour packs, dates, tracking, settings, themes, saves, scenarios, gravity, removal and Classic navigation; no JS errors or external requests",
    );
    await page.close();
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const touch = await mobile.newPage();
    touch.on("pageerror", (e) => errors.push(e.message));
    await touch.goto(base);
    await touch.waitForSelector("#body-select option", { state: "attached" });
    assert.equal(await touch.locator("#sidebar").isVisible(), false);
    await touch.locator("#play").tap();
    await touch.locator("#sidebar-btn").tap();
    await touch.locator("[data-tab=create]").tap();
    await touch.locator("#new-name").fill("Touch world");
    await touch.locator("#add-body").tap();
    assert.equal(await touch.locator("#body-select option").count(), 41);
    await touch.locator("[data-tab=inspect]").tap();
    assert.equal(
      await touch.locator("#body-name").textContent(),
      "Touch world",
    );
    await touch.locator("#sidebar-btn").tap();
    assert.equal(
      await touch.evaluate(() => document.body.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    await mobile.close();
    console.log(
      "PASS Aero touch: responsive drawer, tabs, planet creation, no horizontal overflow or browser errors",
    );
  } finally {
    if (!page.isClosed()) await page.close();
  }
};

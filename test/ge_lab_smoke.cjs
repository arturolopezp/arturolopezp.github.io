const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

async function main() {
  const repo = path.resolve(__dirname, "..");
  const chromeOnWindows = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const bundledBrowser = chromium.executablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(bundledBrowser) ? bundledBrowser : chromeOnWindows,
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const source = fs.readFileSync(path.join(repo, "_pages", "one-period-ge-lab.html"), "utf8");
  const html = source
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/<link rel="stylesheet"[^>]*>/, "")
    .replace(/<script defer[^>]*><\/script>/, "");
  await page.setContent(html);
  await page.addStyleTag({ path: path.join(repo, "assets", "css", "ge-lab.css") });
  const script = fs.readFileSync(path.join(repo, "assets", "js", "ge-lab.js"), "utf8");
  assert.ok(script.includes("  setConfiguration(initial);"));
  await page.addScriptTag({
    content: script.replace(
      "  setConfiguration(initial);",
      "  window.__geLabTest = { equilibrium, marketsAtWage, production, marginalProduct };\n  setConfiguration(initial);"
    ),
  });

  const calibrationChecks = await page.evaluate(() => {
    const { equilibrium, marketsAtWage, production, marginalProduct } = window.__geLabTest;
    let checked = 0;
    for (const technology of ["power", "sqrt"]) {
      for (const preferences of ["log", "crra"]) {
        for (const z of [1, 2, 4]) {
          for (const g of [0, 0.3, 0.8]) {
            for (const psi of [0.3, 1, 3]) {
              for (const sigma of preferences === "log" ? [1] : [0.5, 1, 2.5]) {
                for (const eta of preferences === "log" ? [1] : [0.5, 1, 2.5]) {
                  for (const alpha of technology === "power" ? [0.3, 0.5, 0.8] : [0.5]) {
                    const p = { technology, preferences, z, g, psi, alpha, sigma, eta };
                    const eq = equilibrium(p);
                    if (!eq) throw new Error(`Missing equilibrium: ${JSON.stringify(p)}`);
                    const m = marketsAtWage(eq.w, p);
                    if (!m || Math.abs(m.nd - m.ns) > 1e-7 || Math.abs(m.ys - m.yd) > 1e-7) {
                      throw new Error(`Markets fail to clear: ${JSON.stringify(p)}`);
                    }
                    if (Math.abs(eq.y - production(eq.n, p)) > 1e-9 || Math.abs(eq.w - marginalProduct(eq.n, p)) > 1e-9) {
                      throw new Error(`Inconsistent allocation: ${JSON.stringify(p)}`);
                    }
                    const lhs = eq.w * Math.pow(eq.c, -sigma);
                    const rhs = psi * Math.pow(eq.leisure, -eta);
                    if (Math.abs(lhs - rhs) > 1e-8 * Math.max(1, lhs, rhs)) {
                      throw new Error(`Household first-order condition fails: ${JSON.stringify(p)}`);
                    }
                    if (Math.abs(eq.c - (eq.y - g)) > 1e-9 || Math.abs(eq.profit - (eq.y - eq.w * eq.n)) > 1e-9) {
                      throw new Error(`Resource constraint or profits fail: ${JSON.stringify(p)}`);
                    }
                    if (technology === "sqrt") {
                      if (Math.abs(eq.y - z * z / (2 * eq.w)) > 1e-9 || Math.abs(eq.profit - z * z / (4 * eq.w)) > 1e-9) {
                        throw new Error(`Square-root firm schedules fail: ${JSON.stringify(p)}`);
                      }
                    }
                    checked++;
                  }
                }
              }
            }
          }
        }
      }
    }
    return checked;
  });
  assert.equal(calibrationChecks, 1080);

  const wage = Number(await page.locator("#ge-results .ge-result").first().locator("strong").textContent());
  const expectedWage = (-0.3 + Math.sqrt(0.3 ** 2 + 3 * 2 ** 2)) / 2;
  assert.ok(Math.abs(wage - expectedWage) < 0.001, `baseline wage ${wage} vs ${expectedWage}`);
  assert.equal(await page.locator("#ge-labor-plot path.ge-curve").count(), 2);
  assert.match(await page.locator("#ge-equations").textContent(), /Closed-form competitive equilibrium/);
  assert.match(await page.locator("#ge-equations").innerHTML(), /w\^\*=\\frac/);
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\\(U\(C,\\ell\)=/);
  assert.match(await page.locator("#ge-production-formula").textContent(), /\\\(Y=zN\^\\alpha\\\)/);
  assert.equal(await page.locator(".ge-range-field label > span").count(), 12);
  assert.match(
    await page.locator("#ge-equations p").filter({ hasText: "Equilibrium condition:" }).textContent(),
    /\\frac\{z\}\{2\\sqrt\{N\^\*\}\}/
  );
  if (process.env.GE_LAB_SCREENSHOT) await page.screenshot({ path: process.env.GE_LAB_SCREENSHOT, fullPage: true });

  await page.locator("#ge-g").evaluate((el) => {
    el.value = "0.42";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#ge-labor-plot path.ge-curve").count(), 4);
  assert.equal(await page.locator("#ge-labor-plot circle").count(), 2);

  await page.locator("#ge-preferences").selectOption("crra");
  await page.locator("#ge-technology").selectOption("sqrt");
  assert.match(await page.locator("#ge-equations").textContent(), /Fully specified equilibrium for the square-root model/);
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\frac\{C\^\{1-\\sigma\}-1\}/);
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\frac\{\\ell\^\{1-\\eta\}-1\}/);
  assert.match(await page.locator("#ge-production-formula").textContent(), /Y=z\\sqrt N/);
  assert.match(await page.locator("#ge-equations").textContent(), /\\Phi_w\(\\ell\)/);
  assert.match(await page.locator("#ge-equations").textContent(), /\\pi\^\*=\\frac\{Y\^\*\}\{2\}/);
  assert.ok(Number.isFinite(Number(await page.locator("#ge-results .ge-result").first().locator("strong").textContent())));
  assert.ok((await page.locator("#ge-goods-plot path.ge-curve").count()) >= 2);

  await page.locator("#ge-sigma").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\log C/);
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\ell\^\{1-\\eta\}/);
  await page.locator("#ge-eta").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\log C\+\\psi \\log\\ell/);
  assert.match(await page.locator("#ge-equations").textContent(), /Closed-form competitive equilibrium/);

  await page.locator("#ge-new-exercise").click();
  assert.equal(await page.locator("#ge-predictions select").count(), 9);
  assert.match(await page.locator("#ge-exercise-prompt").textContent(), /\\longrightarrow/);
  await page.locator("#ge-predictions select").evaluateAll((items) => items.forEach((el) => (el.value = "up")));
  await page.locator("#ge-check-exercise").click();
  assert.match(await page.locator("#ge-feedback").textContent(), /of 9 correct/);
  assert.equal(await page.locator("#ge-labor-plot circle").count(), 2);
  assert.deepEqual(errors, []);

  await browser.close();
  console.log("GE lab smoke test passed: baseline algebra, charts, variants, and practice mode.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

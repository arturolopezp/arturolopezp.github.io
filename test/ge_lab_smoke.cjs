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

  const source = fs.readFileSync(path.join(repo, "_pages", "one-period-ge-lab.md"), "utf8");
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

  async function assertOneEquationPerLine() {
    const mathBlocksPerLine = await page.locator("#ge-equations .ge-solution-box p").evaluateAll((rows) =>
      rows.map((row) => (row.textContent.match(/\\\(/g) || []).length)
    );
    assert.ok(mathBlocksPerLine.every((count) => count <= 1), `multiple equations found on one line: ${mathBlocksPerLine}`);
    assert.doesNotMatch((await page.locator("#ge-equations .ge-solution-box").allTextContents()).join("\n"), /\\qquad|\\quad/);
  }

  const calibrationChecks = await page.evaluate(() => {
    const { equilibrium, marketsAtWage, production, marginalProduct } = window.__geLabTest;
    let checked = 0;
    for (const preferences of ["kpr", "ghh", "crra"]) {
        for (const z of [1, 2]) {
          for (const g of [0, 0.1]) {
            for (const psi of [2, 3]) {
              for (const sigma of [0.5, 1, 2.5]) {
                for (const phi of preferences === "ghh" || preferences === "crra" ? [0.5, 1, 2] : [1]) {
                  for (const alpha of [0.3, 0.5]) {
                    const p = { preferences, z, g, psi, alpha, sigma, phi };
                    const eq = equilibrium(p);
                    if (!eq) throw new Error(`Missing equilibrium: ${JSON.stringify(p)}`);
                    const m = marketsAtWage(eq.w, p);
                    if (!m || Math.abs(m.nd - m.ns) > 1e-7 || Math.abs(m.ys - m.yd) > 1e-7) {
                      throw new Error(`Markets fail to clear: ${JSON.stringify(p)}`);
                    }
                    if (Math.abs(eq.y - production(eq.n, p)) > 1e-9 || Math.abs(eq.w - marginalProduct(eq.n, p)) > 1e-9) {
                      throw new Error(`Inconsistent allocation: ${JSON.stringify(p)}`);
                    }
                    const householdResidual =
                      preferences === "ghh"
                        ? eq.w - psi * Math.pow(eq.n, phi)
                        : preferences === "kpr"
                          ? eq.w * eq.leisure - psi * eq.c
                          : eq.w * Math.pow(eq.c, -sigma) - Math.pow(eq.n, phi);
                    if (Math.abs(householdResidual) > 1e-8) {
                      throw new Error(`Household first-order condition fails: ${JSON.stringify(p)}`);
                    }
                    if (Math.abs(eq.c - (eq.y - g)) > 1e-9 || Math.abs(eq.profit - (eq.y - eq.w * eq.n)) > 1e-9) {
                      throw new Error(`Resource constraint or profits fail: ${JSON.stringify(p)}`);
                    }
                    if (preferences === "ghh") {
                      const closedN = Math.pow((alpha * z) / psi, 1 / (1 + phi - alpha));
                      if (Math.abs(eq.n - closedN) > 1e-9) {
                        throw new Error(`GHH closed form fails: ${JSON.stringify(p)}`);
                      }
                    } else if (preferences === "kpr") {
                      const wageEquation =
                        Math.pow(eq.w, 1 / (1 - alpha)) +
                        psi * g * Math.pow(eq.w, alpha / (1 - alpha)) -
                        (alpha + psi) * z * Math.pow(alpha * z, alpha / (1 - alpha));
                      if (Math.abs(wageEquation) > 1e-8) {
                        throw new Error(`KPR power wage equation fails: ${JSON.stringify(p)}`);
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
    return checked;
  });
  assert.equal(calibrationChecks, 336);

  const scheduleChecks = await page.evaluate(() => {
    const { equilibrium, marketsAtWage } = window.__geLabTest;
    const specifications = [
      { preferences: "kpr", z: 2, g: 0.3, psi: 1.5, sigma: 2, alpha: 0.4, phi: 1 },
      { preferences: "ghh", z: 2, g: 0.3, psi: 1.5, sigma: 2, alpha: 0.4, phi: 1 },
      { preferences: "crra", z: 2, g: 0.3, psi: 1.5, sigma: 2, alpha: 0.4, phi: 1 },
    ];
    let checked = 0;
    for (const p of specifications) {
      const eq = equilibrium(p);
      for (const factor of [0.9, 1.1]) {
        const w = eq.w * factor;
        const market = marketsAtWage(w, p);
        if (!market) throw new Error(`Missing interior schedule: ${JSON.stringify({ p, w })}`);
        const nd = Math.pow((p.alpha * p.z) / w, 1 / (1 - p.alpha));
        const ys = p.z * Math.pow((p.alpha * p.z) / w, p.alpha / (1 - p.alpha));
        const profit = ys - w * nd;
        if (Math.abs(market.nd - nd) > 1e-8 || Math.abs(market.ys - ys) > 1e-8) {
          throw new Error(`Firm schedule mismatch: ${JSON.stringify({ p, w })}`);
        }
        if (p.preferences === "kpr") {
          const c = (w + profit - p.g) / (1 + p.psi);
          const ns = 1 - (p.psi * (w + profit - p.g)) / ((1 + p.psi) * w);
          if (Math.abs(market.ns - ns) > 1e-8 || Math.abs(market.yd - (c + p.g)) > 1e-8) {
            throw new Error(`KPR schedule mismatch: ${JSON.stringify({ p, w })}`);
          }
        } else if (p.preferences === "ghh") {
          const ns = Math.pow(w / p.psi, 1 / p.phi);
          const c = w * ns + profit - p.g;
          if (Math.abs(market.ns - ns) > 1e-8 || Math.abs(market.yd - (c + p.g)) > 1e-8) {
            throw new Error(`GHH schedule mismatch: ${JSON.stringify({ p, w })}`);
          }
        } else {
          const c = market.yd - p.g;
          const residual = w * Math.pow(c, -p.sigma) - Math.pow(market.ns, p.phi);
          if (Math.abs(residual) > 1e-8 || Math.abs(c - (w * market.ns + profit - p.g)) > 1e-8) {
            throw new Error(`Separable-CRRA schedule mismatch: ${JSON.stringify({ p, w })}`);
          }
        }
        checked++;
      }
    }
    return checked;
  });
  assert.equal(scheduleChecks, 6);

  const wage = Number(await page.locator("#ge-results .ge-result").first().locator("strong").textContent());
  const expectedWage = (-1.5 * 0.3 + Math.sqrt((1.5 * 0.3) ** 2 + (1 + 2 * 1.5) * 2 ** 2)) / 2;
  assert.ok(Math.abs(wage - expectedWage) < 0.001, `baseline wage ${wage} vs ${expectedWage}`);
  assert.equal(await page.locator("#ge-labor-plot path.ge-curve").count(), 2);
  const curvesTouchingSvgEdge = await page.locator("svg path.ge-curve").evaluateAll((paths) =>
    paths.some((path) =>
      [...path.getAttribute("d").matchAll(/[ML]([\d.]+),([\d.]+)/g)].some((match) => {
        const x = Number(match[1]);
        const y = Number(match[2]);
        return x <= 58 || x >= 568 || y <= 28 || y >= 298;
      })
    )
  );
  assert.equal(curvesTouchingSvgEdge, false);
  assert.match(await page.locator("#ge-equations").textContent(), /Competitive equilibrium/);
  assert.match(await page.locator("#ge-equations").textContent(), /\(w\^\*\)\^\{\\frac\{1\}\{1-\\alpha\}\}/);
  assert.match(await page.locator("#ge-preference-formula").textContent(), /\\log C\+\\psi\\log\\ell/);
  assert.match(await page.locator("#ge-production-formula").textContent(), /\\\(Y=zN\^\\alpha\\\)/);
  assert.equal(await page.locator("#ge-technology").count(), 0);
  assert.equal(await page.locator(".ge-range-field label > span").count(), 12);
  assert.equal(await page.locator("#ge-equations .ge-solution-box").count(), 2);
  assert.doesNotMatch(await page.locator("#ge-equations").textContent(), /I\(w\)|\\Phi_w|D=/);
  await assertOneEquationPerLine();
  if (process.env.GE_LAB_SCREENSHOT) await page.screenshot({ path: process.env.GE_LAB_SCREENSHOT, fullPage: true });

  await page.locator("#ge-g").evaluate((el) => {
    el.value = "0.42";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await page.locator("#ge-labor-plot path.ge-curve").count(), 4);
  assert.equal(await page.locator("#ge-labor-plot circle").count(), 2);
  assert.equal(
    await page.locator("svg circle").evaluateAll((markers) =>
      markers.some((marker) => {
        const x = Number(marker.getAttribute("cx"));
        const y = Number(marker.getAttribute("cy"));
        return x <= 58 || x >= 568 || y <= 28 || y >= 298;
      })
    ),
    false
  );

  await page.locator("#ge-sigma").evaluate((el) => {
    el.value = "2";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.ok((await page.locator("#ge-preference-formula").textContent()).includes(String.raw`\left(C\ell^\psi\right)^{1-\sigma}`));

  await page.locator("#ge-preferences").selectOption("crra");
  assert.ok(
    (await page.locator("#ge-preference-formula").textContent()).includes(
      String.raw`U(C,N)=\frac{C^{1-\sigma}}{1-\sigma}-\frac{N^{1+\varphi}}{1+\varphi}`
    )
  );
  assert.ok((await page.locator("#ge-equations").textContent()).includes(String.raw`wC^{-\sigma}=N^\varphi`));
  assert.ok(
    (await page.locator("#ge-equations").textContent()).includes(
      String.raw`wN^s(w)+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G=w^{\frac{1}{\sigma}}\left[N^s(w)\right]^{-\frac{\varphi}{\sigma}}`
    )
  );
  assert.equal(await page.locator("#ge-equations .ge-solution-box").count(), 2);
  assert.equal(await page.locator("#ge-psi-field").evaluate((el) => el.hidden), true);
  assert.equal(await page.locator("#ge-phi-field").evaluate((el) => el.hidden), false);
  assert.doesNotMatch(await page.locator("#ge-equations").textContent(), /\\eta|\\psi|I\(w\)|\\Phi_w|D=/);
  await assertOneEquationPerLine();

  await page.locator("#ge-sigma").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.ok((await page.locator("#ge-preference-formula").textContent()).includes(String.raw`U(C,N)=\log C-\frac{N^{1+\varphi}}{1+\varphi}`));
  await page.locator("#ge-sigma").evaluate((el) => {
    el.value = "2";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.locator("#ge-preferences").selectOption("ghh");
  assert.match(await page.locator("#ge-preference-formula").textContent(), /C-\\frac\{\\psi\}\{1\+\\varphi\}N\^\{1\+\\varphi\}/);
  assert.ok(
    (await page.locator("#ge-equations").textContent()).includes(
      String.raw`N^*=\left(\frac{\alpha z}{\psi}\right)^{\frac{1}{1+\varphi-\alpha}}`
    )
  );
  assert.ok(
    (await page.locator("#ge-equations").textContent()).includes(
      String.raw`C^*=z\left(\frac{\alpha z}{\psi}\right)^{\frac{\alpha}{1+\varphi-\alpha}}-G`
    )
  );
  assert.equal(await page.locator("#ge-equations .ge-solution-box").count(), 2);
  assert.doesNotMatch(await page.locator("#ge-equations").textContent(), /I\(w\)|\\Phi_w|D=/);
  await assertOneEquationPerLine();
  assert.ok(
    (await page.locator("#ge-equations").textContent()).includes(
      String.raw`w^*=\psi^{\frac{1-\alpha}{1+\varphi-\alpha}}(\alpha z)^{\frac{\varphi}{1+\varphi-\alpha}}`
    )
  );
  assert.ok(
    (await page.locator("#ge-equations").textContent()).includes(
      String.raw`C^*=z\left(\frac{\alpha z}{\psi}\right)^{\frac{\alpha}{1+\varphi-\alpha}}-G`
    )
  );

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

/* One-period general-equilibrium teaching lab. No server or external chart library is required. */
(() => {
  "use strict";

  const root = document.getElementById("ge-lab");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const fields = ["z", "g", "psi", "sigma", "alpha", "phi"];
  const initial = {
    preferences: "kpr",
    z: 2,
    g: 0.3,
    psi: 1.5,
    sigma: 1,
    alpha: 0.5,
    phi: 1,
  };
  let baseline = { ...initial };
  let exercise = null;
  let equationKey = "";
  let preferenceFormulaKey = "";
  let productionFormulaKey = "";
  let mathQueue = Promise.resolve();

  function configuration() {
    const result = {
      preferences: $("ge-preferences").value,
    };
    fields.forEach((name) => {
      result[name] = Number($("ge-" + name).value);
    });
    return result;
  }

  function setConfiguration(config) {
    $("ge-preferences").value = config.preferences;
    fields.forEach((name) => {
      $("ge-" + name).value = config[name];
    });
  }

  function production(n, p) {
    if (n < 0) return NaN;
    return p.z * Math.pow(n, p.alpha);
  }

  function marginalProduct(n, p) {
    return p.z * p.alpha * Math.pow(n, p.alpha - 1);
  }

  function crraUtility(value, curvature) {
    return Math.abs(curvature - 1) < 1e-10 ? Math.log(value) : Math.expm1((1 - curvature) * Math.log(value)) / (1 - curvature);
  }

  function utility(c, leisure, p) {
    if (c <= 0 || leisure <= 0) return NaN;
    if (p.preferences === "ghh") {
      const n = 1 - leisure;
      const x = c - (p.psi / (1 + p.phi)) * Math.pow(n, 1 + p.phi);
      return x > 0 ? crraUtility(x, p.sigma) : NaN;
    }
    if (p.preferences === "kpr") return crraUtility(c * Math.pow(leisure, p.psi), p.sigma);
    const n = 1 - leisure;
    return crraUtility(c, p.sigma) - Math.pow(n, 1 + p.phi) / (1 + p.phi);
  }

  function inverseCrraUtility(value, sigma) {
    if (Math.abs(sigma - 1) < 1e-10) return Math.exp(value);
    const inside = 1 + (1 - sigma) * value;
    return inside > 0 ? Math.pow(inside, 1 / (1 - sigma)) : NaN;
  }

  // Consumption along the indifference curve through (c*, leisure*) at utility level uStar.
  function indifferenceConsumption(leisure, uStar, p) {
    if (p.preferences === "ghh") {
      const level = inverseCrraUtility(uStar, p.sigma);
      const n = Math.min(1 - 1e-9, Math.max(0, 1 - leisure));
      return level + (p.psi / (1 + p.phi)) * Math.pow(n, 1 + p.phi);
    }
    if (p.preferences === "kpr") return inverseCrraUtility(uStar, p.sigma) / Math.pow(leisure, p.psi);
    const n = Math.min(1 - 1e-9, Math.max(0, 1 - leisure));
    return inverseCrraUtility(uStar + Math.pow(n, 1 + p.phi) / (1 + p.phi), p.sigma);
  }

  function bisect(fn, lo, hi) {
    for (let i = 0; i < 90; i++) {
      const mid = (lo + hi) / 2;
      if (fn(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function equilibrium(p) {
    if (p.g >= production(1, p)) return null;
    let n;
    if (p.preferences === "ghh") {
      n = Math.pow((p.alpha * p.z) / p.psi, 1 / (1 + p.phi - p.alpha));
    } else if (p.preferences === "kpr") {
      const lowerFeasible = p.g === 0 ? 0 : bisect((candidate) => p.g - production(candidate, p), 0, 1);
      const lo = Math.max(1e-10, lowerFeasible + 1e-10);
      const hi = 1 - 1e-10;
      const laborClearing = (candidate) =>
        marginalProduct(candidate, p) * (1 - candidate) - p.psi * (production(candidate, p) - p.g);
      if (!(laborClearing(lo) > 0 && laborClearing(hi) < 0)) return null;
      n = bisect(laborClearing, lo, hi);
    } else {
      const lowerFeasible = p.g === 0 ? 0 : bisect((candidate) => p.g - production(candidate, p), 0, 1);
      const lo = Math.max(1e-10, lowerFeasible + 1e-10);
      const hi = 1 - 1e-10;
      const householdCondition = (candidate) =>
        marginalProduct(candidate, p) * Math.pow(production(candidate, p) - p.g, -p.sigma) -
        Math.pow(candidate, p.phi);
      if (!(householdCondition(lo) > 0 && householdCondition(hi) < 0)) return null;
      n = bisect(householdCondition, lo, hi);
    }
    if (!(n > 0 && n < 1)) return null;
    const y = production(n, p);
    const w = marginalProduct(n, p);
    const c = y - p.g;
    const leisure = 1 - n;
    if (c <= 0 || !Number.isFinite(utility(c, leisure, p))) return null;
    return { n, y, w, c, leisure, profit: y - w * n, tax: p.g };
  }

  function firmAtWage(w, p) {
    const n = Math.pow((p.z * p.alpha) / w, 1 / (1 - p.alpha));
    const y = production(n, p);
    return { n, y, profit: y - w * n };
  }

  function householdAtWage(w, profit, p) {
    if (p.preferences === "ghh") {
      const n = Math.pow(w / p.psi, 1 / p.phi);
      const leisure = 1 - n;
      const c = w * n + profit - p.g;
      if (!(n > 0 && n < 1) || !Number.isFinite(utility(c, leisure, p))) return null;
      return { n, c };
    }
    if (p.preferences === "kpr") {
      const c = (w + profit - p.g) / (1 + p.psi);
      const leisure = (p.psi * (w + profit - p.g)) / ((1 + p.psi) * w);
      const n = 1 - leisure;
      if (!(n > 0 && n < 1) || c <= 0) return null;
      return { n, c };
    }
    const nonlaborIncome = profit - p.g;
    const lo = Math.max(0, -nonlaborIncome / w + 1e-10);
    const hi = 1 - 1e-10;
    if (lo >= hi) return null;
    const householdCondition = (n) => {
      const c = w * n + nonlaborIncome;
      return w * Math.pow(c, -p.sigma) - Math.pow(n, p.phi);
    };
    if (!(householdCondition(lo) > 0 && householdCondition(hi) < 0)) return null;
    const n = bisect(householdCondition, lo, hi);
    return { n, c: w * n + nonlaborIncome };
  }

  function marketsAtWage(w, p) {
    const firm = firmAtWage(w, p);
    const household = householdAtWage(w, firm.profit, p);
    if (!household) return null;
    return { nd: firm.n, ns: household.n, ys: firm.y, yd: household.c + p.g };
  }

  function number(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : "—";
  }

  function signedChange(value, reference) {
    const delta = value - reference;
    if (Math.abs(delta) < 0.0005) return "no change";
    return `${delta > 0 ? "Increased" : "Decreased"} by ${number(Math.abs(delta))} vs. baseline`;
  }

  function replaceMath(target, html) {
    if (!window.MathJax || !window.MathJax.typesetPromise) {
      target.innerHTML = html;
      return;
    }
    mathQueue = mathQueue
      .catch(() => {})
      .then(() => {
        if (window.MathJax.typesetClear) window.MathJax.typesetClear([target]);
        target.innerHTML = html;
        return window.MathJax.typesetPromise([target]);
      });
  }

  function utilityTex(p) {
    if (p.preferences === "crra") {
      const consumption =
        Math.abs(p.sigma - 1) < 1e-10 ? String.raw`\log C` : String.raw`\frac{C^{1-\sigma}}{1-\sigma}`;
      return String.raw`U(C,N)=${consumption}-\frac{N^{1+\varphi}}{1+\varphi}`;
    }
    if (p.preferences === "ghh") {
      return Math.abs(p.sigma - 1) < 1e-10
        ? String.raw`U(C,N)=\log\left(C-\frac{\psi}{1+\varphi}N^{1+\varphi}\right)`
        : String.raw`U(C,N)=\frac{\left[C-\frac{\psi}{1+\varphi}N^{1+\varphi}\right]^{1-\sigma}-1}{1-\sigma}`;
    }
    return Math.abs(p.sigma - 1) < 1e-10
      ? String.raw`U(C,\ell)=\log C+\psi\log\ell`
      : String.raw`U(C,\ell)=\frac{\left(C\ell^\psi\right)^{1-\sigma}-1}{1-\sigma}`;
  }

  function renderSelectionFormulas(p) {
    const preferenceKey = `${p.preferences}-${Math.abs(p.sigma - 1) < 1e-10}`;
    if (preferenceFormulaKey !== preferenceKey) {
      preferenceFormulaKey = preferenceKey;
      replaceMath($("ge-preference-formula"), String.raw`\(${utilityTex(p)}\)`);
    }
    if (productionFormulaKey !== "power") {
      productionFormulaKey = "power";
      replaceMath($("ge-production-formula"), String.raw`\(Y=zN^\alpha\)`);
    }
  }

  function svgNode(name, attributes = {}) {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function appendText(svg, x, y, value, className, anchor = "middle") {
    const node = svgNode("text", { x, y, class: className, "text-anchor": anchor });
    node.textContent = value;
    svg.appendChild(node);
  }

  function axes(svg, xMax, yMax, xLabel, yLabel) {
    const left = 58;
    const right = 568;
    const top = 28;
    const bottom = 298;
    const xPad = Math.max(xMax * 0.04, 1e-6);
    const yPad = Math.max(yMax * 0.05, 1e-6);
    const x = (value) => left + ((value + xPad) / (xMax + 2 * xPad)) * (right - left);
    const y = (value) => bottom - ((value + yPad) / (yMax + 2 * yPad)) * (bottom - top);
    const dataLeft = x(0);
    const dataRight = x(xMax);
    const dataTop = y(yMax);
    const dataBottom = y(0);
    svg.replaceChildren();
    for (let tick = 0; tick <= 4; tick++) {
      const xx = x((tick / 4) * xMax);
      const yy = y((tick / 4) * yMax);
      svg.appendChild(svgNode("line", { x1: xx, y1: dataTop, x2: xx, y2: dataBottom, class: "ge-grid" }));
      svg.appendChild(svgNode("line", { x1: dataLeft, y1: yy, x2: dataRight, y2: yy, class: "ge-grid" }));
      appendText(svg, xx, dataBottom + 17, number((tick / 4) * xMax, 1), "ge-tick");
      appendText(svg, dataLeft - 8, yy + 4, number((tick / 4) * yMax, 1), "ge-tick", "end");
    }
    svg.appendChild(svgNode("line", { x1: dataLeft, y1: dataBottom, x2: dataRight, y2: dataBottom, class: "ge-axis" }));
    svg.appendChild(svgNode("line", { x1: dataLeft, y1: dataTop, x2: dataLeft, y2: dataBottom, class: "ge-axis" }));
    appendText(svg, 313, 344, xLabel, "ge-axis-label");
    appendText(svg, dataLeft, 17, yLabel, "ge-axis-label", "start");
    return { x, y, xMax, yMax };
  }

  function plotPath(svg, sample, scale, className, steps = 180) {
    let d = "";
    let active = false;
    for (let i = 0; i <= steps; i++) {
      const point = sample(i / steps);
      const valid =
        point &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]) &&
        point[0] >= 0 &&
        point[0] <= scale.xMax &&
        point[1] >= 0 &&
        point[1] <= scale.yMax;
      if (valid) {
        d += `${active ? "L" : "M"}${scale.x(point[0]).toFixed(2)},${scale.y(point[1]).toFixed(2)}`;
        active = true;
      } else active = false;
    }
    if (d) svg.appendChild(svgNode("path", { d, class: className }));
  }

  function equilibriumMarker(svg, scale, xValue, yValue, baselineMarker) {
    const x = scale.x(xValue);
    const y = scale.y(yValue);
    svg.appendChild(svgNode("line", { x1: x, y1: y, x2: x, y2: scale.y(0), class: "ge-guide" }));
    svg.appendChild(svgNode("line", { x1: scale.x(0), y1: y, x2: x, y2: y, class: "ge-guide" }));
    svg.appendChild(svgNode("circle", { cx: x, cy: y, r: baselineMarker ? 5 : 6, class: baselineMarker ? "ge-marker-old" : "ge-marker" }));
  }

  function marketPlot(id, kind, current, currentEq, old, oldEq) {
    const svg = $(id);
    const yMax = Math.max(currentEq.w, oldEq.w) * 1.75;
    const minWage = Math.max(0.01, Math.min(currentEq.w, oldEq.w) * 0.35);
    const xMax = kind === "labor" ? 1 : Math.max(production(1, current), production(1, old)) * 1.15;
    const scale = axes(svg, xMax, yMax, kind === "labor" ? "Labor" : "Output", "Real wage");
    const changed = JSON.stringify(current) !== JSON.stringify(old);
    const drawSet = (p, suffix) => {
      ["demand", "supply"].forEach((side) => {
        plotPath(
          svg,
          (t) => {
            const w = minWage + t * (yMax - minWage);
            const m = marketsAtWage(w, p);
            if (!m) return null;
            const key = kind === "labor" ? (side === "demand" ? "nd" : "ns") : side === "demand" ? "yd" : "ys";
            return [m[key], w];
          },
          scale,
          `ge-curve ge-${side}${suffix}`
        );
      });
    };
    if (changed) drawSet(old, " ge-curve-old");
    drawSet(current, "");
    if (changed) equilibriumMarker(svg, scale, kind === "labor" ? oldEq.n : oldEq.y, oldEq.w, true);
    equilibriumMarker(svg, scale, kind === "labor" ? currentEq.n : currentEq.y, currentEq.w, false);
  }

  function allocationPlot(current, currentEq, old, oldEq) {
    const svg = $("ge-allocation-plot");
    const currentBudgetIntercept = currentEq.w + currentEq.profit - current.g;
    const oldBudgetIntercept = oldEq.w + oldEq.profit - old.g;
    const currentFrontierIntercept = production(1, current) - current.g;
    const oldFrontierIntercept = production(1, old) - old.g;
    const uStar = utility(currentEq.c, currentEq.leisure, current);
    const indifferenceStart = current.preferences === "kpr" ? Math.max(1e-4, currentEq.leisure * 0.55) : 0;
    const indifferenceCeiling = indifferenceConsumption(Math.max(indifferenceStart, 1e-5), uStar, current);
    const yMax =
      Math.max(
        currentEq.c,
        oldEq.c,
        currentBudgetIntercept,
        oldBudgetIntercept,
        currentFrontierIntercept,
        oldFrontierIntercept,
        Number.isFinite(indifferenceCeiling) ? indifferenceCeiling : 0,
        0.1
      ) * 1.35;
    const scale = axes(svg, 1.1, yMax, "Leisure", "Consumption");
    const frontier = (p, suffix) => plotPath(svg, (t) => [t, production(1 - t, p) - p.g], scale, `ge-curve ge-frontier${suffix}`, 240);
    const changed = JSON.stringify(current) !== JSON.stringify(old);
    if (changed) frontier(old, " ge-curve-old");
    frontier(current, "");
    plotPath(svg, (t) => [t, currentEq.w * (1 - t) + currentEq.profit - current.g], scale, "ge-curve ge-budget-line");
    plotPath(
      svg,
      (t) => {
        const leisure = indifferenceStart + t * (1 - indifferenceStart);
        return [leisure, indifferenceConsumption(Math.max(leisure, 1e-5), uStar, current)];
      },
      scale,
      "ge-curve ge-indifference-line",
      240
    );
    if (changed) equilibriumMarker(svg, scale, oldEq.leisure, oldEq.c, true);
    equilibriumMarker(svg, scale, currentEq.leisure, currentEq.c, false);
  }

  function renderResults(currentEq, oldEq) {
    ["w", "n", "y", "c", "leisure", "profit"].forEach((key) => {
      const card = $("ge-results").querySelector(`[data-result="${key}"]`);
      card.querySelector("strong").textContent = number(currentEq[key]);
      const change = card.querySelector(".ge-result-change");
      const delta = currentEq[key] - oldEq[key];
      change.className = `ge-result-change ${Math.abs(delta) < 0.0005 ? "" : delta > 0 ? "ge-positive" : "ge-negative"}`;
      change.textContent = signedChange(currentEq[key], oldEq[key]);
    });
  }

  function householdUtilityTex(p) {
    if (p.preferences === "crra") {
      const consumption =
        Math.abs(p.sigma - 1) < 1e-10 ? String.raw`\log C` : String.raw`\frac{C^{1-\sigma}}{1-\sigma}`;
      return String.raw`U(C,N^s)=${consumption}-\frac{(N^s)^{1+\varphi}}{1+\varphi}`;
    }
    if (p.preferences === "ghh") {
      return Math.abs(p.sigma - 1) < 1e-10
        ? String.raw`U(C,N^s)=\log\left[C-\frac{\psi}{1+\varphi}(N^s)^{1+\varphi}\right]`
        : String.raw`U(C,N^s)=\frac{\left[C-\frac{\psi}{1+\varphi}(N^s)^{1+\varphi}\right]^{1-\sigma}-1}{1-\sigma}`;
    }
    return utilityTex(p);
  }

  function optimizationSetupHtml(p) {
    const householdChoice = p.preferences === "kpr" ? String.raw`\max_{C,\ell}` : String.raw`\max_{C,N^s}`;
    let householdCondition;
    let householdNote;
    if (p.preferences === "ghh") {
      householdCondition = String.raw`\(w=\psi(N^s)^\varphi\)`;
      householdNote = `Labor supply is independent of consumption, profits, and lump-sum taxes: GHH preferences eliminate the wealth effect on labor supply. Its wage elasticity is ${String.raw`\(1/\varphi\)`}, while ${String.raw`\(\sigma\)`} does not affect the static labor choice.`;
    } else if (p.preferences === "crra") {
      householdCondition = String.raw`\(wC^{-\sigma}=(N^s)^\varphi\)`;
      householdNote = `Consumption enters the condition through its marginal utility. Changes in profits or lump-sum taxes therefore affect labor supply through a wealth effect. Holding marginal utility of wealth constant, the Frisch elasticity is ${String.raw`\(1/\varphi\)`}.`;
    } else {
      householdCondition = String.raw`\(w\ell=\psi C\)`;
      householdNote = `Consumption enters the condition, so profits and lump-sum taxes generate wealth effects on labor supply. The curvature parameter ${String.raw`\(\sigma\)`} changes only the cardinal representation: it does not affect the preference ranking or the household's static choices.`;
    }
    return `
      <p><em>Household:</em></p>
      <p>${String.raw`\(${householdChoice}\;${householdUtilityTex(p)}\)`}</p>
      <p><em>subject to</em></p>
      <p>${String.raw`\(C=wN^s+\pi-T\)`}</p>
      <p>${String.raw`\(N^s+\ell=1\)`}</p>
      <p><strong>Intratemporal condition:</strong></p>
      <p>${householdCondition}</p>
      <p>${householdNote}</p>

      <p><em>Firm:</em></p>
      <p>${String.raw`\(\max_{N^d}\;\pi=Y-wN^d\)`}</p>
      <p><em>subject to</em></p>
      <p>${String.raw`\(Y=zf(N^d)=z(N^d)^\alpha\)`}</p>
      <p><strong>Intratemporal condition:</strong></p>
      <p>${String.raw`\(w=zf_N(N^d)=\alpha z(N^d)^{\alpha-1}\)`}</p>
      <p>Because ${String.raw`\(0<\alpha<1\)`}, diminishing marginal productivity makes labor demand downward sloping in the real wage. Higher productivity ${String.raw`\(z\)`} shifts labor demand outward.</p>

      <p><em>Government:</em></p>
      <p>${String.raw`\(G=T\)`}</p>

      <p><strong>Market clearing:</strong></p>
      <p>${String.raw`\(N^s=N^d=N^*\)`}</p>
      <p>${String.raw`\(Y^*=C^*+G\)`}</p>
    `;
  }

  function renderKprEquations(p) {
    const target = $("ge-equations");
    const key = `${p.preferences}-${Math.abs(p.sigma - 1) < 1e-10}`;
    if (equationKey === key) return;
    equationKey = key;
    const schedules = `
      <p>${String.raw`\(N^d(w)=\left(\frac{\alpha z}{w}\right)^{\frac{1}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(Y^s(w)=z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(\pi(w)=(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(\ell^d(w)=\frac{\psi}{(1+\psi)w}\left[w+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G\right]\)`}</p>
      <p>${String.raw`\(N^s(w)=\frac{1}{1+\psi}+\frac{\psi G}{(1+\psi)w}-\frac{\psi(1-\alpha)z}{(1+\psi)w}\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(C^d(w)=\frac{1}{1+\psi}\left[w+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G\right]\)`}</p>
      <p>${String.raw`\(Y^d(w)=\frac{1}{1+\psi}\left[w+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}+\psi G\right]\)`}</p>
    `;
    const equilibriumSolution = `
      <p>${String.raw`\((w^*)^{\frac{1}{1-\alpha}}+\psi G(w^*)^{\frac{\alpha}{1-\alpha}}-(\alpha+\psi)z(\alpha z)^{\frac{\alpha}{1-\alpha}}=0\)`}</p>
      <p>${String.raw`\(N^*=\left(\frac{\alpha z}{w^*}\right)^{\frac{1}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(\ell^*=1-\left(\frac{\alpha z}{w^*}\right)^{\frac{1}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(Y^*=z\left(\frac{\alpha z}{w^*}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(C^*=\frac{1}{1+\psi}\left[w^*+(1-\alpha)z\left(\frac{\alpha z}{w^*}\right)^{\frac{\alpha}{1-\alpha}}-G\right]\)`}</p>
      <p>${String.raw`\(\pi^*=(1-\alpha)z\left(\frac{\alpha z}{w^*}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
      <p>${String.raw`\(T^*=G\)`}</p>
    `;
    const html = `
      ${optimizationSetupHtml(p)}
      <div class="ge-solution-box"><strong>Functions at a given real wage</strong>${schedules}</div>
      <div class="ge-solution-box"><strong>Competitive equilibrium</strong>${equilibriumSolution}</div>
    `;
    replaceMath(target, html);
  }

  function renderSeparableCrraEquations(p) {
    const target = $("ge-equations");
    const key = `crra-${Math.abs(p.sigma - 1) < 1e-10}`;
    if (equationKey === key) return;
    equationKey = key;
    const html = `
      ${optimizationSetupHtml(p)}
      <div class="ge-solution-box"><strong>Functions at a given real wage</strong>
        <p>${String.raw`\(N^d(w)=\left(\frac{\alpha z}{w}\right)^{\frac{1}{1-\alpha}}\)`}</p>
        <p>${String.raw`\(Y^s(w)=z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
        <p>${String.raw`\(\pi(w)=(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
        <p>${String.raw`\(N^s(w)\in(0,1)\)`} is the interior solution of</p>
        <p>${String.raw`\(wN^s(w)+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G=w^{\frac{1}{\sigma}}\left[N^s(w)\right]^{-\frac{\varphi}{\sigma}}\)`}</p>
        <p>${String.raw`\(\ell^d(w)=1-N^s(w)\)`}</p>
        <p>${String.raw`\(C^d(w)=w^{\frac{1}{\sigma}}\left[N^s(w)\right]^{-\frac{\varphi}{\sigma}}\)`}</p>
        <p>${String.raw`\(Y^d(w)=w^{\frac{1}{\sigma}}\left[N^s(w)\right]^{-\frac{\varphi}{\sigma}}+G\)`}</p>
      </div>
      <div class="ge-solution-box"><strong>Competitive equilibrium</strong>
        <p>${String.raw`\(N^*\)`} is the feasible interior solution of</p>
        <p>${String.raw`\(\alpha z(N^*)^{\alpha-1}\left[z(N^*)^\alpha-G\right]^{-\sigma}=(N^*)^\varphi\)`}</p>
        <p>${String.raw`\(N^*\in(0,1)\)`}</p>
        <p>${String.raw`\(w^*=\alpha z(N^*)^{\alpha-1}\)`}</p>
        <p>${String.raw`\(\ell^*=1-N^*\)`}</p>
        <p>${String.raw`\(Y^*=z(N^*)^\alpha\)`}</p>
        <p>${String.raw`\(C^*=z(N^*)^\alpha-G\)`}</p>
        <p>${String.raw`\(\pi^*=(1-\alpha)z(N^*)^\alpha\)`}</p>
        <p>${String.raw`\(T^*=G\)`}</p>
      </div>
      <p><em>Logarithmic case:</em> when ${String.raw`\(\sigma=1\)`}, the consumption term is ${String.raw`\(\log C\)`}. For ${String.raw`\(\sigma\neq1\)`}, the omitted CRRA normalization constant has no effect on choices. The labor-disutility term remains isoelastic with curvature ${String.raw`\(\varphi\)`}.</p>
    `;
    replaceMath(target, html);
  }

  function renderEquations(p) {
    if (p.preferences === "ghh") {
      const key = `ghh-${Math.abs(p.sigma - 1) < 1e-10}`;
      if (equationKey === key) return;
      equationKey = key;
      const target = $("ge-equations");
      const html = `
        ${optimizationSetupHtml(p)}
        <div class="ge-solution-box"><strong>Functions at a given real wage</strong>
          <p>${String.raw`\(N^d(w)=\left(\frac{\alpha z}{w}\right)^{\frac{1}{1-\alpha}}\)`}</p>
          <p>${String.raw`\(Y^s(w)=z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
          <p>${String.raw`\(\pi(w)=(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
          <p>${String.raw`\(N^s(w)=\left(\frac{w}{\psi}\right)^{\frac{1}{\varphi}}\)`}</p>
          <p>${String.raw`\(\ell^d(w)=1-\left(\frac{w}{\psi}\right)^{\frac{1}{\varphi}}\)`}</p>
          <p>${String.raw`\(C^d(w)=w\left(\frac{w}{\psi}\right)^{\frac{1}{\varphi}}+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G\)`}</p>
          <p>${String.raw`\(Y^d(w)=w\left(\frac{w}{\psi}\right)^{\frac{1}{\varphi}}+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}\)`}</p>
        </div>
        <div class="ge-solution-box"><strong>Competitive equilibrium</strong>
          <p>${String.raw`\(w^*=\psi^{\frac{1-\alpha}{1+\varphi-\alpha}}(\alpha z)^{\frac{\varphi}{1+\varphi-\alpha}}\)`}</p>
          <p>${String.raw`\(N^*=\left(\frac{\alpha z}{\psi}\right)^{\frac{1}{1+\varphi-\alpha}}\)`}</p>
          <p>${String.raw`\(\ell^*=1-\left(\frac{\alpha z}{\psi}\right)^{\frac{1}{1+\varphi-\alpha}}\)`}</p>
          <p>${String.raw`\(Y^*=z\left(\frac{\alpha z}{\psi}\right)^{\frac{\alpha}{1+\varphi-\alpha}}\)`}</p>
          <p>${String.raw`\(C^*=z\left(\frac{\alpha z}{\psi}\right)^{\frac{\alpha}{1+\varphi-\alpha}}-G\)`}</p>
          <p>${String.raw`\(\pi^*=(1-\alpha)z\left(\frac{\alpha z}{\psi}\right)^{\frac{\alpha}{1+\varphi-\alpha}}\)`}</p>
          <p>${String.raw`\(T^*=G\)`}</p>
        </div>
      `;
      replaceMath(target, html);
      return;
    }

    if (p.preferences === "crra") {
      renderSeparableCrraEquations(p);
      return;
    }

    renderKprEquations(p);
  }

  function refreshControlLabels(p) {
    fields.forEach((name) => {
      $("ge-" + name + "-value").textContent = number(p[name], name === "g" || name === "alpha" ? 2 : 1);
    });
    $("ge-psi-field").hidden = p.preferences === "crra";
    $("ge-sigma-field").hidden = false;
    $("ge-phi-field").hidden = p.preferences !== "ghh" && p.preferences !== "crra";
    $("ge-alpha-field").hidden = false;
  }

  function render() {
    const p = configuration();
    refreshControlLabels(p);
    renderSelectionFormulas(p);
    renderEquations(p);
    const currentEq = equilibrium(p);
    const oldEq = equilibrium(baseline);
    if (!currentEq || !oldEq) {
      $("ge-error").textContent = "This calibration has no feasible interior equilibrium. Adjust government spending or model parameters.";
      return;
    }
    $("ge-error").textContent = "";
    renderResults(currentEq, oldEq);
    marketPlot("ge-labor-plot", "labor", p, currentEq, baseline, oldEq);
    marketPlot("ge-goods-plot", "goods", p, currentEq, baseline, oldEq);
    allocationPlot(p, currentEq, baseline, oldEq);
  }

  const predictionItems = [
    { key: "nd", label: "Labor demand", group: "curve" },
    { key: "ns", label: "Labor supply", group: "curve" },
    { key: "ys", label: "Goods supply", group: "curve" },
    { key: "yd", label: "Goods demand", group: "curve" },
    { key: "w", label: "Real wage", group: "outcome" },
    { key: "n", label: "Employment", group: "outcome" },
    { key: "y", label: "Output", group: "outcome" },
    { key: "c", label: "Consumption", group: "outcome" },
    { key: "leisure", label: "Leisure", group: "outcome" },
  ];

  function movement(before, after) {
    const tolerance = 1e-7 * Math.max(1, Math.abs(before), Math.abs(after));
    if (after > before + tolerance) return "up";
    if (after < before - tolerance) return "down";
    return "same";
  }

  function exerciseAnswer(item, base, shocked) {
    const oldEq = equilibrium(base);
    const newEq = equilibrium(shocked);
    if (item.group === "outcome") return movement(oldEq[item.key], newEq[item.key]);
    const oldMarket = marketsAtWage(oldEq.w, base);
    const newMarket = marketsAtWage(oldEq.w, shocked);
    if (!oldMarket || !newMarket) return "same";
    return movement(oldMarket[item.key], newMarket[item.key]);
  }

  function describeMovement(answer, group) {
    if (answer === "same") return group === "curve" ? "No shift" : "No change";
    return group === "curve" ? (answer === "up" ? "Right" : "Left") : answer === "up" ? "Up" : "Down";
  }

  function newExercise() {
    const base = configuration();
    const candidates = [];
    if (base.z < 3.75) candidates.push({ key: "z", direction: 1 });
    if (base.z > 1.2) candidates.push({ key: "z", direction: -1 });
    if (base.g < 0.65) candidates.push({ key: "g", direction: 1 });
    if (base.g > 0.15) candidates.push({ key: "g", direction: -1 });
    const change = candidates[Math.floor(Math.random() * candidates.length)];
    const shocked = { ...base };
    shocked[change.key] = Number((base[change.key] + change.direction * (change.key === "z" ? 0.3 : 0.12)).toFixed(2));
    exercise = { base, shocked };
    const name = change.key === "z" ? "productivity" : "government spending";
    const symbol = change.key === "z" ? "z" : "G";
    replaceMath(
      $("ge-exercise-prompt"),
      `Starting from the current calibration, ${name} ${change.direction > 0 ? "increases" : "decreases"}: ${String.raw`\(${symbol}: ${number(base[change.key], 2)}\longrightarrow ${number(shocked[change.key], 2)}\)`}. Predict the directions below.`
    );
    $("ge-predictions").replaceChildren();
    predictionItems.forEach((item) => {
      const field = document.createElement("label");
      field.className = "ge-prediction";
      field.textContent = item.label;
      const select = document.createElement("select");
      select.dataset.key = item.key;
      [
        ["", "Select a direction"],
        ["up", describeMovement("up", item.group)],
        ["down", describeMovement("down", item.group)],
        ["same", describeMovement("same", item.group)],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
      field.appendChild(select);
      $("ge-predictions").appendChild(field);
    });
    $("ge-feedback").replaceChildren();
    $("ge-exercise").hidden = false;
  }

  function checkExercise() {
    if (!exercise) return;
    const selections = [...$("ge-predictions").querySelectorAll("select")];
    const unanswered = selections.some((select) => select.value === "");
    if (unanswered) {
      $("ge-feedback").textContent = "Choose a prediction for every row before checking.";
      return;
    }
    let correct = 0;
    const list = document.createElement("ul");
    predictionItems.forEach((item, index) => {
      const answer = exerciseAnswer(item, exercise.base, exercise.shocked);
      const isCorrect = selections[index].value === answer;
      if (isCorrect) correct++;
      const row = document.createElement("li");
      row.className = isCorrect ? "ge-correct" : "ge-incorrect";
      row.textContent = `${item.label}: ${describeMovement(answer, item.group)} ${isCorrect ? "✓" : "(your prediction: " + describeMovement(selections[index].value, item.group) + ")"}`;
      list.appendChild(row);
      selections[index].disabled = true;
    });
    const feedback = $("ge-feedback");
    feedback.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `${correct} of ${predictionItems.length} correct. The charts above now compare the pre-shock baseline (dashed) with the post-shock equilibrium (solid).`;
    feedback.append(summary, list);
    baseline = { ...exercise.base };
    setConfiguration(exercise.shocked);
    render();
    $("ge-check-exercise").disabled = true;
  }

  ["ge-preferences", ...fields.map((name) => "ge-" + name)].forEach((id) => {
    $(id).addEventListener("input", () => {
      if (exercise) {
        exercise = null;
        $("ge-exercise").hidden = true;
      }
      render();
    });
  });
  $("ge-set-baseline").addEventListener("click", () => {
    baseline = configuration();
    render();
  });
  $("ge-new-exercise").addEventListener("click", () => {
    $("ge-check-exercise").disabled = false;
    newExercise();
  });
  $("ge-check-exercise").addEventListener("click", checkExercise);
  setConfiguration(initial);
  render();
  window.addEventListener("load", () => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      mathQueue = mathQueue.catch(() => {}).then(() => window.MathJax.typesetPromise([root]));
    }
  });
})();

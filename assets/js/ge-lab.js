/* One-period general-equilibrium teaching lab. No server or external chart library is required. */
(() => {
  "use strict";

  const root = document.getElementById("ge-lab");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const fields = ["z", "g", "psi", "sigma", "eta", "alpha"];
  const initial = {
    preferences: "log",
    technology: "power",
    z: 2,
    g: 0.3,
    psi: 1,
    sigma: 2,
    eta: 2,
    alpha: 0.5,
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
      technology: $("ge-technology").value,
    };
    fields.forEach((name) => {
      result[name] = Number($("ge-" + name).value);
    });
    return result;
  }

  function setConfiguration(config) {
    $("ge-preferences").value = config.preferences;
    $("ge-technology").value = config.technology;
    fields.forEach((name) => {
      $("ge-" + name).value = config[name];
    });
  }

  function production(n, p) {
    if (n < 0) return NaN;
    if (p.technology === "power") return p.z * Math.pow(n, p.alpha);
    return p.z * Math.sqrt(n);
  }

  function marginalProduct(n, p) {
    if (p.technology === "power") return p.z * p.alpha * Math.pow(n, p.alpha - 1);
    return p.z / (2 * Math.sqrt(n));
  }

  function effectiveSigma(p) {
    return p.preferences === "log" ? 1 : p.sigma;
  }

  function effectiveEta(p) {
    return p.preferences === "log" ? 1 : p.eta;
  }

  function crraUtility(value, curvature) {
    return Math.abs(curvature - 1) < 1e-10 ? Math.log(value) : Math.expm1((1 - curvature) * Math.log(value)) / (1 - curvature);
  }

  function utility(c, leisure, p) {
    if (c <= 0 || leisure <= 0) return NaN;
    return crraUtility(c, effectiveSigma(p)) + p.psi * crraUtility(leisure, effectiveEta(p));
  }

  function inverseConsumptionUtility(value, p) {
    const sigma = effectiveSigma(p);
    if (Math.abs(sigma - 1) < 1e-10) return Math.exp(value);
    const inside = 1 + (1 - sigma) * value;
    return inside > 0 ? Math.pow(inside, 1 / (1 - sigma)) : NaN;
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
    const lowerFeasible = p.g === 0 ? 0 : bisect((n) => p.g - production(n, p), 0, 1);
    const lo = Math.max(1e-10, lowerFeasible + 1e-10);
    const hi = 1 - 1e-10;
    const foc = (n) => {
      const c = production(n, p) - p.g;
      return marginalProduct(n, p) * Math.pow(c, -effectiveSigma(p)) - p.psi * Math.pow(1 - n, -effectiveEta(p));
    };
    if (!(foc(lo) > 0 && foc(hi) < 0)) return null;
    const n = bisect(foc, lo, hi);
    const y = production(n, p);
    const w = marginalProduct(n, p);
    return { n, y, w, c: y - p.g, leisure: 1 - n, profit: y - w * n, tax: p.g };
  }

  function firmAtWage(w, p) {
    let n;
    if (p.technology === "power") n = Math.pow((p.z * p.alpha) / w, 1 / (1 - p.alpha));
    else n = Math.pow(p.z / (2 * w), 2);
    const y = production(n, p);
    return { n, y, profit: y - w * n };
  }

  function householdAtWage(w, profit, p) {
    const nonlaborIncome = profit - p.g;
    if (nonlaborIncome + w <= 0) return null;
    const lo = Math.max(0, -nonlaborIncome / w + 1e-10);
    const hi = 1 - 1e-10;
    if (lo >= hi) return null;
    const foc = (n) => {
      const c = w * n + nonlaborIncome;
      return w * Math.pow(c, -effectiveSigma(p)) - p.psi * Math.pow(1 - n, -effectiveEta(p));
    };
    const n = foc(lo) <= 0 ? lo : bisect(foc, lo, hi);
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
    const consumption = effectiveSigma(p) === 1 ? String.raw`\log C` : String.raw`\frac{C^{1-\sigma}-1}{1-\sigma}`;
    const leisure = effectiveEta(p) === 1 ? String.raw`\log\ell` : String.raw`\frac{\ell^{1-\eta}-1}{1-\eta}`;
    return String.raw`U(C,\ell)=${consumption}+\psi ${leisure}`;
  }

  function renderSelectionFormulas(p) {
    const preferenceKey = `${p.preferences}-${effectiveSigma(p) === 1}-${effectiveEta(p) === 1}`;
    if (preferenceFormulaKey !== preferenceKey) {
      preferenceFormulaKey = preferenceKey;
      replaceMath($("ge-preference-formula"), String.raw`\(${utilityTex(p)}\)`);
    }
    if (productionFormulaKey !== p.technology) {
      productionFormulaKey = p.technology;
      replaceMath(
        $("ge-production-formula"),
        p.technology === "power" ? String.raw`\(Y=zN^\alpha\)` : String.raw`\(Y=z\sqrt N\)`
      );
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
    const x = (value) => left + (value / xMax) * (right - left);
    const y = (value) => bottom - (value / yMax) * (bottom - top);
    svg.replaceChildren();
    for (let tick = 0; tick <= 4; tick++) {
      const xx = x((tick / 4) * xMax);
      const yy = y((tick / 4) * yMax);
      svg.appendChild(svgNode("line", { x1: xx, y1: top, x2: xx, y2: bottom, class: "ge-grid" }));
      svg.appendChild(svgNode("line", { x1: left, y1: yy, x2: right, y2: yy, class: "ge-grid" }));
      appendText(svg, xx, bottom + 17, number((tick / 4) * xMax, 1), "ge-tick");
      appendText(svg, left - 8, yy + 4, number((tick / 4) * yMax, 1), "ge-tick", "end");
    }
    svg.appendChild(svgNode("line", { x1: left, y1: bottom, x2: right, y2: bottom, class: "ge-axis" }));
    svg.appendChild(svgNode("line", { x1: left, y1: top, x2: left, y2: bottom, class: "ge-axis" }));
    appendText(svg, 313, 344, xLabel, "ge-axis-label");
    appendText(svg, left, 17, yLabel, "ge-axis-label", "start");
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
    const yMax = Math.max(production(1, current), production(1, old)) * 1.2;
    const scale = axes(svg, 1, yMax, "Leisure", "Consumption");
    const frontier = (p, suffix) => plotPath(svg, (t) => [t, production(1 - t, p) - p.g], scale, `ge-curve ge-frontier${suffix}`, 240);
    const changed = JSON.stringify(current) !== JSON.stringify(old);
    if (changed) frontier(old, " ge-curve-old");
    frontier(current, "");
    plotPath(svg, (t) => [t, currentEq.w * (1 - t) + currentEq.profit - current.g], scale, "ge-curve ge-budget-line");
    const uStar = utility(currentEq.c, currentEq.leisure, current);
    plotPath(
      svg,
      (t) => {
        const leisure = Math.max(t, 1e-5);
        return [t, inverseConsumptionUtility(uStar - current.psi * crraUtility(leisure, effectiveEta(current)), current)];
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

  function renderEquations(p) {
    const squareRoot = p.technology === "sqrt" || Math.abs(p.alpha - 0.5) < 1e-10;
    const bothLogs = effectiveSigma(p) === 1 && effectiveEta(p) === 1;
    const key = `${p.preferences}-${p.technology}-${bothLogs}-${effectiveSigma(p) === 1}-${effectiveEta(p) === 1}-${squareRoot}`;
    if (equationKey === key) return;
    equationKey = key;
    const target = $("ge-equations");
    const utilityEquation = String.raw`\(${utilityTex(p)}\)`;
    const technologyEquation = squareRoot
      ? String.raw`\(F(N)=z\sqrt N,\quad F_N(N)=\frac{z}{2\sqrt N}\)`
      : String.raw`\(F(N)=zN^\alpha,\quad F_N(N)=\alpha zN^{\alpha-1}\)`;
    const firmSchedules = squareRoot
      ? String.raw`\(N^d(w)=\frac{z^2}{4w^2},\quad Y^s(w)=\frac{z^2}{2w},\quad \pi(w)=\frac{z^2}{4w}\)`
      : String.raw`\(N^d(w)=\left(\frac{\alpha z}{w}\right)^{\frac{1}{1-\alpha}},\quad Y^s(w)=z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}},\quad \pi(w)=(1-\alpha)Y^s(w)\)`;
    const fullIncome = squareRoot
      ? String.raw`\(I(w)=w+\frac{z^2}{4w}-G\)`
      : String.raw`\(I(w)=w+(1-\alpha)z\left(\frac{\alpha z}{w}\right)^{\frac{\alpha}{1-\alpha}}-G\)`;
    const householdSchedules = bothLogs
      ? `<p>${String.raw`\(\ell^d(w)=\min\left\{1,\frac{\psi I(w)}{(1+\psi)w}\right\},\quad N^s(w)=1-\ell^d(w),\quad C^d(w)=I(w)-w\ell^d(w)\)`}</p>
         <p>${squareRoot ? String.raw`\(Y^d(w)=\frac{w+z^2/(4w)+\psi G}{1+\psi}\quad\text{when }0&lt;N^s(w)&lt;1\)` : String.raw`\(Y^d(w)=C^d(w)+G=wN^s(w)+\pi(w)\)`}</p>`
      : `<p>${String.raw`\(\Phi_w(\ell)=w\ell+\left(\frac{w}{\psi}\right)^{1/\sigma}\ell^{\eta/\sigma},\quad \ell^d(w)=\min\{1,\Phi_w^{-1}(I(w))\}\)`}</p>
         <p>${String.raw`\(N^s(w)=1-\ell^d(w),\quad C^d(w)=I(w)-w\ell^d(w),\quad Y^d(w)=wN^s(w)+\pi(w)\)`}</p>
         <p>The inverse is the unique root of ${String.raw`\(w\ell+\left(w/\psi\right)^{1/\sigma}\ell^{\eta/\sigma}=I(w)\)`} on the interior. It also applies when either curvature equals ${String.raw`\(1\)`}.</p>`;
    const equilibriumCondition = squareRoot
      ? String.raw`\(\frac{z}{2\sqrt{N^*}}(z\sqrt{N^*}-G)^{-\sigma}=\psi(1-N^*)^{-\eta}\)`
      : String.raw`\(\alpha z(N^*)^{\alpha-1}\left[z(N^*)^\alpha-G\right]^{-\sigma}=\psi(1-N^*)^{-\eta}\)`;
    const equilibriumSolution = bothLogs && squareRoot
      ? `<strong>Closed-form competitive equilibrium</strong>
         <p>${String.raw`\(D=\sqrt{\psi^2G^2+(1+2\psi)z^2},\qquad w^*=\frac{-\psi G+D}{2},\qquad Y^*=\frac{\psi G+D}{1+2\psi}\)`}</p>
         <p>${String.raw`\(N^*=\left[\frac{\psi G+D}{(1+2\psi)z}\right]^2,\qquad \ell^*=1-N^*\)`}</p>
         <p>${String.raw`\(C^*=\frac{D-(1+\psi)G}{1+2\psi},\qquad \pi^*=\frac{\psi G+D}{2(1+2\psi)},\qquad T^*=G\)`}</p>`
      : squareRoot
        ? `<strong>Fully specified equilibrium for the square-root model</strong>
           <p>Let ${String.raw`\(Y^*\)`} be the unique solution of ${String.raw`\(\frac{z^2}{2Y^*}(Y^*-G)^{-\sigma}=\psi\left[1-\left(\frac{Y^*}{z}\right)^2\right]^{-\eta},\quad G&lt;Y^*&lt;z\)`}.</p>
           <p>${String.raw`\(N^*=\left(\frac{Y^*}{z}\right)^2,\quad w^*=\frac{z^2}{2Y^*},\quad C^*=Y^*-G,\quad \ell^*=1-\left(\frac{Y^*}{z}\right)^2,\quad \pi^*=\frac{Y^*}{2},\quad T^*=G\)`}</p>
           <p>For arbitrary ${String.raw`\(\sigma\)`} and ${String.raw`\(\eta\)`}, the scalar root is computed numerically; no general elementary closed form is claimed.</p>`
        : `<strong>Fully specified equilibrium for power production</strong>
           <p>Let ${String.raw`\(N^*\)`} be the unique solution of the equilibrium condition above with ${String.raw`\(0&lt;N^*&lt;1\)`} and ${String.raw`\(z(N^*)^\alpha&gt;G\)`}.</p>
           <p>${String.raw`\(w^*=\alpha z(N^*)^{\alpha-1},\quad Y^*=z(N^*)^\alpha,\quad C^*=z(N^*)^\alpha-G,\quad \ell^*=1-N^*,\quad \pi^*=(1-\alpha)z(N^*)^\alpha,\quad T^*=G\)`}</p>
           <p>The scalar root is computed numerically for general ${String.raw`\(\alpha\)`} and curvatures.</p>`;
    const html = `
      <p><strong>Preferences:</strong> ${utilityEquation}</p>
      <p><strong>Production:</strong> ${technologyEquation}</p>
      <p><strong>Household budget:</strong> ${String.raw`\(C=wN+\pi-G,\quad \ell=1-N\)`}. <strong>Firm:</strong> ${String.raw`\(w=F_N(N^d),\quad \pi=F(N^d)-wN^d\)`}.</p>
      <p><strong>Market clearing:</strong> ${String.raw`\(N^s=N^d=N^*,\quad Y^*=C^*+G,\quad T=G\)`}.</p>
      <p><strong>Equilibrium condition:</strong> ${equilibriumCondition}. ${bothLogs ? String.raw`\(\sigma=\eta=1\)` : "The two CRRA curvatures enter separately."}</p>
      <div class="ge-solution-box"><strong>Functions at a given real wage</strong>
        <p>${firmSchedules}</p><p>${fullIncome}</p>${householdSchedules}
        <p>These are notional schedules at each wage. If the household chooses the leisure corner ${String.raw`\(\ell^d(w)=1\)`}, then ${String.raw`\(N^s(w)=0,\ C^d(w)=\pi(w)-G,\ Y^d(w)=\pi(w)\)`}.</p>
      </div>
      <div class="ge-solution-box">${equilibriumSolution}</div>
    `;
    replaceMath(target, html);
  }

  function refreshControlLabels(p) {
    fields.forEach((name) => {
      $("ge-" + name + "-value").textContent = number(p[name], name === "g" || name === "alpha" ? 2 : 1);
    });
    $("ge-sigma-field").hidden = p.preferences !== "crra";
    $("ge-eta-field").hidden = p.preferences !== "crra";
    $("ge-alpha-field").hidden = p.technology !== "power";
  }

  function render() {
    const p = configuration();
    refreshControlLabels(p);
    renderSelectionFormulas(p);
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
    renderEquations(p);
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

  ["ge-preferences", "ge-technology", ...fields.map((name) => "ge-" + name)].forEach((id) => {
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

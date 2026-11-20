/*
 * Rail-IQ RAMS Workbench engine: fault trees (FTA) and reliability block diagrams (RBD)
 * ------------------------------------------------------------------------------------
 * Fault tree
 *   gates   OR, AND, VOTE (k of the inputs failed)            coherent logic (no NOT)
 *   events  repair   revealed failure, repaired            q = λτ/(1+λτ),            w = λ(1−q)
 *           dormant  unrevealed, found by proof test       q = 1−(1−e^(−λT))/(λT) + λτ, w = λ(1−q)
 *           rate     non-repairable over the mission t     q = 1−e^(−λt),           w = λe^(−λt)
 *           fixed    probability on demand                 q = p,                   w = 0
 *           freq     initiating event (frequency)          q = 0,                   w = f
 *   CCF     β-factor groups: each member keeps (1−β)λ, a common event with βλ is OR-ed into every member
 *   exact   top-event probability Q and failure frequency W from a binary decision diagram (BDD):
 *           P(v) = q·P(hi) + (1−q)·P(lo)       W(v) = w·(P(hi)−P(lo)) + q·W(hi) + (1−q)·W(lo)
 *   cut sets minimal cut sets by bottom-up Boolean expansion with absorption (order and value truncation)
 *   importance Birnbaum, criticality, Fussell-Vesely (Q and W), RAW, RRW
 * RBD
 *   blocks   MTBF or Weibull(β, η), MDT (= MALDT + MTTR), proof-test interval (MUFT = T/2), k-of-n identical units
 *   groups   series, parallel, k-of-n, standby
 *   analytic converted to failure logic and solved with the same BDD: A = 1 − Q, MUT (MTBSAF) = A / W, MDT = Q / W
 *   simulation Monte Carlo of the life (failures, repairs, proof tests, cold standby) for cross-checking
 */
(function (root) {
  "use strict";

  /* ---------------- small maths ---------------- */
  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const num = (v, d) => { const x = typeof v === "number" ? v : parseFloat(v); return isFinite(x) ? x : (d === undefined ? 0 : d); };
  function lgamma(x) { // Lanczos
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1; let a = c[0]; const t = x + g + 0.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  const gamma = x => Math.exp(lgamma(x));
  // 1 − (1 − e^(−x)) / x, accurate for small x (mean unavailability of a proof-tested item, x = λT)
  function meanDormant(x) {
    if (x <= 0) return 0;
    if (x < 1e-4) return x / 2 - x * x / 6 + x * x * x / 24;
    return 1 - (-Math.expm1(-x)) / x;
  }

  /* ---------------- event models ---------------- */
  const MODELS = {
    repair:  { label: "Revealed, repaired", short: "Repairable", fields: ["lambda", "mdt"] },
    dormant: { label: "Unrevealed, proof-tested", short: "Dormant", fields: ["lambda", "ti", "mdt"] },
    rate:    { label: "Non-repairable over the mission", short: "Non-repairable", fields: ["lambda"] },
    fixed:   { label: "Probability on demand", short: "Fixed q", fields: ["q"] },
    freq:    { label: "Initiating event (frequency)", short: "Frequency", fields: ["f"] }
  };

  // q (unavailability) and w (unconditional failure frequency, /h) of one event
  function eventQW(e, T) {
    const lam = Math.max(0, num(e.lambda)), tau = Math.max(0, num(e.mdt));
    switch (e.model) {
      case "repair": { const q = lam * tau / (1 + lam * tau); return { q, w: lam * (1 - q) }; }
      case "dormant": { const Ti = Math.max(0, num(e.ti)); const q = clamp01(meanDormant(lam * Ti) + lam * tau); return { q, w: lam * (1 - q) }; }
      case "rate": { const t = Math.max(0, num(T)); return { q: -Math.expm1(-lam * t), w: lam * Math.exp(-lam * t) }; }
      case "fixed": return { q: clamp01(num(e.q)), w: 0 };
      case "freq": return { q: 0, w: Math.max(0, num(e.f)) };
      default: return { q: 0, w: 0 };
    }
  }
  // q at time t (for the unavailability-against-time curve)
  function eventQt(e, t) {
    const lam = Math.max(0, num(e.lambda)), tau = Math.max(0, num(e.mdt));
    switch (e.model) {
      case "repair": { if (tau <= 0) return 0; const mu = 1 / tau; return lam / (lam + mu) * (-Math.expm1(-(lam + mu) * t)); }
      case "dormant": { const Ti = num(e.ti); const tt = Ti > 0 ? t % Ti : t; return -Math.expm1(-lam * tt); }
      case "rate": return -Math.expm1(-lam * t);
      case "fixed": return clamp01(num(e.q));
      default: return 0;
    }
  }

  // EN 50126-2:2017 §10.2.7 Table 2 (THR / TFFR → SIL)
  function silFromRate(w) {
    if (!(w >= 0)) return "—";
    if (w < 1e-9) return "below SIL 4 range";
    if (w < 1e-8) return "SIL 4";
    if (w < 1e-7) return "SIL 3";
    if (w < 1e-6) return "SIL 2";
    if (w < 1e-5) return "SIL 1";
    return "Basic integrity";
  }
  const SIL_THR = { "SIL 4": 1e-8, "SIL 3": 1e-7, "SIL 2": 1e-6, "SIL 1": 1e-5 };

  /* ---------------- fault tree: validate + compile (CCF expansion) ---------------- */
  function compile(model) {
    const errors = [], warnings = [];
    const gates = new Map(), events = new Map();
    (model.gates || []).forEach(g => {
      const id = String(g.id || "").trim();
      if (!id) { errors.push("A gate has no ID."); return; }
      if (gates.has(id)) errors.push("Gate ID " + id + " is used twice.");
      gates.set(id, { id, type: (g.type || "or").toLowerCase(), k: Math.round(num(g.k, 2)), inputs: (g.inputs || []).map(s => String(s).trim()).filter(Boolean), desc: g.desc || "" });
    });
    (model.events || []).forEach(e => {
      const id = String(e.id || "").trim();
      if (!id) { errors.push("An event has no ID."); return; }
      if (events.has(id) || gates.has(id)) errors.push("ID " + id + " is used twice.");
      events.set(id, Object.assign({}, e, { id }));
    });
    const top = String(model.top || "").trim();
    if (!gates.has(top) && !events.has(top)) errors.push("Top event " + (top || "(none)") + " is not a gate or event.");
    gates.forEach(g => {
      if (!g.inputs.length) errors.push("Gate " + g.id + " has no inputs.");
      g.inputs.forEach(i => { if (!gates.has(i) && !events.has(i)) errors.push("Gate " + g.id + " refers to " + i + ", which does not exist."); });
      if (!["or", "and", "vote"].includes(g.type)) errors.push("Gate " + g.id + " has an unknown type " + g.type + ".");
      if (g.type === "vote" && (g.k < 1 || g.k > g.inputs.length)) errors.push("Vote gate " + g.id + ": k = " + g.k + " must be between 1 and " + g.inputs.length + ".");
    });
    events.forEach(e => {
      if (!MODELS[e.model]) errors.push("Event " + e.id + " has an unknown model " + e.model + ".");
      const f = (MODELS[e.model] || { fields: [] }).fields;
      f.forEach(k => { const v = num(e[k], NaN); if (!(v >= 0)) errors.push("Event " + e.id + ": " + k + " must be a number ≥ 0."); });
      if (e.model === "fixed" && num(e.q) > 1) errors.push("Event " + e.id + ": probability above 1.");
      if (e.model === "dormant" && !(num(e.ti) > 0)) errors.push("Event " + e.id + ": proof-test interval must be > 0.");
    });
    // cycles
    if (!errors.length) {
      const state = new Map();
      const visit = id => {
        if (!gates.has(id)) return true;
        if (state.get(id) === 1) { errors.push("Gate " + id + " is part of a loop."); return false; }
        if (state.get(id) === 2) return true;
        state.set(id, 1);
        for (const i of gates.get(id).inputs) if (!visit(i)) return false;
        state.set(id, 2); return true;
      };
      visit(top);
      gates.forEach(g => { if (!state.has(g.id)) warnings.push("Gate " + g.id + " is not connected to the top event."); });
      events.forEach(e => { let used = false; gates.forEach(g => { if (g.inputs.includes(e.id)) used = true; }); if (!used && e.id !== top) warnings.push("Event " + e.id + " is not used in the tree."); });
    }
    if (errors.length) return { errors, warnings };

    // β-factor common cause groups
    const ccfDefs = new Map((model.ccf || []).map(c => [String(c.id), { id: String(c.id), beta: clamp01(num(c.beta)), desc: c.desc || "" }]));
    const members = new Map();
    events.forEach(e => { const g = String(e.ccf || "").trim(); if (g) { if (!members.has(g)) members.set(g, []); members.get(g).push(e.id); } });
    const effEvents = new Map(), effGates = new Map(), ccfInfo = [];
    events.forEach(e => effEvents.set(e.id, Object.assign({}, e)));
    gates.forEach(g => effGates.set(g.id, Object.assign({}, g, { inputs: g.inputs.slice() })));
    const replace = new Map();
    members.forEach((ids, g) => {
      const def = ccfDefs.get(g);
      if (!def) { warnings.push("CCF group " + g + " has no β defined; ignored."); return; }
      if (ids.length < 2) { warnings.push("CCF group " + g + " has only one member; ignored."); return; }
      const ms = ids.map(i => events.get(i));
      const model0 = ms[0].model;
      if (ms.some(m => m.model !== model0)) warnings.push("CCF group " + g + " mixes event models; the common event uses " + model0 + ".");
      if (model0 === "freq") { warnings.push("CCF group " + g + ": initiating events cannot share a common cause; ignored."); return; }
      const b = def.beta, mean = k => ms.reduce((s, m) => s + num(m[k]), 0) / ms.length;
      const cid = "CCF_" + g;
      const ce = { id: cid, desc: "Common cause failure of " + ids.join(", ") + " (β = " + b + ")", model: model0, lambda: b * mean("lambda"), mdt: mean("mdt"), ti: mean("ti"), q: b * mean("q"), isCCF: true };
      effEvents.set(cid, ce);
      ids.forEach(i => {
        const e = effEvents.get(i);
        if (model0 === "fixed") e.q = (1 - b) * num(e.q); else e.lambda = (1 - b) * num(e.lambda);
        const vg = "~" + i;
        effGates.set(vg, { id: vg, type: "or", inputs: [i, cid], virtual: true, desc: i + " or its common cause" });
        replace.set(i, vg);
      });
      ccfInfo.push({ id: g, cid, beta: b, members: ids, lambda: ce.lambda, q: ce.q });
    });
    effGates.forEach(g => { if (!g.virtual) g.inputs = g.inputs.map(i => replace.get(i) || i); });
    const effTop = replace.get(top) || top;
    return { errors, warnings, gates: effGates, events: effEvents, top: effTop, origTop: top, ccf: ccfInfo, origGates: gates, origEvents: events };
  }

  /* ---------------- BDD ---------------- */
  function BDD() {
    this.V = [1e9, 1e9]; this.L = [0, 1]; this.H = [0, 1];
    this.uniq = new Map(); this.memo = { and: new Map(), or: new Map() };
  }
  BDD.prototype.mk = function (v, lo, hi) {
    if (lo === hi) return lo;
    const key = v + ":" + lo + ":" + hi;
    let n = this.uniq.get(key);
    if (n === undefined) {
      n = this.V.length;
      if (n > 3000000) throw new Error("The model is too large for the exact calculation.");
      this.V.push(v); this.L.push(lo); this.H.push(hi); this.uniq.set(key, n);
    }
    return n;
  };
  BDD.prototype.apply = function (op, a, b) {
    if (op === "and") { if (a === 0 || b === 0) return 0; if (a === 1) return b; if (b === 1) return a; if (a === b) return a; }
    else { if (a === 1 || b === 1) return 1; if (a === 0) return b; if (b === 0) return a; if (a === b) return a; }
    if (a > b) { const t = a; a = b; b = t; }
    const key = a * 4194304 + b, m = this.memo[op];
    const hit = m.get(key); if (hit !== undefined) return hit;
    const va = this.V[a], vb = this.V[b], v = Math.min(va, vb);
    const a0 = va === v ? this.L[a] : a, a1 = va === v ? this.H[a] : a;
    const b0 = vb === v ? this.L[b] : b, b1 = vb === v ? this.H[b] : b;
    const r = this.mk(v, this.apply(op, a0, b0), this.apply(op, a1, b1));
    m.set(key, r); return r;
  };
  BDD.prototype.reach = function (roots) {
    const seen = new Uint8Array(this.V.length), out = [];
    const st = roots.slice();
    while (st.length) { const n = st.pop(); if (n < 2 || seen[n]) continue; seen[n] = 1; out.push(n); st.push(this.L[n], this.H[n]); }
    return out.sort((x, y) => x - y); // children always have smaller indices than their parents
  };
  // probability and frequency of every reachable node
  BDD.prototype.evaluate = function (nodes, q, w) {
    const P = new Float64Array(this.V.length), W = new Float64Array(this.V.length);
    P[1] = 1;
    for (const n of nodes) {
      const v = this.V[n], ph = P[this.H[n]], pl = P[this.L[n]];
      P[n] = q[v] * ph + (1 - q[v]) * pl;
      if (w) W[n] = w[v] * (ph - pl) + q[v] * W[this.H[n]] + (1 - q[v]) * W[this.L[n]];
    }
    return { P, W };
  };
  // Birnbaum importance ∂P(root)/∂q_i for every variable, by one top-down pass
  BDD.prototype.birnbaum = function (rootN, nodes, P, q, nv) {
    const path = new Float64Array(this.V.length), IB = new Float64Array(nv);
    if (rootN < 2) return IB;
    path[rootN] = 1;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i], pn = path[n]; if (!pn) continue;
      const v = this.V[n];
      IB[v] += pn * (P[this.H[n]] - P[this.L[n]]);
      path[this.H[n]] += pn * q[v]; path[this.L[n]] += pn * (1 - q[v]);
    }
    return IB;
  };

  /* ---------------- fault tree analysis ---------------- */
  function analyseFT(model, opts) {
    opts = opts || {};
    const T = num(model.missionTime, 8760);
    const c = compile(model);
    if (c.errors.length) return { ok: false, errors: c.errors, warnings: c.warnings || [] };
    const { gates, events, top } = c;

    // variable order: depth-first from the top, first appearance
    const order = [], idx = new Map();
    (function dfs(id) {
      if (events.has(id)) { if (!idx.has(id)) { idx.set(id, order.length); order.push(id); } return; }
      const g = gates.get(id); if (!g || g._seen) return; g._seen = true;
      g.inputs.forEach(dfs);
    })(top);
    gates.forEach(g => delete g._seen);
    const nv = order.length;
    const q = new Float64Array(nv), w = new Float64Array(nv);
    order.forEach((id, i) => { const r = eventQW(events.get(id), T); q[i] = r.q; w[i] = r.w; });

    // BDD for every gate
    const bdd = new BDD(), gnode = new Map();
    function build(id) {
      if (events.has(id)) return bdd.mk(idx.get(id), 0, 1);
      if (gnode.has(id)) return gnode.get(id);
      const g = gates.get(id), ins = g.inputs.map(build);
      let r;
      if (g.type === "or") r = ins.reduce((a, b) => bdd.apply("or", a, b), 0);
      else if (g.type === "and") r = ins.reduce((a, b) => bdd.apply("and", a, b), 1);
      else { // at least k of n
        const k = Math.min(g.k, ins.length); let f = new Array(k + 1).fill(0); f[0] = 1;
        for (let i = ins.length - 1; i >= 0; i--) {
          const nf = new Array(k + 1); nf[0] = 1;
          for (let j = 1; j <= k; j++) nf[j] = bdd.apply("or", bdd.apply("and", ins[i], f[j - 1]), f[j]);
          f = nf;
        }
        r = f[k];
      }
      gnode.set(id, r); return r;
    }
    let rootN;
    try { rootN = build(top); } catch (err) { return { ok: false, errors: [err.message], warnings: c.warnings }; }
    const roots = Array.from(gnode.values()).concat([rootN]);
    const nodes = bdd.reach(roots);
    const { P, W } = bdd.evaluate(nodes, q, w);
    const Q = P[rootN], Wt = W[rootN];
    const IB = bdd.birnbaum(rootN, bdd.reach([rootN]), P, q, nv);

    // gate results (original IDs; virtual CCF gates hidden)
    const gateRes = {};
    gnode.forEach((n, id) => { if (!gates.get(id).virtual) gateRes[id] = { Q: P[n], W: W[n] }; });

    // minimal cut sets
    const cs = cutSets(c, idx, q, w, { maxOrder: opts.maxOrder || 6, cutoff: opts.cutoff === undefined ? 1e-15 : opts.cutoff, maxSets: opts.maxSets || 20000 });
    let Qrare = 0, Wcs = 0, prodNot = 1;
    cs.sets.forEach(s => { Qrare += s.Q; Wcs += s.W; prodNot *= 1 - s.Q; });
    const Qmcub = 1 - prodNot;
    cs.sets.forEach(s => { s.shareQ = Qrare > 0 ? s.Q / Qrare : 0; s.shareW = Wcs > 0 ? s.W / Wcs : 0; });

    // importance
    const fvQ = new Float64Array(nv), fvW = new Float64Array(nv);
    cs.sets.forEach(s => s.ev.forEach(i => { fvQ[i] += s.Q; fvW[i] += s.W; }));
    const evRes = {};
    order.forEach((id, i) => {
      const Qup = Q + (1 - q[i]) * IB[i], Qdn = Q - q[i] * IB[i];
      evRes[id] = {
        q: q[i], w: w[i], IB: IB[i],
        crit: Q > 0 ? IB[i] * q[i] / Q : 0,
        fvQ: Qrare > 0 ? fvQ[i] / Qrare : 0,
        fvW: Wcs > 0 ? fvW[i] / Wcs : 0,
        raw: Q > 0 ? Qup / Q : (Qup > 0 ? Infinity : 1),
        rrw: Qdn > 0 ? Q / Qdn : (Q > 0 ? Infinity : 1),
        isCCF: !!events.get(id).isCCF
      };
    });
    cs.sets.forEach(s => { s.ids = s.ev.map(i => order[i]); });

    // unavailability against time
    const curve = [];
    const tmax = num(opts.curveTime, T) || 8760, np = 160;
    const nodesTop = bdd.reach([rootN]);
    const qt = new Float64Array(nv);
    for (let k = 0; k <= np; k++) {
      const t = tmax * k / np;
      order.forEach((id, i) => { qt[i] = eventQt(events.get(id), t); });
      curve.push({ t, Q: bdd.evaluate(nodesTop, qt, null).P[rootN] });
    }

    const mut = Wt > 0 ? (1 - Q) / Wt : Infinity, mdt = Wt > 0 ? Q / Wt : 0;
    const target = num(model.thr, 0);
    return {
      ok: true, errors: [], warnings: c.warnings.concat(cs.truncated ? ["Cut-set list truncated (order ≤ " + (opts.maxOrder || 6) + ", value ≥ " + (opts.cutoff === undefined ? 1e-15 : opts.cutoff) + "). Exact Q and W are not affected."] : []),
      top: { id: c.origTop, Q, W: Wt, Qrare, Qmcub, Wcs, mut, mdt, expectedInMission: Wt * T, sil: silFromRate(Wt), thr: target, pass: target > 0 ? Wt <= target : null, margin: target > 0 && Wt > 0 ? target / Wt : null },
      gates: gateRes, events: evRes, cutsets: cs.sets, orderCounts: cs.orderCounts, ccf: c.ccf, curve, T, nvars: nv, bddNodes: nodes.length
    };
  }

  /* ---------------- minimal cut sets (bit masks, bottom-up, absorption) ---------------- */
  function popcount(m) { let c = 0; while (m) { m &= m - 1n; c++; } return c; }
  function cutSets(c, idx, q, w, o) {
    const { gates, events, top } = c, memo = new Map(); let truncated = false;
    const qp = Array.from(q, (x, i) => (x > 0 ? x : w[i] > 0 ? w[i] : 0)); // frequency events weigh by their rate for truncation only
    const mk = (mask, ev) => { let v = 1; ev.forEach(i => (v *= qp[i])); return { mask, ev, v }; };
    function minimize(list) {
      const seen = new Map();
      list.forEach(s => { const k = s.mask.toString(36); if (!seen.has(k)) seen.set(k, s); });
      const arr = Array.from(seen.values()).sort((a, b) => a.ev.length - b.ev.length || b.v - a.v);
      const kept = [];
      outer: for (const s of arr) { for (const k of kept) if (k.ev.length < s.ev.length && (k.mask & s.mask) === k.mask) continue outer; kept.push(s); }
      if (kept.length > o.maxSets) { truncated = true; kept.sort((a, b) => b.v - a.v); kept.length = o.maxSets; }
      return kept;
    }
    function and2(A, B) {
      const out = [];
      for (const a of A) for (const b of B) {
        const m = a.mask | b.mask;
        let ev;
        if (m === a.mask) ev = a.ev; else if (m === b.mask) ev = b.ev; else { const s = new Set(a.ev); b.ev.forEach(i => s.add(i)); ev = Array.from(s).sort((x, y) => x - y); }
        if (ev.length > o.maxOrder) { truncated = true; continue; }
        const s = mk(m, ev);
        if (s.v < o.cutoff) { truncated = true; continue; }
        out.push(s);
      }
      return minimize(out);
    }
    function get(id) {
      if (events.has(id)) { const i = idx.get(id); return [mk(1n << BigInt(i), [i])]; }
      if (memo.has(id)) return memo.get(id);
      const g = gates.get(id), ins = g.inputs.map(get);
      let r;
      if (g.type === "or") r = minimize([].concat.apply([], ins));
      else if (g.type === "and") r = ins.reduce((A, B) => and2(A, B), [mk(0n, [])]);
      else {
        const k = Math.min(g.k, ins.length); let f = new Array(k + 1).fill(null).map(() => []); f[0] = [mk(0n, [])];
        for (let i = ins.length - 1; i >= 0; i--) {
          const nf = new Array(k + 1); nf[0] = [mk(0n, [])];
          for (let j = 1; j <= k; j++) nf[j] = minimize(and2(ins[i], f[j - 1]).concat(f[j]));
          f = nf;
        }
        r = f[k];
      }
      memo.set(id, r); return r;
    }
    const raw = get(top);
    const orderCounts = {};
    const sets = raw.map(s => {
      let Q = 1; s.ev.forEach(i => (Q *= q[i]));
      let W = 0; s.ev.forEach(i => { let p = w[i]; s.ev.forEach(j => { if (j !== i) p *= q[j]; }); W += p; });
      orderCounts[s.ev.length] = (orderCounts[s.ev.length] || 0) + 1;
      return { ev: s.ev, order: s.ev.length, Q, W };
    }).sort((a, b) => (b.W + b.Q * 1e-12) - (a.W + a.Q * 1e-12) || b.Q - a.Q);
    return { sets, orderCounts, truncated };
  }

  /* ---------------- RBD ---------------- */
  // block helpers
  function blockMTTF(b) {
    if (b.dist === "weibull") { const be = num(b.beta, 1), et = num(b.eta, 0); return be > 0 && et > 0 ? et * gamma(1 + 1 / be) : 0; }
    return num(b.mtbf, 0);
  }
  const blockMUFT = b => (b.dormant && num(b.ti) > 0 ? num(b.ti) / 2 : 0);
  const blockMDT = b => num(b.mdt, 0) + blockMUFT(b);
  function blockR(b, t) { // reliability of one unit, no repair
    if (b.dist === "weibull") { const be = num(b.beta, 1), et = num(b.eta, 0); return et > 0 ? Math.exp(-Math.pow(t / et, be)) : 1; }
    const m = num(b.mtbf, 0); return m > 0 ? Math.exp(-t / m) : 1;
  }
  const isGroup = n => n && n.type !== "block";

  // RBD → failure logic. saf: only service-affecting blocks can fail.
  function rbdToFT(rootNode, opts) {
    opts = opts || {};
    const gates = [], events = [], units = [], blockOf = {}, errors = [];
    let gi = 0;
    function walk(n) {
      if (!n) return null;
      if (n.type === "block") {
        if (opts.saf && n.saf === false) return null;
        const mttf = blockMTTF(n);
        if (!(mttf > 0)) { errors.push("Block " + (n.name || n.id) + ": MTBF (or Weibull η) must be > 0."); return null; }
        const qty = Math.max(1, Math.round(num(n.qty, 1))), k = Math.min(qty, Math.max(1, Math.round(num(n.k, qty))));
        const ids = [];
        for (let u = 1; u <= qty; u++) {
          const id = qty === 1 ? n.id : n.id + "#" + u;
          events.push({ id, desc: (n.name || n.id) + (qty > 1 ? " unit " + u : ""), model: "repair", lambda: 1 / mttf, mdt: blockMDT(n) });
          units.push({ id, block: n });
          blockOf[id] = n.id; ids.push(id);
        }
        if (qty === 1) return ids[0];
        const need = qty - k + 1, gid = "G" + (++gi) + "_" + n.id;
        gates.push({ id: gid, type: need === 1 ? "or" : need === qty ? "and" : "vote", k: need, inputs: ids, desc: (n.name || n.id) + " (" + k + " of " + qty + " required)" });
        return gid;
      }
      const kids = (n.children || []).map(walk), live = kids.filter(Boolean), m = (n.children || []).length;
      const gid = "G" + (++gi) + "_" + n.id;
      if (n.type === "series") {
        if (!live.length) return null;
        if (live.length === 1) return live[0];
        gates.push({ id: gid, type: "or", inputs: live, desc: n.name || "series" }); return gid;
      }
      // parallel = 1 of m required; kofn / standby = k of m required
      const kreq = n.type === "parallel" ? 1 : Math.min(m, Math.max(1, Math.round(num(n.k, 1))));
      const need = m - kreq + 1; // failures among the m branches that fail the group
      if (live.length < need) return null;
      if (live.length === 1) return live[0];
      gates.push({ id: gid, type: need === 1 ? "or" : need === live.length ? "and" : "vote", k: need, inputs: live, desc: (n.name || n.type) + " (" + kreq + " of " + m + " required)" });
      return gid;
    }
    const top = walk(rootNode);
    return { top, gates, events, units, blockOf, errors };
  }

  function analyseRBD(rbd, opts) {
    opts = opts || {};
    const rootNode = rbd.root, hpy = num(rbd.hoursPerYear, 8760), mission = num(rbd.missionTime, 24);
    const ft = rbdToFT(rootNode, { saf: true });
    if (ft.errors.length) return { ok: false, errors: ft.errors };
    // all failures (maintenance): every unit counts
    let lamAll = 0; const blocks = [];
    (function each(n) { if (!n) return; if (n.type === "block") { blocks.push(n); const m = blockMTTF(n); if (m > 0) lamAll += Math.max(1, Math.round(num(n.qty, 1))) / m; } else (n.children || []).forEach(each); })(rootNode);

    function solve(node) {
      const f = rbdToFT(node, { saf: true });
      if (!f.top) return { A: 1, Q: 0, W: 0, mut: Infinity, mdt: 0, never: true, ft: f };
      const r = analyseFT({ top: f.top, gates: f.gates, events: f.events, missionTime: mission }, { maxOrder: opts.maxOrder || 4, cutoff: 1e-30, curveTime: 1 });
      if (!r.ok) return { error: r.errors.join(" "), ft: f };
      return { A: 1 - r.top.Q, Q: r.top.Q, W: r.top.W, mut: r.top.mut, mdt: r.top.mdt, res: r, ft: f };
    }
    const sys = solve(rootNode);
    if (sys.error) return { ok: false, errors: [sys.error] };

    // per block: criticality (share of system unavailability) summed over its units
    // Fussell-Vesely by block: each cut set counted once per block it involves (units of one block are not double-counted)
    const blockImp = {};
    if (sys.res) sys.res.cutsets.forEach(s => {
      const bs = new Set(s.ids.map(id => sys.ft.blockOf[id]).filter(Boolean));
      bs.forEach(b => { if (!blockImp[b]) blockImp[b] = { fvQ: 0, fvW: 0 }; blockImp[b].fvQ += s.shareQ; blockImp[b].fvW += s.shareW; });
    });
    // single points of failure: order-1 cut sets
    const spf = [];
    if (sys.res) sys.res.cutsets.filter(s => s.order === 1).forEach(s => { const b = sys.ft.blockOf[s.ids[0]]; if (b && !spf.includes(b)) spf.push(b); });
    const order2 = sys.res ? sys.res.cutsets.filter(s => s.order === 2).length : 0;

    // subsystems = children of the root
    const subs = (rootNode.children || []).map(ch => {
      const r = solve(ch);
      const lamAllSub = (function sum(n) { if (!n) return 0; if (n.type === "block") { const m = blockMTTF(n); return m > 0 ? Math.max(1, Math.round(num(n.qty, 1))) / m : 0; } return (n.children || []).reduce((s, c) => s + sum(c), 0); })(ch);
      const budget = num(ch.lamBudget, 0), tA = num(ch.targetA, 0);
      return {
        id: ch.id, name: ch.name || ch.id, A: r.A, Q: r.Q, W: r.W, mut: r.mut, mdt: r.mdt, lamAll: lamAllSub, error: r.error,
        lamBudget: budget || null, margin: budget ? budget - r.W : null, passBudget: budget ? r.W <= budget : null,
        targetA: tA || null, passA: tA ? r.A * 100 >= tA : null
      };
    });

    // reliability against time (no repair) on the SAF logic
    const relCurve = []; let mttf = null, Rmission = 1;
    if (sys.res) {
      const f = sys.ft, units = f.units;
      const c = compile({ top: f.top, gates: f.gates, events: f.events });
      const order = [], idx = new Map();
      (function dfs(id) { if (c.events.has(id)) { if (!idx.has(id)) { idx.set(id, order.length); order.push(id); } return; } const g = c.gates.get(id); if (!g || g._s) return; g._s = 1; g.inputs.forEach(dfs); })(c.top);
      const bdd = new BDD(), memo = new Map();
      const build = id => {
        if (c.events.has(id)) return bdd.mk(idx.get(id), 0, 1);
        if (memo.has(id)) return memo.get(id);
        const g = c.gates.get(id), ins = g.inputs.map(build); let r;
        if (g.type === "or") r = ins.reduce((a, b) => bdd.apply("or", a, b), 0);
        else if (g.type === "and") r = ins.reduce((a, b) => bdd.apply("and", a, b), 1);
        else { const k = g.k; let fa = new Array(k + 1).fill(0); fa[0] = 1; for (let i = ins.length - 1; i >= 0; i--) { const nf = new Array(k + 1); nf[0] = 1; for (let j = 1; j <= k; j++) nf[j] = bdd.apply("or", bdd.apply("and", ins[i], fa[j - 1]), fa[j]); fa = nf; } r = fa[k]; }
        memo.set(id, r); return r;
      };
      const rn = build(c.top), nodes = bdd.reach([rn]);
      const ublock = new Map(units.map(u => [u.id, u.block]));
      const qv = new Float64Array(order.length);
      const Rsys = t => { order.forEach((id, i) => { qv[i] = 1 - blockR(ublock.get(id), t); }); return 1 - bdd.evaluate(nodes, qv, null).P[rn]; };
      Rmission = Rsys(mission);
      // MTTF by integration on a growing grid
      let t = 0, dt = Math.max(1, Math.min(...units.map(u => blockMTTF(u.block)))) / 200, R0 = 1, area = 0, guard = 0;
      while (guard++ < 4000) { const t1 = t + dt, R1 = Rsys(t1); area += (R0 + R1) / 2 * dt; t = t1; R0 = R1; if (R1 < 1e-5) break; dt *= 1.03; }
      mttf = area;
      const horizon = num(rbd.curveTime, 0) || Math.min(mttf * 2.5, 1e7);
      for (let k = 0; k <= 120; k++) { const tt = horizon * k / 120; relCurve.push({ t: tt, R: Rsys(tt) }); }
    }

    const tA = num(rbd.targetA, 0), tM = num(rbd.targetMTBSAF, 0);
    return {
      ok: true, errors: [], warnings: ft.errors,
      system: { A: sys.A, Q: sys.Q, W: sys.W, mtbsaf: sys.mut, mdt: sys.mdt, downtimeMinYr: sys.Q * hpy * 60, safPerYear: sys.W * hpy, lamAll, mtbfAll: lamAll > 0 ? 1 / lamAll : Infinity, Rmission, mttf, passA: tA ? sys.A * 100 >= tA : null, passM: tM ? sys.mut >= tM : null, targetA: tA || null, targetM: tM || null },
      subs, blockImp, spf, order2, cutsets: sys.res ? sys.res.cutsets.map(s => ({ blocks: s.ids.map(id => sys.ft.blockOf[id] + (id.includes("#") ? id.slice(id.indexOf("#")) : "")), order: s.order, Q: s.Q, W: s.W, shareQ: s.shareQ })) : [],
      relCurve, blocks, hpy, mission, ft: sys.ft
    };
  }

  /* ---------------- Monte Carlo life simulation of an RBD ---------------- */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].t <= a[i].t) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } };
  Heap.prototype.pop = function () { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l].t < a[m].t) m = l; if (r < a.length && a[r].t < a[m].t) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; };

  // returns a stepper: call step(nRuns) repeatedly until done
  function simulator(rbd, opts) {
    const life = num(opts.life, 87600), runs = Math.max(1, Math.round(num(opts.runs, 1000)));
    const repairDist = opts.repairDist || "fixed", pSwitch = clamp01(num(opts.switchFail, 0));
    const ft = rbdToFT(rbd.root, { saf: true });
    if (!ft.top) return { error: "No service-affecting block can fail the system." };
    const c = compile({ top: ft.top, gates: ft.gates, events: ft.events });
    if (c.errors.length) return { error: c.errors.join(" ") };
    const order = [], idx = new Map();
    (function dfs(id) { if (c.events.has(id)) { if (!idx.has(id)) { idx.set(id, order.length); order.push(id); } return; } const g = c.gates.get(id); if (!g || g._s) return; g._s = 1; g.inputs.forEach(dfs); })(c.top);
    const bdd = new BDD(), memo = new Map();
    const build = id => {
      if (c.events.has(id)) return bdd.mk(idx.get(id), 0, 1);
      if (memo.has(id)) return memo.get(id);
      const g = c.gates.get(id), ins = g.inputs.map(build); let r;
      if (g.type === "or") r = ins.reduce((a, b) => bdd.apply("or", a, b), 0);
      else if (g.type === "and") r = ins.reduce((a, b) => bdd.apply("and", a, b), 1);
      else { const k = g.k; let fa = new Array(k + 1).fill(0); fa[0] = 1; for (let i = ins.length - 1; i >= 0; i--) { const nf = new Array(k + 1); nf[0] = 1; for (let j = 1; j <= k; j++) nf[j] = bdd.apply("or", bdd.apply("and", ins[i], fa[j - 1]), fa[j]); fa = nf; } r = fa[k]; }
      memo.set(id, r); return r;
    };
    const rn = build(c.top);
    const n = order.length, failed = new Uint8Array(n);
    const sysDown = () => { let x = rn; while (x > 1) x = failed[bdd.V[x]] ? bdd.H[x] : bdd.L[x]; return x === 1; };
    const ublock = new Map(ft.units.map(u => [u.id, u.block]));
    const U = order.map(id => ublock.get(id));
    // cold standby groups: units of blocks that are direct children of a standby node
    const standby = [];
    (function find(nd) { if (!nd || nd.type === "block") return; if (nd.type === "standby") { const members = []; (nd.children || []).forEach(ch => { if (ch.type === "block") order.forEach((id, i) => { if (U[i] === ch) members.push(i); }); }); if (members.length) standby.push({ k: Math.min(members.length, Math.max(1, Math.round(num(nd.k, 1)))), members }); } (nd.children || []).forEach(find); })(rbd.root);
    const groupOf = new Int32Array(n).fill(-1); standby.forEach((g, gi) => g.members.forEach(i => (groupOf[i] = gi)));
    const R = rng(num(opts.seed, 12345));
    const life_ = i => { const b = U[i]; if (b.dist === "weibull") { const be = num(b.beta, 1), et = num(b.eta, 1); return et * Math.pow(-Math.log(1 - R()), 1 / be); } return -Math.log(1 - R()) * num(b.mtbf, 1); };
    const down_ = i => { const m = num(U[i].mdt, 0); return repairDist === "exp" ? -Math.log(1 - R()) * m : m; };

    const st = { done: 0, runs, life, A: [], failures: 0, downtime: 0, uptime: 0, cause: {}, maxFail: 0 };
    function oneRun() {
      failed.fill(0);
      const h = new Heap(), active = new Uint8Array(n), ver = new Uint32Array(n);
      const sched = (i, t) => { ver[i]++; h.push({ t: t + life_(i), i, type: "fail", v: ver[i] }); };
      for (let i = 0; i < n; i++) { if (groupOf[i] < 0) { active[i] = 1; sched(i, 0); } }
      standby.forEach(g => g.members.slice(0, g.k).forEach(i => { active[i] = 1; sched(i, 0); }));
      let down = false, dStart = 0, dt = 0, nf = 0, t = 0;
      const startRepair = (i, t0) => h.push({ t: t0 + down_(i), i, type: "rep", v: ver[i] });
      const activate = (gi, t0) => { // bring in an idle unit of a standby group
        const g = standby[gi]; let act = g.members.filter(i => active[i] && !failed[i]).length;
        for (const i of g.members) {
          if (act >= g.k) break;
          if (active[i] || failed[i]) continue;
          if (pSwitch > 0 && R() < pSwitch) { failed[i] = 1; ver[i]++; startRepair(i, t0); continue; } // fails to start
          active[i] = 1; sched(i, t0); act++;
        }
      };
      while (h.a.length) {
        const ev = h.pop(); if (ev.t > life) break;
        if (ev.v !== ver[ev.i]) continue;
        t = ev.t; const i = ev.i, b = U[i];
        let trigger = -1;
        if (ev.type === "fail") {
          failed[i] = 1; active[i] = 0; trigger = i;
          if (b.dormant && num(b.ti) > 0) { const Ti = num(b.ti); const found = Math.ceil(t / Ti) * Ti; h.push({ t: found + down_(i), i, type: "rep", v: ver[i] }); }
          else startRepair(i, t);
          if (groupOf[i] >= 0) activate(groupOf[i], t);
        } else {
          failed[i] = 0;
          if (groupOf[i] >= 0) { active[i] = 0; activate(groupOf[i], t); } else { active[i] = 1; sched(i, t); }
        }
        const d = sysDown();
        if (d && !down) { down = true; dStart = t; nf++; if (trigger >= 0) { const bid = b.id; st.cause[bid] = (st.cause[bid] || 0) + 1; } }
        else if (!d && down) { down = false; dt += t - dStart; }
      }
      if (down) dt += life - dStart;
      st.A.push(1 - dt / life); st.failures += nf; st.downtime += dt; st.uptime += life - dt; st.maxFail = Math.max(st.maxFail, nf);
    }
    function step(k) { for (let j = 0; j < k && st.done < runs; j++) { oneRun(); st.done++; } return summary(); }
    function summary() {
      const m = st.A.length; let mean = 0; st.A.forEach(a => (mean += a)); mean /= Math.max(1, m);
      let v = 0; st.A.forEach(a => (v += (a - mean) * (a - mean))); const sd = m > 1 ? Math.sqrt(v / (m - 1)) : 0, half = 1.96 * sd / Math.sqrt(Math.max(1, m));
      const mut = st.failures > 0 ? st.uptime / st.failures : Infinity;
      // 95 % interval on the failure rate from the Poisson count (chi-square via Wilson-Hilferty)
      const chi = (p, k) => { if (k <= 0) return 0; const z = p > 0.5 ? 1.959964 : -1.959964; const a = 2 / (9 * k); return k * Math.pow(1 - a + z * Math.sqrt(a), 3); };
      const lamLo = st.failures > 0 ? chi(0.025, 2 * st.failures) / (2 * st.uptime) : 0, lamHi = chi(0.975, 2 * st.failures + 2) / (2 * st.uptime);
      return { done: st.done, runs, finished: st.done >= runs, A: mean, Alo: mean - half, Ahi: Math.min(1, mean + half), failures: st.failures, failuresPerRun: st.failures / Math.max(1, st.done), mtbsaf: mut, mtbsafLo: lamHi > 0 ? 1 / lamHi : 0, mtbsafHi: lamLo > 0 ? 1 / lamLo : Infinity, cause: Object.assign({}, st.cause), life };
    }
    return { step, summary, units: n, standby: standby.length };
  }

  root.RailIQRW = { MODELS, eventQW, eventQt, silFromRate, SIL_THR, compile, analyseFT, rbdToFT, analyseRBD, simulator, blockMTTF, blockMDT, blockMUFT, blockR, gamma, meanDormant, BDD };
})(typeof window !== "undefined" ? window : globalThis);

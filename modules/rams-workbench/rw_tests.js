/*
 * Verification checks for the RAMS Workbench engine: every result is compared with an
 * independent closed-form value, a brute-force state enumeration, or a known textbook result.
 */
(function (root) {
  "use strict";
  function run() {
    const RW = root.RailIQRW, out = [];
    const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
    const chk = (name, got, exp, tol, ref) => out.push({ name, got, exp, pass: rel(got, exp) <= (tol || 1e-9), ref: ref || "" });
    const ev = (id, lambda, mdt) => ({ id, model: "repair", lambda, mdt });
    const qOf = (l, t) => l * t / (1 + l * t);
    const ft = (top, gates, events, extra) => RW.analyseFT(Object.assign({ top, gates, events, missionTime: 8760 }, extra || {}));

    // 1 AND of two repairable events
    { const r = ft("T", [{ id: "T", type: "and", inputs: ["A", "B"] }], [ev("A", 1e-4, 10), ev("B", 2e-4, 5)]);
      const qa = qOf(1e-4, 10), qb = qOf(2e-4, 5), wa = 1e-4 * (1 - qa), wb = 2e-4 * (1 - qb);
      chk("AND gate: Q = qA·qB", r.top.Q, qa * qb, 1e-12, "Boolean algebra");
      chk("AND gate: W = wA·qB + wB·qA", r.top.W, wa * qb + wb * qa, 1e-12, "Vesely failure frequency"); }
    // 2 OR of two
    { const r = ft("T", [{ id: "T", type: "or", inputs: ["A", "B"] }], [ev("A", 1e-4, 10), ev("B", 2e-4, 5)]);
      const qa = qOf(1e-4, 10), qb = qOf(2e-4, 5), wa = 1e-4 * (1 - qa), wb = 2e-4 * (1 - qb);
      chk("OR gate: Q = 1 − (1−qA)(1−qB)", r.top.Q, 1 - (1 - qa) * (1 - qb), 1e-12, "Boolean algebra");
      chk("OR gate: W = wA(1−qB) + wB(1−qA)", r.top.W, wa * (1 - qb) + wb * (1 - qa), 1e-12, "Vesely failure frequency"); }
    // 3 2-out-of-3 vote with identical events
    { const r = ft("T", [{ id: "T", type: "vote", k: 2, inputs: ["A", "B", "C"] }], [ev("A", 1e-3, 20), ev("B", 1e-3, 20), ev("C", 1e-3, 20)]);
      const q = qOf(1e-3, 20);
      chk("Vote 2/3: Q = 3q² − 2q³", r.top.Q, 3 * q * q - 2 * q * q * q, 1e-12, "Binomial");
      chk("Vote 2/3: minimal cut sets = 3 of order 2", r.cutsets.length, 3, 0, "C(3,2)"); }
    // 4 shared (repeated) event: T = (A+B)(A+C) = A + BC
    { const r = ft("T", [{ id: "T", type: "and", inputs: ["G1", "G2"] }, { id: "G1", type: "or", inputs: ["A", "B"] }, { id: "G2", type: "or", inputs: ["A", "C"] }], [ev("A", 1e-4, 10), ev("B", 1e-3, 10), ev("C", 1e-3, 10)]);
      const qa = qOf(1e-4, 10), qb = qOf(1e-3, 10);
      chk("Repeated event: exact Q = qA + (1−qA)qB·qC", r.top.Q, qa + (1 - qa) * qb * qb, 1e-12, "Absorption A + BC");
      chk("Repeated event: cut sets {A}, {B,C}", r.cutsets.length, 2, 0, "Absorption"); }
    // 5 brute-force enumeration on a mixed tree
    { const evs = [ev("A", 3e-4, 8), ev("B", 5e-4, 4), ev("C", 2e-4, 12), ev("D", 1e-3, 3), ev("E", 7e-4, 6)];
      const gates = [{ id: "T", type: "or", inputs: ["G1", "G2"] }, { id: "G1", type: "and", inputs: ["A", "G3"] }, { id: "G3", type: "vote", k: 2, inputs: ["B", "C", "D"] }, { id: "G2", type: "and", inputs: ["D", "E", "A"] }];
      const r = ft("T", gates, evs);
      const q = evs.map(e => qOf(e.lambda, e.mdt));
      const f = s => { const [a, b, c, d, e] = s; const g3 = (b + c + d) >= 2; return (a && g3) || (d && e && a); };
      let Q = 0; for (let m = 0; m < 32; m++) { const s = [0, 1, 2, 3, 4].map(i => (m >> i) & 1); let p = 1; s.forEach((x, i) => (p *= x ? q[i] : 1 - q[i])); if (f(s)) Q += p; }
      chk("Mixed tree: BDD Q = brute-force enumeration of 32 states", r.top.Q, Q, 1e-10, "State enumeration");
      // W by numerical derivative ∂Q/∂q_i · w_i
      let W = 0; evs.forEach((e, i) => { const qq = q.slice(); const h = 1e-7; const Qx = v => { qq[i] = v; let s = 0; for (let m = 0; m < 32; m++) { const st = [0, 1, 2, 3, 4].map(j => (m >> j) & 1); let p = 1; st.forEach((x, j) => (p *= x ? qq[j] : 1 - qq[j])); if (f(st)) s += p; } return s; }; const d = (Qx(q[i] + h) - Qx(q[i] - h)) / (2 * h); W += d * e.lambda * (1 - q[i]); });
      chk("Mixed tree: W = Σ wᵢ·∂Q/∂qᵢ (numerical derivative)", r.top.W, W, 1e-5, "Birnbaum / Vesely"); }
    // 6 dormant event mean unavailability
    { const lam = 1e-5, Ti = 720; const r = RW.eventQW({ model: "dormant", lambda: lam, ti: Ti, mdt: 0 });
      chk("Proof-tested event: q = 1 − (1 − e^(−λT))/(λT)", r.q, 1 - (1 - Math.exp(-lam * Ti)) / (lam * Ti), 1e-9, "IEC 61508-6 B.3");
      chk("Proof-tested event: q ≈ λT/2 for small λT", r.q, lam * Ti / 2, 5e-3, "Approximation"); }
    // 7 beta factor, 1oo2
    { const lam = 1e-4, t = 10, b = 0.1; const r = ft("T", [{ id: "T", type: "and", inputs: ["A", "B"] }], [Object.assign(ev("A", lam, t), { ccf: "G" }), Object.assign(ev("B", lam, t), { ccf: "G" })], { ccf: [{ id: "G", beta: b }] });
      const qi = qOf((1 - b) * lam, t), qc = qOf(b * lam, t);
      chk("β-factor 1oo2: Q = qc + (1−qc)·qi²", r.top.Q, qc + (1 - qc) * qi * qi, 1e-12, "IEC 61508-6 Annex D model"); }
    // 8 importance on a series system
    { const r = ft("T", [{ id: "T", type: "or", inputs: ["A", "B"] }], [ev("A", 1e-4, 10), ev("B", 2e-4, 5)]);
      const qb = qOf(2e-4, 5);
      chk("Birnbaum importance of A in A OR B = 1 − qB", r.events.A.IB, 1 - qb, 1e-12, "Birnbaum"); }
    // 9 non-repairable over the mission
    { const r = ft("T", [{ id: "T", type: "or", inputs: ["A"] }], [{ id: "A", model: "rate", lambda: 1e-4 }], { missionTime: 5000 });
      chk("Non-repairable: Q(t) = 1 − e^(−λt)", r.top.Q, 1 - Math.exp(-0.5), 1e-12, "Exponential"); }
    // 10 initiating event × conditional probability
    { const r = ft("T", [{ id: "T", type: "and", inputs: ["F", "P"] }], [{ id: "F", model: "freq", f: 1e-3 }, { id: "P", model: "fixed", q: 0.01 }]);
      chk("Initiator × probability on demand: W = f·p", r.top.W, 1e-5, 1e-12, "Event frequency"); }
    // 11 RBD: 1oo2 identical repairable units against a Markov model
    { const lam = 1e-3, mu = 1 / 10; const r = RW.analyseRBD({ hoursPerYear: 8760, missionTime: 10, root: { type: "series", id: "S", children: [{ type: "block", id: "B", mtbf: 1 / lam, mdt: 10, qty: 2, k: 1, saf: true }] } });
      // Markov with independent repair: P2 = (λ/(λ+μ))², system failure frequency = P1·λ, P1 = 2λμ/(λ+μ)²
      const P2 = Math.pow(lam / (lam + mu), 2), P1 = 2 * lam * mu / Math.pow(lam + mu, 2);
      chk("RBD 1oo2: availability = 1 − (λ/(λ+μ))² (Markov)", r.system.A, 1 - P2, 1e-12, "Markov, independent repair");
      chk("RBD 1oo2: MTBSAF = (1 − P₂) / (P₁·λ) (Markov)", r.system.mtbsaf, (1 - P2) / (P1 * lam), 1e-9, "Markov, frequency balance"); }
    // 12 RBD: series of two
    { const r = RW.analyseRBD({ hoursPerYear: 8760, root: { type: "series", id: "S", children: [{ type: "block", id: "A", mtbf: 1000, mdt: 5 }, { type: "block", id: "B", mtbf: 2000, mdt: 10 }] } });
      chk("RBD series: A = A₁·A₂", r.system.A, (1000 / 1005) * (2000 / 2010), 1e-12, "IEC 61078");
      chk("RBD series: single points of failure = 2", r.spf.length, 2, 0, "Annex 2 §4.8 SPF check"); }
    // 13 RBD: Annex 2 availability with MUFT (MDT = MUFT + MRT)
    { const r = RW.analyseRBD({ hoursPerYear: 8760, root: { type: "series", id: "S", children: [{ type: "block", id: "A", mtbf: 10000, mdt: 2, dormant: true, ti: 720 }] } });
      chk("RBD dormant block: A = MUT / (MUT + MUFT + MRT), MUFT = T/2", r.system.A, 10000 / (10000 + 360 + 2), 1e-12, "Annex 2 §3.3.1"); }
    // 14 Weibull mean
    { chk("Weibull MTTF: η·Γ(1 + 1/β), β = 2", RW.blockMTTF({ dist: "weibull", beta: 2, eta: 1000 }), 1000 * Math.sqrt(Math.PI) / 2, 1e-10, "Γ(1.5) = √π/2"); }
    // 15 RBD mission reliability, 2oo3, no repair
    { const m = 1000, t = 200; const r = RW.analyseRBD({ missionTime: t, root: { type: "series", id: "S", children: [{ type: "block", id: "A", mtbf: m, mdt: 1, qty: 3, k: 2 }] } });
      const R = Math.exp(-t / m); chk("RBD 2oo3 mission reliability: 3R² − 2R³", r.system.Rmission, 3 * R * R - 2 * R * R * R, 1e-10, "Binomial");
      chk("RBD 2oo3 MTTF = 5/(6λ)", r.system.mttf, 5 * m / 6, 2e-3, "Textbook (numerical integration)"); }
    // 16 Monte Carlo against the analytic value (single block, exact)
    { const sim = RW.simulator({ root: { type: "series", id: "S", children: [{ type: "block", id: "A", mtbf: 100, mdt: 10, dist: "exp" }] } }, { life: 20000, runs: 200, seed: 7, repairDist: "exp" });
      const s = sim.step(200); const exact = 100 / 110;
      out.push({ name: "Monte Carlo single block: analytic A = 0.90909 inside the 95 % interval", got: s.A, exp: exact, pass: exact >= s.Alo && exact <= s.Ahi, ref: "Simulation vs renewal theory" }); }
    return out;
  }
  root.RailIQRWTests = { run };
})(typeof window !== "undefined" ? window : globalThis);

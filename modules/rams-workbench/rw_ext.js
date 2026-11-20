/* Rail-IQ RAMS Workbench – event trees, Markov models, Weibull analysis, uncertainty and the project summary (SIL register) */
(function () {
  "use strict";
  const RW = window.RailIQRW;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  let H = null;
  const esc = s => H.esc(s), fE = (x, d) => H.fE(x, d), fN = (x, d) => H.fN(x, d), fP = (x, d) => H.fP(x, d);
  const num = (v, d) => H.num(v, d);
  let rt, formKey = "", formRev = 0, lastMode = "";
  const KIND_OK = { eta: 1, mk: 1, wb: 1 };
  const later = fn => { clearTimeout(rt); rt = setTimeout(fn, 150); };

  /* ---------------- generic multi-series chart ---------------- */
  function chart(svg, series, o) {
    const W = 900, Ht = o.h || 320, L = 78, R = 18, T = 26, B = 66;
    svg.setAttribute("viewBox", "0 0 " + W + " " + Ht);
    const all = [].concat.apply([], series.map(s => s.pts)); if (!all.length) { svg.innerHTML = ""; return; }
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const x0 = o.xmin != null ? o.xmin : Math.min(...xs), x1 = o.xmax != null ? o.xmax : Math.max(...xs);
    const y0 = o.ymin != null ? o.ymin : Math.min(0, ...ys), y1 = o.ymax != null ? o.ymax : Math.max(...ys) * 1.05 || 1;
    const X = x => L + (x - x0) / ((x1 - x0) || 1) * (W - L - R), Y = y => T + (1 - (y - y0) / ((y1 - y0) || 1)) * (Ht - T - B);
    let h = "";
    const yt = o.yticks || [0, 1, 2, 3, 4].map(i => y0 + (y1 - y0) * i / 4), xt = o.xticks || [0, 1, 2, 3, 4, 5].map(i => x0 + (x1 - x0) * i / 5);
    yt.forEach(v => { const y = Y(v); h += '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(o.fmtY(v)) + "</text>"; });
    xt.forEach(v => { const x = X(v); h += '<line class="gr" x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + (Ht - B) + '"/><text x="' + x + '" y="' + (Ht - B + 16) + '" text-anchor="middle">' + esc(o.fmtX(v)) + "</text>"; });
    series.forEach((s, si) => {
      if (s.dots) s.pts.forEach(p => { h += '<circle class="dot" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="4"/>'; });
      else h += '<path class="ln' + (si ? " ln" + si : "") + '" d="' + s.pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ") + '"/>';
    });
    if (o.vline != null && o.vline >= x0 && o.vline <= x1) h += '<line class="vl" x1="' + X(o.vline) + '" x2="' + X(o.vline) + '" y1="' + T + '" y2="' + (Ht - B) + '"/><text class="vlt" x="' + (X(o.vline) + 4) + '" y="' + (T + 12) + '">' + esc(o.vlabel || "") + "</text>";
    h += '<text x="' + ((L + W - R) / 2) + '" y="' + (Ht - B + 34) + '" text-anchor="middle">' + esc(o.xl) + '</text><text x="12" y="14">' + esc(o.yl) + "</text>";
    let lx = W - R - 10; const ly = Ht - 10; series.slice().reverse().forEach((s, ri) => { if (!s.label) return; const si = series.length - 1 - ri; const w = 18 + s.label.length * 6.6; lx -= w; h += (s.dots ? '<circle class="dot" cx="' + (lx + 6) + '" cy="' + (ly - 4) + '" r="4"/>' : '<line class="ln' + (si ? " ln" + si : "") + '" x1="' + lx + '" x2="' + (lx + 14) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '"/>') + '<text x="' + (lx + 18) + '" y="' + ly + '">' + esc(s.label) + "</text>"; });
    svg.innerHTML = h;
  }
  const log10 = Math.log10;

  /* ================= FAULT TREE UNCERTAINTY ================= */
  function runUnc() {
    const m = H.curModel("ft"), n = num($("#unc-n").value, 2000), ef = num($("#unc-ef").value, 1);
    const t0 = performance.now(), u = RW.uncertaintyFT(m, { samples: n, defaultEF: ef, seed: 7 });
    const box = $("#unc-out");
    if (!u.ok) { box.innerHTML = '<p class="bad">' + esc(u.errors.join(" ")) + "</p>"; return; }
    if (!u.withEF) { box.innerHTML = '<p class="muted">No event has an error factor above 1. Enter EF values in the Events table (column EF) or set a default EF above.</p>'; $("#unc-chart").innerHTML = ""; return; }
    box.innerHTML = '<div class="kpis">' +
      H.kpi("Mean W", fE(u.W.mean), "per hour · point value " + fE(H.analyseFTModel(m).top.W), null) +
      H.kpi("5th percentile", fE(u.W.p05), "per hour", null) +
      H.kpi("Median (50th)", fE(u.W.p50), "per hour", null) +
      H.kpi("95th percentile", fE(u.W.p95), "per hour · " + esc(RW.silFromRate(u.W.p95)), u.thr ? u.W.p95 <= u.thr : null) +
      H.kpi("Confidence THR is met", u.probMeetsTHR == null ? "—" : fN(u.probMeetsTHR * 100, 1) + " %", u.thr ? "share of samples with W ≤ " + fE(u.thr) : "no THR set", u.probMeetsTHR == null ? null : u.probMeetsTHR >= 0.9) +
      H.kpi("Samples", fN(u.n), u.withEF + " of " + u.nv + " events uncertain · " + fN((performance.now() - t0) / 1000, 1) + " s", null) + "</div>";
    const s = u.samples, pts = [];
    const step = Math.max(1, Math.floor(s.length / 300));
    for (let i = 0; i < s.length; i += step) if (s[i] > 0) pts.push([log10(s[i]), (i + 1) / s.length]);
    if (pts.length) {
      const lo = Math.floor(pts[0][0]), hi = Math.ceil(pts[pts.length - 1][0] + 1e-9), xt = []; for (let x = lo; x <= hi; x++) xt.push(x);
      chart($("#unc-chart"), [{ pts, label: "cumulative share of samples" }], { xl: "top-event frequency W (/h, log scale)", yl: "P(W ≤ x)", fmtX: v => "1E" + v, fmtY: v => fN(v * 100, 0) + " %", xmin: lo, xmax: hi, ymin: 0, ymax: 1, xticks: xt, yticks: [0, 0.25, 0.5, 0.75, 1], vline: u.thr ? log10(u.thr) : null, vlabel: "THR" });
    }
  }

  /* ================= EVENT TREE ================= */
  const eta = () => H.curModel("eta");
  function ftOptions(sel) { return '<option value="">choose a fault tree…</option>' + H.S.fts.map(f => '<option value="' + esc(f.uid) + '"' + (f.uid === sel ? " selected" : "") + ">" + esc(f.name) + "</option>").join(""); }
  function etaForms() {
    const m = eta(); m.headings = m.headings || []; m.cats = m.cats || []; m.init = m.init || { desc: "", f: 0 };
    $("#eta-init").innerHTML =
      '<div class="fld"><label>Initiating event</label><input data-ei="desc" value="' + esc(m.init.desc) + '"></div>' +
      '<div class="fld"><label>Frequency source</label><select data-ei="src"><option value="value"' + (!m.init.ft ? " selected" : "") + '>Value entered</option><option value="ft"' + (m.init.ft ? " selected" : "") + ">Top-event frequency of a fault tree</option></select></div>" +
      (m.init.ft ? '<div class="fld"><label>Fault tree</label><select data-ei="ft">' + ftOptions(m.init.ft) + "</select></div>" : '<div class="fld"><label>Frequency</label><div class="unit"><input type="number" step="any" data-ei="f" value="' + esc(m.init.f) + '"><span>/h</span></div><small>' + fN(num(m.init.f, 0) * 8760, 5) + " per year</small></div>") +
      '<div class="fld wide"><label>Description</label><textarea data-ei="mdesc" rows="2">' + esc(m.desc || "") + "</textarea></div>";
    const opts = (cur, i) => '<option value="">always asked</option>' + m.headings.slice(0, i).map(h => ["S", "F"].map(s => '<option value="' + esc(h.id) + ":" + s + '"' + (cur && cur.h === h.id && cur.s === s ? " selected" : "") + ">only if " + esc(h.id) + (s === "S" ? " succeeded" : " failed") + "</option>").join("")).join("");
    $("#eta-heads").innerHTML = "<thead><tr><th>ID</th><th>Barrier / heading (success state)</th><th>Failure probability from</th><th class=num>p (fail)</th><th>Fault tree (uses its Q)</th><th>Asked</th><th></th></tr></thead><tbody>" +
      m.headings.map((h, i) => "<tr><td><input type=\"text\" class=\"mono\" data-eh=\"" + i + ':id" value="' + esc(h.id) + '"></td><td><input type="text" data-eh="' + i + ':desc" value="' + esc(h.desc) + '"></td><td><select data-eh="' + i + ':src"><option value="fixed"' + (h.src !== "ft" ? " selected" : "") + '>Value</option><option value="ft"' + (h.src === "ft" ? " selected" : "") + ">Fault tree</option></select></td><td>" + (h.src === "ft" ? '<span class="muted">from tree</span>' : '<input type="number" step="any" min="0" max="1" data-eh="' + i + ':p" value="' + esc(h.p) + '">') + "</td><td>" + (h.src === "ft" ? '<select data-eh="' + i + ':ft">' + ftOptions(h.ft) + "</select>" : '<span class="muted">–</span>') + '</td><td><select data-eh="' + i + ':cond">' + opts(h.cond, i) + '</select></td><td><button class="btn icon" data-ehdel="' + i + '">✕</button></td></tr>').join("") + "</tbody>";
    $("#eta-cats").innerHTML = "<thead><tr><th>ID</th><th>Consequence category</th><th class=num>Tolerable frequency (/h)</th><th></th></tr></thead><tbody>" +
      m.cats.map((c, i) => '<tr><td><input type="text" class="mono" data-ec="' + i + ':id" value="' + esc(c.id) + '"></td><td><input type="text" data-ec="' + i + ':name" value="' + esc(c.name) + '"></td><td><input type="number" step="any" data-ec="' + i + ':tol" value="' + esc(c.tol) + '"></td><td><button class="btn icon" data-ecdel="' + i + '">✕</button></td></tr>').join("") + "</tbody>";
  }
  function etaResults() {
    const m = eta(), r = RW.analyseETA(m, H.ftValue);
    const iss = $("#eta-issues"); iss.hidden = r.ok; iss.innerHTML = r.ok ? "" : "<b>Check the model</b><ul>" + r.errors.map(e => "<li>" + esc(e) + "</li>").join("") + "</ul>";
    if (!r.ok) { $("#eta-svg").innerHTML = ""; $("#eta-seq").innerHTML = ""; $("#eta-kpis").innerHTML = ""; return { bad: true, text: "Model error", result: "Model error" }; }
    // diagram
    const Hh = m.headings, n = Hh.length, colW = 132, x0 = 230, rowH = 30, top = 70, outX = x0 + n * colW + 10;
    const ys = r.seqs.map((s, i) => top + i * rowH + rowH / 2), Wd = outX + 420, Hd = top + r.seqs.length * rowH + 16;
    const svg = $("#eta-svg"); svg.setAttribute("viewBox", "0 0 " + Wd + " " + Hd); svg.style.minWidth = Math.min(Wd, 1100) + "px";
    let h = '<rect class="etah" x="0" y="0" width="' + Wd + '" height="56"/>';
    h += '<text class="eth" x="10" y="18">Initiating event</text>' + wrapT(m.init.desc, 10, 33, 30, 2, "etd") + '<text class="etv" x="10" y="66">f = ' + fE(r.f0) + " /h</text>";
    Hh.forEach((hd, i) => { const x = x0 + i * colW; h += '<line class="etsep" x1="' + x + '" x2="' + x + '" y1="0" y2="' + Hd + '"/><text class="eth" x="' + (x + 6) + '" y="18">' + esc(hd.id) + " · p " + fE(r.pf[i], 1) + "</text>" + wrapT(hd.desc, x + 6, 32, 21, 2, "etd"); });
    h += '<text class="eth" x="' + (outX + 4) + '" y="18">#  Sequence · frequency (/h) · consequence</text>';
    // branch lines: group sequences by prefix
    const yOf = p => { const idx = r.seqs.map((s, i) => (s.path.startsWith(p) ? i : -1)).filter(i => i >= 0); return idx.reduce((a, i) => a + ys[i], 0) / idx.length; };
    const rootY = yOf("");
    h += '<path class="etl" d="M180 ' + rootY + " H" + x0 + '"/>';
    for (let i = 0; i < n; i++) {
      const prefixes = Array.from(new Set(r.seqs.map(s => s.path.slice(0, i))));
      prefixes.forEach(p => {
        const kids = Array.from(new Set(r.seqs.filter(s => s.path.startsWith(p)).map(s => s.path.slice(0, i + 1))));
        const yp = yOf(p), x = x0 + i * colW, xn = x + colW;
        const ky = kids.map(k => yOf(k));
        h += '<path class="etl" d="M' + x + " " + Math.min(yp, ...ky) + " V" + Math.max(yp, ...ky) + '"/>';
        kids.forEach((k, j) => { const c = k.slice(-1); h += '<path class="etl' + (c === "F" ? " fail" : "") + '" d="M' + x + " " + ky[j] + " H" + xn + '"/>'; if (c !== "-" && kids.length > 1) h += '<text class="etb" x="' + (x + 4) + '" y="' + (ky[j] - 3) + '">' + (c === "S" ? "yes" : "no") + "</text>"; });
      });
    }
    const catName = id => { const c = (m.cats || []).find(x => x.id === id); return c ? c.name : "—"; };
    r.seqs.forEach((s, i) => { h += '<text class="ets" x="' + (outX + 4) + '" y="' + (ys[i] + 4) + '">' + s.n + "  " + esc(s.path) + "  ·  " + fE(s.f) + "  ·  " + esc(catName(s.cat)) + "</text>"; });
    svg.innerHTML = h;
    // results
    const anyFail = r.cats.some(c => c.pass === false);
    $("#eta-kpis").innerHTML = r.cats.map(c => H.kpi(c.name, fE(c.f) + " /h", (c.tol ? "tolerable " + fE(c.tol) + " " + H.pill(c.pass, "tolerable", "intolerable") : "no limit") + " · " + c.n + " sequence" + (c.n === 1 ? "" : "s"), c.pass)).join("") +
      H.kpi("All sequences", fE(r.total) + " /h", "= initiating frequency (" + esc(r.initSrc) + ")", null);
    $("#eta-seq").innerHTML = "<table><thead><tr><th class=num>#</th><th>Sequence</th>" + Hh.map(x => "<th>" + esc(x.id) + "</th>").join("") + "<th class=num>Probability</th><th class=num>Frequency (/h)</th><th class=num>Per year</th><th>Consequence</th></tr></thead><tbody>" +
      r.seqs.map(s => "<tr><td class=num>" + s.n + "</td><td class=mono>" + esc(s.path) + "</td>" + s.states.map(x => '<td class="mono ' + (x === "F" ? "bad" : "") + '">' + (x === "S" ? "success" : x === "F" ? "fails" : "–") + "</td>").join("") + "<td class=num>" + fE(s.prob) + "</td><td class=num>" + fE(s.f) + "</td><td class=num>" + fE(s.f * 8760) + '</td><td><select data-eo="' + esc(s.path) + '"><option value="">—</option>' + (m.cats || []).map(c => '<option value="' + esc(c.id) + '"' + (c.id === s.cat ? " selected" : "") + ">" + esc(c.name) + "</option>").join("") + "</select></td></tr>").join("") + "</tbody></table>";
    return { bad: anyFail, good: !anyFail && r.cats.some(c => c.pass), text: r.seqs.length + " sequences", result: anyFail ? "Risk intolerable" : "Risk tolerable" };
  }
  function wrapT(text, x, y, max, lines, cls) {
    const words = String(text || "").split(/\s+/), out = []; let cur = "";
    words.forEach(w => { if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) out.push(cur); if (out.length > lines) { out.length = lines; out[lines - 1] += "…"; }
    return out.map((l, i) => '<text class="' + cls + '" x="' + x + '" y="' + (y + i * 12) + '">' + esc(l) + "</text>").join("");
  }
  function etaInput(t, structural) {
    const m = eta();
    if (t.dataset.ei) {
      const k = t.dataset.ei;
      if (k === "src") { if (t.value === "ft") m.init.ft = (H.S.fts[0] || {}).uid; else delete m.init.ft; structural = true; }
      else if (k === "f") m.init.f = num(t.value, 0); else if (k === "mdesc") m.desc = t.value; else m.init[k] = t.value;
    } else if (t.dataset.eh) {
      const [i, k] = t.dataset.eh.split(":"), hd = m.headings[+i];
      if (k === "p") hd.p = Math.min(1, Math.max(0, num(t.value, 0)));
      else if (k === "src") { hd.src = t.value; if (hd.src === "ft" && !hd.ft) hd.ft = (H.S.fts[0] || {}).uid; structural = true; }
      else if (k === "cond") { if (t.value) { const [h, s] = t.value.split(":"); hd.cond = { h, s }; } else delete hd.cond; }
      else if (k === "id") { const old = hd.id; hd.id = t.value.trim(); m.headings.forEach(x => { if (x.cond && x.cond.h === old) x.cond.h = hd.id; }); structural = true; }
      else hd[k] = t.value;
    } else if (t.dataset.ec) {
      const [i, k] = t.dataset.ec.split(":"), c = m.cats[+i];
      if (k === "tol") c.tol = num(t.value, 0); else if (k === "id") { const old = c.id; c.id = t.value.trim(); Object.keys(m.outcomes || {}).forEach(p => { if (m.outcomes[p] === old) m.outcomes[p] = c.id; }); } else c[k] = t.value;
    } else if (t.dataset.eo !== undefined) { m.outcomes = m.outcomes || {}; if (t.value) m.outcomes[t.dataset.eo] = t.value; else delete m.outcomes[t.dataset.eo]; }
    H.save();
    if (structural) formRev++;
    later(() => H.setMode("eta"));
  }

  /* ================= MARKOV ================= */
  const mk = () => H.curModel("mk");
  function mkForms() {
    const m = mk(); m.states = m.states || []; m.trans = m.trans || [];
    $("#mk-set").innerHTML = '<div class="fld"><label>Time horizon for the curves</label><div class="unit"><input type="number" step="any" data-mk="horizon" value="' + esc(m.horizon || "") + '" placeholder="auto"><span>h</span></div></div><div class="fld wide"><label>Description</label><textarea data-mk="desc" rows="2">' + esc(m.desc || "") + "</textarea></div>";
    $("#mk-states").innerHTML = "<thead><tr><th>ID</th><th>State</th><th>System up</th><th>Starts here</th><th></th></tr></thead><tbody>" +
      m.states.map((s, i) => '<tr><td><input type="text" class="mono" data-ms="' + i + ':id" value="' + esc(s.id) + '"></td><td><input type="text" data-ms="' + i + ':name" value="' + esc(s.name || "") + '"></td><td><input type="checkbox" data-ms="' + i + ':up"' + (s.up ? " checked" : "") + '></td><td><input type="radio" name="mkinit" data-ms="' + i + ':init"' + (s.init ? " checked" : "") + '></td><td><button class="btn icon" data-msdel="' + i + '">✕</button></td></tr>').join("") + "</tbody>";
    const so = cur => m.states.map(s => '<option value="' + esc(s.id) + '"' + (s.id === cur ? " selected" : "") + ">" + esc(s.id) + "</option>").join("");
    $("#mk-trans").innerHTML = "<thead><tr><th>From</th><th>To</th><th class=num>Rate (/h)</th><th class=num>Mean time (h)</th><th>Meaning</th><th></th></tr></thead><tbody>" +
      m.trans.map((t, i) => '<tr><td><select data-mt="' + i + ':from">' + so(t.from) + '</select></td><td><select data-mt="' + i + ':to">' + so(t.to) + '</select></td><td><input type="number" step="any" min="0" data-mt="' + i + ':rate" value="' + esc(+(+t.rate).toPrecision(6)) + '"></td><td class="num">' + (num(t.rate, 0) > 0 ? fN(1 / num(t.rate, 1), 1) : "—") + '</td><td><input type="text" data-mt="' + i + ':note" value="' + esc(t.note || "") + '"></td><td><button class="btn icon" data-mtdel="' + i + '">✕</button></td></tr>').join("") + "</tbody>";
  }
  function mkResults() {
    const m = mk(), r = RW.analyseMarkov(m);
    const iss = $("#mk-issues"); iss.hidden = r.ok; iss.innerHTML = r.ok ? "" : "<b>Check the model</b><ul>" + r.errors.map(e => "<li>" + esc(e) + "</li>").join("") + "</ul>";
    drawMarkov(m, r);
    if (!r.ok) { $("#mk-kpis").innerHTML = ""; $("#mk-pi").innerHTML = ""; $("#mk-curve").innerHTML = ""; return { bad: true, text: "Model error", result: "Model error" }; }
    $("#mk-kpis").innerHTML = H.kpi("Steady-state availability", fP(r.A, 6), "sum of the up-state probabilities", null) +
      H.kpi("Failure frequency", fE(r.W) + " /h", "transitions from up to down states", null) +
      H.kpi("Mean up time (MUT)", fN(r.mut) + " h", "= A / failure frequency", null) +
      H.kpi("Mean down time (MDT)", fN(r.mdt, 2) + " h", "= (1 − A) / failure frequency", null) +
      H.kpi("Mean time to first failure", r.mttff == null ? "—" : fN(r.mttff) + " h", "from the starting state, down states absorbing", null);
    $("#mk-pi").innerHTML = "<table><thead><tr><th>State</th><th></th><th class=num>Probability</th><th class=num>Hours per year</th><th class=num>Mean stay (h)</th></tr></thead><tbody>" + r.pi.map(s => "<tr><td class=mono>" + esc(s.id) + "</td><td>" + esc(s.name || "") + " " + (s.up ? '<span class="pill pass">up</span>' : '<span class="pill fail">down</span>') + "</td><td class=num>" + fE(s.p, 4) + "</td><td class=num>" + fN(s.p * 8760, 3) + "</td><td class=num>" + (isFinite(s.stay) ? fN(s.stay, 1) : "∞") + "</td></tr>").join("") + "</tbody></table>";
    chart($("#mk-curve"), [{ pts: r.curve.map(p => [p.t, p.A]), label: "availability A(t)" }, { pts: r.curve.map(p => [p.t, p.R]), label: "reliability R(t), no recovery" }], { xl: "time (h)", yl: "", fmtX: v => fN(v), fmtY: v => v.toFixed(4), ymin: Math.max(0, 1 - (1 - Math.min(...r.curve.map(p => Math.min(p.R, p.A)))) * 1.3 - 1e-6), ymax: 1, fmtY: v => v.toFixed(6) });
    return { text: "Solved · " + r.pi.length + " states", result: "A = " + fP(r.A, 4) };
  }
  function drawMarkov(m, r) {
    const svg = $("#mk-svg"), S = m.states || [], n = S.length, W = 760, Hh = 360, cx = W / 2, cy = Hh / 2, R = Math.min(130, 40 + n * 22);
    svg.setAttribute("viewBox", "0 0 " + W + " " + Hh);
    const pos = S.map((s, i) => { const a = -Math.PI / 2 + (n === 2 ? Math.PI / 2 : 0) + i * 2 * Math.PI / Math.max(1, n); return [cx + R * 1.5 * Math.cos(a), cy + R * Math.sin(a)]; });
    let h = '<defs><marker id="mkarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" class="arrh"/></marker></defs>';
    (m.trans || []).forEach(t => {
      const a = S.findIndex(s => s.id === t.from), b = S.findIndex(s => s.id === t.to); if (a < 0 || b < 0 || a === b) return;
      const [x1, y1] = pos[a], [x2, y2] = pos[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, r0 = 34;
      const sx = x1 + ux * r0, sy = y1 + uy * r0, ex = x2 - ux * r0, ey = y2 - uy * r0, nx = -uy * 26, ny = ux * 26;
      const mx = (sx + ex) / 2 + nx, my = (sy + ey) / 2 + ny;
      h += '<path class="mkt" d="M' + sx + " " + sy + " Q" + mx + " " + my + " " + ex + " " + ey + '" marker-end="url(#mkarr)"/><text class="mkl" x="' + ((sx + ex) / 2 + nx * 1.1) + '" y="' + ((sy + ey) / 2 + ny * 1.1 + 4) + '" text-anchor="middle">' + fE(num(t.rate, 0), 2) + "</text>";
    });
    S.forEach((s, i) => { const [x, y] = pos[i], p = r && r.ok ? r.pi[i].p : null; h += '<g class="mks ' + (s.up ? "up" : "dn") + '"><circle cx="' + x + '" cy="' + y + '" r="32"/><text class="mkid" x="' + x + '" y="' + (y - 2) + '" text-anchor="middle">' + esc(s.id) + "</text>" + (p != null ? '<text class="mkp" x="' + x + '" y="' + (y + 13) + '" text-anchor="middle">' + fE(p, 2) + "</text>" : "") + (s.init ? '<text class="mkp" x="' + x + '" y="' + (y - 38) + '" text-anchor="middle">start</text>' : "") + "</g>"; });
    svg.innerHTML = h;
  }
  function mkInput(t, structural) {
    const m = mk();
    if (t.dataset.mk) { const k = t.dataset.mk; m[k] = k === "horizon" ? num(t.value, 0) : t.value; }
    else if (t.dataset.ms) { const [i, k] = t.dataset.ms.split(":"), s = m.states[+i];
      if (k === "up") s.up = t.checked; else if (k === "init") { m.states.forEach(x => (x.init = false)); s.init = true; }
      else if (k === "id") { const old = s.id; s.id = t.value.trim(); m.trans.forEach(x => { if (x.from === old) x.from = s.id; if (x.to === old) x.to = s.id; }); structural = true; } else s[k] = t.value; }
    else if (t.dataset.mt) { const [i, k] = t.dataset.mt.split(":"), x = m.trans[+i]; if (k === "rate") x.rate = num(t.value, 0); else x[k] = t.value; }
    H.save(); if (structural) formRev++; later(() => H.setMode("mk"));
  }

  /* ================= WEIBULL ================= */
  const wb = () => H.curModel("wb");
  function wbForms() {
    const m = wb(); m.data = m.data || [];
    $("#wb-data").value = m.data.map(d => d.t + (d.failed === false ? " S" : "")).join("\n");
    const blocks = H.rbdBlocks();
    $("#wb-block").innerHTML = blocks.map(b => '<option value="' + esc(b.id) + '">' + esc(b.id + " – " + (b.name || "")) + "</option>").join("");
    $("#wb-rbdname").textContent = H.curModel("rbd").name || "";
  }
  function parseData(text) { return text.split(/[\n;,]+/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^([0-9.eE+]+)\s*([sSfF]?)/); return m ? { t: parseFloat(m[1]), failed: !/s/i.test(m[2]) } : null; }).filter(x => x && x.t > 0); }
  let wbFit = null;
  function wbResults() {
    const m = wb(), r = RW.fitWeibull(m.data); wbFit = r;
    const iss = $("#wb-issues"); iss.hidden = r.ok; iss.innerHTML = r.ok ? "" : esc(r.errors.join(" "));
    if (!r.ok) { $("#wb-kpis").innerHTML = ""; $("#wb-plot").innerHTML = ""; return { bad: true, text: "Not enough data", result: "—" }; }
    const shape = b => (b < 0.95 ? "early-life (infant mortality)" : b <= 1.05 ? "random (constant rate)" : b < 3 ? "wear-out (gradual)" : "wear-out (rapid)");
    $("#wb-kpis").innerHTML = H.kpi("β (rank regression)", fN(r.rr.beta, 3), esc(shape(r.rr.beta)) + " · R² " + fN(r.rr.r2, 4), null) +
      H.kpi("η (rank regression)", fN(r.rr.eta) + " h", "63.2 % have failed by η", null) +
      H.kpi("Mean life (RR)", fN(r.rr.mttf) + " h", "η·Γ(1 + 1/β)", null) +
      H.kpi("β (maximum likelihood)", fN(r.mle.beta, 3), esc(shape(r.mle.beta)), null) +
      H.kpi("η (maximum likelihood)", fN(r.mle.eta) + " h", "mean life " + fN(r.mle.mttf) + " h", null) +
      H.kpi("Data", r.r + " failures", (r.N - r.r) + " suspensions · " + r.N + " units", null);
    // Weibull probability plot: x = ln t, y = ln(−ln(1−F))
    const pts = r.pts.map(p => [Math.log(p.t), Math.log(-Math.log(1 - p.F))]);
    const xs = pts.map(p => p[0]), lo = Math.min(...xs) - 0.3, hi = Math.max(...xs) + 0.3;
    const line = (b, e) => [[lo, b * (lo - Math.log(e))], [hi, b * (hi - Math.log(e))]];
    const Fs = [0.01, 0.05, 0.1, 0.3, 0.632, 0.9, 0.99], yt = Fs.map(F => Math.log(-Math.log(1 - F)));
    const tt = []; for (let k = Math.floor(lo / Math.LN10); k <= Math.ceil(hi / Math.LN10); k++) [1, 2, 5].forEach(mm => { const v = Math.log(mm * Math.pow(10, k)); if (v >= lo && v <= hi) tt.push(v); });
    chart($("#wb-plot"), [{ pts, dots: true, label: "failures (median ranks)" }, { pts: line(r.rr.beta, r.rr.eta), label: "rank regression" }, { pts: line(r.mle.beta, r.mle.eta), label: "maximum likelihood" }], { xl: "time (h, log scale)", yl: "unreliability F(t)", fmtX: v => fN(Math.exp(v)), fmtY: v => { const F = 1 - Math.exp(-Math.exp(v)); return fN(F * 100, F < 0.1 ? 0 : 1) + " %"; }, xmin: lo, xmax: hi, ymin: yt[0], ymax: yt[yt.length - 1], yticks: yt, xticks: tt });
    return { text: r.r + " failures fitted", result: "β " + fN(r.rr.beta, 2) + " · η " + fN(r.rr.eta) + " h" };
  }

  /* ================= PROJECT SUMMARY (SIL register) ================= */
  function renderSum() {
    const S = H.S;
    const fts = S.fts.map((m, i) => { const r = H.analyseFTModel(m); return { m, i, r }; });
    const nFail = fts.filter(x => x.r.ok && x.r.top.pass === false).length;
    $("#sum-ft").innerHTML = "<table><thead><tr><th>Safety function / fault tree</th><th class=num>Target THR (/h)</th><th class=num>W achieved (/h)</th><th>SIL band of W</th><th class=num>Q</th><th class=num>Cut sets</th><th>Main contributor</th><th>Result</th><th></th></tr></thead><tbody>" +
      fts.map(({ m, i, r }) => { if (!r.ok) return "<tr><td>" + esc(m.name) + '</td><td colspan="7" class="bad">' + esc(r.errors[0] || "Model error") + '</td><td><button class="btn sm" data-open="ft:' + i + '">Open</button></td></tr>'; const c = r.cutsets[0]; return "<tr><td>" + esc(m.name) + "</td><td class=num>" + (m.thr ? fE(m.thr) : "—") + "</td><td class=num>" + fE(r.top.W) + "</td><td>" + esc(r.top.sil) + "</td><td class=num>" + fE(r.top.Q) + "</td><td class=num>" + r.cutsets.length + "</td><td>" + (c ? '<span class="mono">' + esc(c.ids.join(" · ")) + "</span> " + fN(c.shareW * 100, 0) + " %" : "—") + "</td><td>" + H.pill(r.top.pass, "meets THR", "THR exceeded") + '</td><td><button class="btn sm" data-open="ft:' + i + '">Open</button></td></tr>'; }).join("") + "</tbody></table>";
    $("#sum-rbd").innerHTML = "<table><thead><tr><th>Block diagram</th><th class=num>Availability</th><th class=num>Target</th><th class=num>MTBSAF (h)</th><th class=num>Target</th><th class=num>Single points</th><th class=num>Subsystems over budget</th><th></th></tr></thead><tbody>" +
      S.rbds.map((m, i) => { const r = H.analyseRBDModel(m); if (!r.ok) return "<tr><td>" + esc(m.name) + '</td><td colspan="6" class="bad">' + esc(r.errors[0]) + '</td><td><button class="btn sm" data-open="rbd:' + i + '">Open</button></td></tr>'; const s = r.system, over = r.subs.filter(x => x.passBudget === false).length; return "<tr><td>" + esc(m.name) + "</td><td class=num>" + fP(s.A, 5) + "</td><td class=num>" + (s.targetA ? fN(s.targetA, 4) + " % " + H.pill(s.passA) : "—") + "</td><td class=num>" + fN(s.mtbsaf) + "</td><td class=num>" + (s.targetM ? fN(s.targetM) + " " + H.pill(s.passM) : "—") + "</td><td class=num>" + r.spf.length + "</td><td class=num>" + over + '</td><td><button class="btn sm" data-open="rbd:' + i + '">Open</button></td></tr>'; }).join("") + "</tbody></table>";
    $("#sum-eta").innerHTML = S.etas.length ? "<table><thead><tr><th>Event tree</th><th class=num>Initiating frequency (/h)</th><th>Worst category against its tolerable frequency</th><th>Result</th><th></th></tr></thead><tbody>" +
      S.etas.map((m, i) => { const r = RW.analyseETA(m, H.ftValue); if (!r.ok) return "<tr><td>" + esc(m.name) + '</td><td colspan="3" class="bad">' + esc(r.errors[0]) + '</td><td><button class="btn sm" data-open="eta:' + i + '">Open</button></td></tr>'; const w = r.cats.filter(c => c.ratio != null).sort((a, b) => b.ratio - a.ratio)[0]; const bad = r.cats.some(c => c.pass === false); return "<tr><td>" + esc(m.name) + "</td><td class=num>" + fE(r.f0) + "</td><td>" + (w ? esc(w.name) + ": " + fE(w.f) + " vs " + fE(w.tol) + " (" + fN(w.ratio * 100, 0) + " %)" : "—") + "</td><td>" + H.pill(w ? !bad : null, "tolerable", "intolerable") + '</td><td><button class="btn sm" data-open="eta:' + i + '">Open</button></td></tr>'; }).join("") + "</tbody></table>" : '<p class="muted">No event trees.</p>';
    $("#sum-mk").innerHTML = S.mks.length ? "<table><thead><tr><th>Markov model</th><th class=num>Availability</th><th class=num>MUT (h)</th><th class=num>MTTFF (h)</th><th></th></tr></thead><tbody>" + S.mks.map((m, i) => { const r = RW.analyseMarkov(m); return "<tr><td>" + esc(m.name) + "</td><td class=num>" + (r.ok ? fP(r.A, 6) : "error") + "</td><td class=num>" + (r.ok ? fN(r.mut) : "—") + "</td><td class=num>" + (r.ok && r.mttff != null ? fN(r.mttff) : "—") + '</td><td><button class="btn sm" data-open="mk:' + i + '">Open</button></td></tr>'; }).join("") + "</tbody></table>" : '<p class="muted">No Markov models.</p>';
    $("#sum-wb").innerHTML = S.wbs.length ? "<table><thead><tr><th>Weibull data set</th><th class=num>Failures</th><th class=num>β (RR)</th><th class=num>η (RR, h)</th><th class=num>β (MLE)</th><th class=num>η (MLE, h)</th><th></th></tr></thead><tbody>" + S.wbs.map((m, i) => { const r = RW.fitWeibull(m.data); return "<tr><td>" + esc(m.name) + "</td><td class=num>" + (r.ok ? r.r : "—") + "</td><td class=num>" + (r.ok ? fN(r.rr.beta, 3) : "—") + "</td><td class=num>" + (r.ok ? fN(r.rr.eta) : "—") + "</td><td class=num>" + (r.ok ? fN(r.mle.beta, 3) : "—") + "</td><td class=num>" + (r.ok ? fN(r.mle.eta) : "—") + '</td><td><button class="btn sm" data-open="wb:' + i + '">Open</button></td></tr>'; }).join("") + "</tbody></table>" : '<p class="muted">No Weibull data sets.</p>';
    $("#sum-note").textContent = S.fts.length + " fault trees · " + S.etas.length + " event trees · " + S.rbds.length + " block diagrams · " + S.mks.length + " Markov · " + S.wbs.length + " Weibull";
    return { bad: nFail > 0, good: nFail === 0, text: "Project of " + (S.fts.length + S.rbds.length + S.etas.length + S.mks.length + S.wbs.length) + " models", result: nFail ? nFail + " THR not met" : "All THR met" };
  }

  /* ================= Excel export of the extra workspaces ================= */
  function exportXlsx(mode) {
    const wbk = XLSX.utils.book_new(), add = (n, rows) => XLSX.utils.book_append_sheet(wbk, XLSX.utils.aoa_to_sheet(rows), n), S = H.S;
    const head = [["Rail-IQ RAMS Workbench export"], ["Project", S.project.name], ["Document ref.", S.project.doc], ["Exported", new Date().toISOString()]];
    let file = "RailIQ_" + mode;
    if (mode === "eta") { const m = eta(), r = RW.analyseETA(m, H.ftValue); file = "RailIQ_ETA"; add("Summary", head.concat([[], ["Event tree", m.name], ["Initiating event", m.init.desc], ["Initiating frequency (/h)", r.ok ? r.f0 : ""]]));
      add("Headings", [["ID", "Description", "Source", "Failure probability", "Fault tree", "Asked only if"]].concat(m.headings.map((h, i) => [h.id, h.desc, h.src, r.ok ? r.pf[i] : h.p, h.src === "ft" ? (S.fts.find(f => f.uid === h.ft) || {}).name || "" : "", h.cond ? h.cond.h + " " + (h.cond.s === "S" ? "succeeded" : "failed") : ""])));
      if (r.ok) { add("Sequences", [["#", "Sequence", "Probability", "Frequency (/h)", "Consequence"]].concat(r.seqs.map(s => [s.n, s.path, s.prob, s.f, ((m.cats || []).find(c => c.id === s.cat) || {}).name || ""]))); add("Categories", [["Category", "Frequency (/h)", "Tolerable (/h)", "Tolerable?"]].concat(r.cats.map(c => [c.name, c.f, c.tol, c.pass == null ? "" : c.pass ? "yes" : "no"]))); } }
    else if (mode === "mk") { const m = mk(), r = RW.analyseMarkov(m); file = "RailIQ_Markov"; add("Summary", head.concat([[], ["Markov model", m.name], ["Availability", r.ok ? r.A : ""], ["Failure frequency (/h)", r.ok ? r.W : ""], ["MUT (h)", r.ok ? r.mut : ""], ["MDT (h)", r.ok ? r.mdt : ""], ["MTTFF (h)", r.ok ? r.mttff : ""]]));
      add("States", [["ID", "Name", "Up", "Initial", "Probability"]].concat(m.states.map((s, i) => [s.id, s.name || "", s.up ? "Y" : "N", s.init ? "Y" : "", r.ok ? r.pi[i].p : ""]))); add("Transitions", [["From", "To", "Rate (/h)", "Note"]].concat(m.trans.map(t => [t.from, t.to, t.rate, t.note || ""]))); }
    else if (mode === "wb") { const m = wb(), r = RW.fitWeibull(m.data); file = "RailIQ_Weibull"; add("Summary", head.concat([[], ["Data set", m.name], ["Beta (RR)", r.ok ? r.rr.beta : ""], ["Eta (RR, h)", r.ok ? r.rr.eta : ""], ["R2", r.ok ? r.rr.r2 : ""], ["Beta (MLE)", r.ok ? r.mle.beta : ""], ["Eta (MLE, h)", r.ok ? r.mle.eta : ""]])); add("Data", [["Time (h)", "Failure (F) / suspension (S)"]].concat(m.data.map(d => [d.t, d.failed === false ? "S" : "F"]))); }
    else { file = "RailIQ_Project_Summary"; add("Summary", head);
      add("SIL register", [["Fault tree", "Target THR (/h)", "W (/h)", "SIL band", "Q", "Meets THR"]].concat(S.fts.map(m => { const r = H.analyseFTModel(m); return r.ok ? [m.name, m.thr || "", r.top.W, r.top.sil, r.top.Q, r.top.pass == null ? "" : r.top.pass ? "yes" : "no"] : [m.name, m.thr || "", "error"]; })));
      add("Block diagrams", [["RBD", "Availability", "Target (%)", "MTBSAF (h)", "Target (h)", "Single points of failure"]].concat(S.rbds.map(m => { const r = H.analyseRBDModel(m); return r.ok ? [m.name, r.system.A, m.targetA || "", r.system.mtbsaf, m.targetMTBSAF || "", r.spf.join(", ")] : [m.name, "error"]; }))); }
    XLSX.writeFile(wbk, file + ".xlsx"); H.toast("Excel workbook saved.");
  }

  /* ================= wiring ================= */
  function render(mode) {
    if (mode !== lastMode) { formRev++; lastMode = mode; }
    const key = mode + ":" + ((KIND_OK[mode] && H.curModel(mode).uid) || "") + ":" + formRev;
    const forms = key !== formKey; formKey = key;
    if (mode === "eta") { if (forms) etaForms(); return etaResults(); }
    if (mode === "mk") { if (forms) mkForms(); return mkResults(); }
    if (mode === "wb") { if (forms) wbForms(); return wbResults(); }
    if (mode === "sum") return renderSum();
    return null;
  }
  function init(host) {
    H = host;
    // uncertainty
    $("#b-unc").addEventListener("click", runUnc);
    // event tree
    const ws = $("#ws-eta");
    ws.addEventListener("input", e => { const t = e.target; if (t.tagName === "SELECT" || t.type === "checkbox") return; if (t.dataset.ei || t.dataset.eh || t.dataset.ec) etaInput(t, false); });
    ws.addEventListener("change", e => { const t = e.target; if (t.tagName === "SELECT") etaInput(t, false); });
    ws.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const m = eta();
      if (b.id === "eta-addh") { let i = m.headings.length + 1; while (m.headings.some(h => h.id === "H" + i)) i++; m.headings.push({ id: "H" + i, desc: "Barrier works", src: "fixed", p: 0.01 }); }
      else if (b.id === "eta-addc") { let i = m.cats.length + 1; while (m.cats.some(c => c.id === "C" + i)) i++; m.cats.push({ id: "C" + i, name: "Category " + i, tol: 1e-7 }); }
      else if (b.dataset.ehdel != null) { const h = m.headings.splice(+b.dataset.ehdel, 1)[0]; m.headings.forEach(x => { if (x.cond && x.cond.h === h.id) delete x.cond; }); m.outcomes = {}; }
      else if (b.dataset.ecdel != null) m.cats.splice(+b.dataset.ecdel, 1); else return;
      formRev++; H.save(); H.setMode("eta"); });
    // markov
    const wm = $("#ws-mk");
    wm.addEventListener("input", e => { const t = e.target; if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio") return; if (t.dataset.mk || t.dataset.ms || t.dataset.mt) mkInput(t, false); });
    wm.addEventListener("change", e => { const t = e.target; if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio") mkInput(t, false); });
    wm.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; const m = mk();
      if (b.id === "mk-adds") { let i = m.states.length; while (m.states.some(s => s.id === "S" + i)) i++; m.states.push({ id: "S" + i, name: "New state", up: true }); }
      else if (b.id === "mk-addt") m.trans.push({ from: (m.states[0] || {}).id, to: (m.states[1] || {}).id, rate: 1e-4 });
      else if (b.dataset.msdel != null) { const s = m.states.splice(+b.dataset.msdel, 1)[0]; m.trans = m.trans.filter(t => t.from !== s.id && t.to !== s.id); }
      else if (b.dataset.mtdel != null) m.trans.splice(+b.dataset.mtdel, 1); else return;
      formRev++; H.save(); H.setMode("mk"); });
    // weibull
    $("#wb-data").addEventListener("input", e => { wb().data = parseData(e.target.value); H.save(); later(() => { const st = wbResults(); $("#status span").textContent = st.text; }); });
    $("#wb-apply").addEventListener("click", () => {
      if (!wbFit || !wbFit.ok) { H.toast("Fit the data first."); return; }
      const id = $("#wb-block").value, b = H.rbdBlocks().find(x => x.id === id); if (!b) { H.toast("Choose a block."); return; }
      const f = $("#wb-method").value === "mle" ? wbFit.mle : wbFit.rr;
      b.dist = "weibull"; b.beta = +f.beta.toFixed(4); b.eta = Math.round(f.eta); b.ref = "Weibull fit of " + wb().name + " (" + ($("#wb-method").value === "mle" ? "MLE" : "rank regression") + ")";
      H.save(); H.toast("Block " + id + " now uses Weibull β " + fN(f.beta, 3) + ", η " + fN(f.eta) + " h.");
    });
    // summary
    $("#ws-sum").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (!b) return; const [k, i] = b.dataset.open.split(":"); H.openModel(k, +i); });
  }
  window.RWExt = { init, render, exportXlsx };
})();

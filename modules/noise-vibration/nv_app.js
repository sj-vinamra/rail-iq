/* Rail-IQ Noise & Vibration — page logic. */
(function () {
  "use strict";
  const NV = window.NV, $ = s => document.querySelector(s), KEY = "railiq.nv.model";
  const PRESET = { ballast: 0, aerial: 4, embedded: 3, turnout: 6 };
  let model, res = [], tests = [], tmr, sysBar = null;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = (x, d = 0) => (isFinite(x) ? Number(x).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
  const db = x => (isFinite(x) ? nf(x, 1) : "—");
  const pill = p => (p == null ? '<span class="pill na">no check</span>' : p ? '<span class="pill pass">pass</span>' : '<span class="pill fail">over</span>');
  function nice(max, n) { const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); }

  /* ---------------- model ---------------- */
  function normalise(m) {
    const s = window.NV_SAMPLE();
    ["project", "traffic", "source", "site", "vib"].forEach(k => (m[k] = Object.assign({}, s[k], m[k] || {})));
    m.receptors = (m.receptors || []).map(r => Object.assign({ name: "Receptor", dist: 20, height: 1.5, barrier: false, adjBuilding: -5, limNoise: 65, limVib: 72, limGbn: 35 }, r));
    if (!m.receptors.length) m.receptors = s.receptors;
    m.selected = Math.min(Math.max(0, +m.selected || 0), m.receptors.length - 1);
    return m;
  }
  function load() { try { const v = localStorage.getItem(KEY); if (v) { const m = JSON.parse(v); if (m && m.traffic) return normalise(m); } } catch (e) { /* ignore */ } return normalise(window.NV_SAMPLE()); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(model)); } catch (e) { /* ignore */ } }
  const getK = p => p.split(".").reduce((o, k) => (o == null ? o : o[k]), model);
  function setK(p, v) { const ks = p.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], model)[last] = v; }

  /* ---------------- inputs ---------------- */
  function fillInputs() { document.querySelectorAll("[data-k]").forEach(el => { const v = getK(el.dataset.k); if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? ""; }); }
  function wireInputs() {
    const h = e => {
      const el = e.target, k = el.dataset.k; if (!k) return;
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (el.type === "number" || (el.tagName === "SELECT" && v !== "" && isFinite(+v))) v = v === "" ? "" : +v;
      setK(k, v);
      if (k === "source.adjPreset" && v in PRESET) { model.source.adj = PRESET[v]; fillInputs(); }
      if (k === "source.adj") { model.source.adjPreset = Object.keys(PRESET).find(p => PRESET[p] === +v) || "custom"; const s = document.querySelector('[data-k="source.adjPreset"]'); if (s) s.value = model.source.adjPreset; }
      schedule();
    };
    document.addEventListener("input", h);
    document.addEventListener("change", e => { if (e.target.dataset.k && e.target.tagName === "SELECT") h(e); });
  }

  /* ---------------- receptors table ---------------- */
  const RCOLS = [["name", "Receptor", "text", 200], ["dist", "Distance (m)", "number", 80], ["height", "Height (m)", "number", 70], ["barrier", "Barrier", "check", 0],
    ["adjBuilding", "Building adj. (dB)", "number", 80], ["limNoise", "Noise limit (dBA)", "number", 80], ["limVib", "Vibration limit (VdB)", "number", 80], ["limGbn", "GBN limit (dBA)", "number", 80]];
  function renderReceptors() {
    $("#rectable").innerHTML = "<thead><tr>" + RCOLS.map(c => "<th" + (c[2] === "number" ? ' class="num"' : "") + ">" + c[1] + "</th>").join("") + "<th></th></tr></thead><tbody>" +
      model.receptors.map((r, i) => "<tr>" + RCOLS.map(c => c[2] === "check"
        ? '<td style="text-align:center"><input type="checkbox" data-ri="' + i + '" data-rf="' + c[0] + '"' + (r[c[0]] ? " checked" : "") + ' aria-label="' + c[1] + '"></td>'
        : '<td><input type="' + c[2] + '" step="any" data-ri="' + i + '" data-rf="' + c[0] + '" value="' + esc(r[c[0]]) + '" style="min-width:' + c[3] + 'px" aria-label="' + c[1] + '"></td>').join("") +
        '<td><button class="btn icon sm" data-rdel="' + i + '" title="Delete receptor" aria-label="Delete receptor">✕</button></td></tr>').join("") + "</tbody>";
    $("#cnt-rec").textContent = model.receptors.length;
  }
  function wireReceptors() {
    const t = $("#rectable");
    const h = e => { const el = e.target, f = el.dataset.rf; if (!f) return; const r = model.receptors[+el.dataset.ri]; r[f] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value; schedule(); };
    t.addEventListener("input", h); t.addEventListener("change", e => { if (e.target.type === "checkbox") h(e); });
    t.addEventListener("click", e => { const b = e.target.closest("[data-rdel]"); if (!b) return; if (model.receptors.length === 1) { toast("Keep at least one receptor"); return; } model.receptors.splice(+b.dataset.rdel, 1); model.selected = Math.min(model.selected, model.receptors.length - 1); renderReceptors(); recompute(); });
    $("#b-addrec").onclick = () => { const l = model.receptors[model.receptors.length - 1] || {}; model.receptors.push({ ...l, name: "R" + (model.receptors.length + 1) + " New receptor" }); renderReceptors(); recompute(); };
  }

  /* ---------------- compute ---------------- */
  function schedule() { clearTimeout(tmr); tmr = setTimeout(recompute, 150); }
  function recompute() {
    res = NV.evaluate(model);
    const t = model.traffic, perDay = NV.perHour(t.headwayDay, t.directions) * Math.min(15, +t.hoursDay || 0) + NV.perHour(t.headwayNight, t.directions) * Math.min(9, +t.hoursNight || 0);
    $("#c-pass").textContent = nf(perDay) + " (both directions)";
    const chk = res.filter(r => r.pass != null), ok = chk.filter(r => r.pass).length;
    $("#tb-result").textContent = chk.length ? ok + " of " + chk.length + " pass" : "No checks";
    $("#tb-result").style.color = !chk.length ? "var(--ink-2)" : ok === chk.length ? "var(--pass)" : "var(--fail)";
    const st = $("#status"); st.classList.toggle("bad", ok < chk.length); st.querySelector("span").textContent = ok === chk.length ? "All receptors meet their criteria" : chk.length - ok + " receptor(s) over a limit";
    renderResults(); save(); publishToSystem(ok, chk.length);
  }

  function renderResults() {
    const met = model.site.metric === "Lpeak" ? "LAeq peak hour" : "Ldn";
    const worstN = res.reduce((m, r) => (!m || r.noise > m.noise ? r : m), null), worstV = res.reduce((m, r) => (!m || r.Lv > m.Lv ? r : m), null);
    const sel = model.receptors[model.selected] || model.receptors[0];
    const scr = NV.screening(model, sel.limNoise, sel.limVib);
    const k = (cls, l, v, s) => '<div class="kpi ' + cls + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s">' + s + "</div></div>";
    const chk = res.filter(r => r.pass != null), ok = chk.filter(r => r.pass).length;
    $("#kpis").innerHTML =
      k(ok === chk.length ? "pass" : "fail", "Receptors meeting criteria", ok + "<small> / " + chk.length + "</small>", "noise, vibration and ground-borne noise") +
      k(worstN && worstN.okN === false ? "fail" : "", "Highest noise (" + met + ")", db(worstN && worstN.noise) + "<small> dBA</small>", worstN ? esc(worstN.r.name) : "") +
      k(worstV && worstV.okV === false ? "fail" : "", "Highest vibration", db(worstV && worstV.Lv) + "<small> VdB</small>", worstV ? esc(worstV.r.name) : "") +
      k("", "Noise screening distance", scr.noise == null ? "—" : !isFinite(scr.noise) ? "&gt; 5 km" : nf(scr.noise, 0) + "<small> m</small>", "to " + esc(sel.limNoise) + " dBA " + met + ", no barrier") +
      k("", "Vibration screening distance", scr.vib == null ? "—" : !isFinite(scr.vib) ? "&gt; 5 km" : nf(scr.vib, 0) + "<small> m</small>", "to " + esc(sel.limVib) + " VdB, building adj. 0");
    $("#rec-note").textContent = "criterion metric: " + met + " · selected receptor sets the screening limits";
    const cell = (v, ok) => '<td class="num' + (ok === false ? " over" : "") + '">' + db(v) + "</td>";
    $("#recres").innerHTML = '<table><thead><tr><th>Receptor</th><th class="num">Dist. (m)</th><th class="num">Barrier IL</th><th class="num">SEL</th><th class="num">Ld</th><th class="num">Ln</th><th class="num">Ldn</th><th class="num">LAeq peak</th><th class="num">Lmax ≈</th><th class="num">Noise limit</th><th class="num">Lv (VdB)</th><th class="num">Limit</th><th class="num">GBN (dBA)</th><th class="num">Limit</th><th>Result</th></tr></thead><tbody>' +
      res.map((x, i) => '<tr class="click' + (i === model.selected ? " sel" : "") + '" data-pick="' + i + '"><td>' + esc(x.r.name) + '</td><td class="num">' + nf(x.d, 0) + '</td><td class="num">' + (x.r.barrier ? db(x.br.IL) : "—") + '</td><td class="num">' + db(x.sel) + '</td><td class="num">' + db(x.L.Ld) + '</td><td class="num">' + db(x.L.Ln) + "</td>" +
        cell(x.L.Ldn, model.site.metric === "Ldn" ? x.okN : null) + cell(x.L.Lpeak, model.site.metric === "Lpeak" ? x.okN : null) + '<td class="num">' + db(x.L.Lmax) + '</td><td class="num">' + esc(x.r.limNoise) + "</td>" +
        cell(x.Lv, x.okV) + '<td class="num">' + esc(x.r.limVib) + "</td>" + cell(x.Lg, x.okG) + '<td class="num">' + esc(x.r.limGbn) + "</td><td>" + pill(x.pass) + "</td></tr>").join("") + "</tbody></table>";
    $("#selrec").innerHTML = model.receptors.map((r, i) => '<option value="' + i + '"' + (i === model.selected ? " selected" : "") + ">" + esc(r.name) + "</option>").join("");
    renderCurve("noise"); renderCurve("vib"); renderSection();
  }

  /* ---------------- level against distance (log distance axis) ---------------- */
  function renderCurve(kind) {
    const svg = $(kind === "noise" ? "#noisechart" : "#vibchart"), W = Math.max(320, svg.clientWidth || 600), H = 280, L = 48, R = 16, T = 14, B = 40;
    const dMin = 5, dMax = Math.max(200, ...model.receptors.map(r => +r.dist * 1.5));
    const f = kind === "noise" ? d => NV.noiseMetric(model, NV.levels(model, NV.selAt(model, d, 0))) : d => NV.vibAt(model, d, 0);
    const pts = []; for (let i = 0; i <= 120; i++) { const d = dMin * Math.pow(dMax / dMin, i / 120); pts.push([d, f(d)]); }
    const vals = pts.map(p => p[1]).concat(res.map(r => kind === "noise" ? r.noise : r.Lv)).concat(model.receptors.map(r => +(kind === "noise" ? r.limNoise : r.limVib)).filter(isFinite));
    const step = nice(Math.max(10, Math.max(...vals) - Math.min(...vals)), 5);
    const lo = Math.floor((Math.min(...vals) - 3) / step) * step, hi = Math.ceil((Math.max(...vals) + 3) / step) * step;
    const sx = d => L + (Math.log10(d / dMin) / Math.log10(dMax / dMin)) * (W - L - R), sy = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    let g = "";
    for (let v = lo; v <= hi + 1e-9; v += step) g += '<line class="gr" x1="' + L + '" y1="' + sy(v) + '" x2="' + (W - R) + '" y2="' + sy(v) + '"/><text x="' + (L - 6) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + nf(v, 0) + "</text>";
    [5, 10, 20, 50, 100, 200, 500, 1000].filter(d => d >= dMin && d <= dMax).forEach(d => (g += '<line class="gr" x1="' + sx(d) + '" y1="' + T + '" x2="' + sx(d) + '" y2="' + (H - B) + '"/><text x="' + sx(d) + '" y="' + (H - 22) + '" text-anchor="middle">' + d + "</text>"));
    g += '<text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end" style="fill:var(--ink-3)">distance from track centre (m, log scale) · ' + (kind === "noise" ? (model.site.metric === "Lpeak" ? "LAeq peak hour" : "Ldn") + " (dBA)" : "Lv (VdB)") + "</text>";
    const limits = [...new Set(model.receptors.map(r => (kind === "noise" ? r.limNoise : r.limVib)).filter(x => x !== "" && x != null).map(Number))];
    let lastY = -1e9, shift = 0;
    limits.sort((a, b) => b - a).forEach(l => {
      const y = sy(l); shift = y - lastY < 13 ? shift + 70 : 0; lastY = y;   // stagger labels of close limits
      g += '<line x1="' + L + '" y1="' + y + '" x2="' + (W - R) + '" y2="' + y + '" style="stroke:var(--limit);stroke-dasharray:5 4;stroke-width:1.3"/><text x="' + (W - R - 4 - shift) + '" y="' + (y - 4) + '" text-anchor="end" style="fill:var(--limit)">limit ' + l + "</text>";
    });
    const col = kind === "noise" ? "var(--noise)" : "var(--vib)";
    g += '<path d="' + pts.map((p, i) => (i ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1)).join("") + '" style="fill:none;stroke:' + col + ';stroke-width:2.3"/>';
    res.forEach((r, i) => {
      const v = kind === "noise" ? r.noise : r.Lv, ok = kind === "noise" ? r.okN : r.okV;
      g += '<circle cx="' + sx(r.d) + '" cy="' + sy(v) + '" r="5" style="fill:' + (ok === false ? "var(--fail)" : "var(--pass)") + ';stroke:var(--panel);stroke-width:1.5"/><text x="' + (sx(r.d) + 7) + '" y="' + (sy(v) - 6) + '" style="font-size:10.5px">' + esc(r.r.name.split(" ")[0]) + "</text>";
    });
    $(kind === "noise" ? "#noise-legend" : "#vib-legend").innerHTML = '<span><i style="background:' + col + '"></i>' + (kind === "noise" ? "level with no barrier" : "level, building adjustment 0") + '</span><span><i style="background:var(--limit)"></i>receptor limits</span><span>points: receptors (with barrier / building adjustment)</span>';
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.style.height = H + "px"; svg.innerHTML = g;
  }

  /* ---------------- cross-section ---------------- */
  function renderSection() {
    const svg = $("#section"), x = res[model.selected]; if (!x) { svg.innerHTML = ""; return; }
    const r = x.r, s = model.site, W = Math.max(600, svg.clientWidth || 1200), H = 250, gy = 190, L = 70, R = 60;
    const xr = Math.max(1, +r.dist), maxH = Math.max(8, +r.height + 4, +s.barrierHeight + 2, 5);
    const sx = d => L + (d / xr) * (W - L - R), sy = h => gy - (h / maxH) * (gy - 30);
    let g = '<rect x="0" y="' + gy + '" width="' + W + '" height="' + (H - gy) + '" style="fill:var(--ground);opacity:.35"/><line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" style="stroke:var(--ground);stroke-width:2"/>';
    // train
    const tw = Math.max(26, sx(1.5) - sx(-1.5));
    g += '<rect x="' + (sx(0) - tw / 2) + '" y="' + sy(3.8) + '" width="' + tw + '" height="' + (sy(0.4) - sy(3.8)) + '" rx="6" style="fill:var(--panel);stroke:var(--ink);stroke-width:1.5"/>' +
      '<text x="' + sx(0) + '" y="' + (gy + 18) + '" text-anchor="middle">track</text>';
    const S = [sx(0), sy(+s.srcHeight)], Rc = [sx(xr), sy(+r.height)];
    // receptor building
    g += '<rect x="' + (Rc[0] - 4) + '" y="' + sy(+r.height + 3) + '" width="44" height="' + (gy - sy(+r.height + 3)) + '" style="fill:var(--panel-2);stroke:var(--ink-3)"/>' +
      '<circle cx="' + Rc[0] + '" cy="' + Rc[1] + '" r="5" style="fill:var(--noise)"/><text x="' + (Rc[0] + 40) + '" y="' + (sy(+r.height + 3) - 8) + '" text-anchor="end">' + esc(r.name) + " · receiver " + nf(+r.height, 1) + " m</text>";
    if (r.barrier) {
      const B = [sx(+s.barrierDist), sy(+s.barrierHeight)];
      g += '<rect x="' + (B[0] - 3) + '" y="' + B[1] + '" width="6" height="' + (gy - B[1]) + '" style="fill:var(--wall)"/><text x="' + B[0] + '" y="' + (B[1] - 8) + '" text-anchor="middle">barrier ' + nf(+s.barrierHeight, 1) + " m</text>";
      if (x.br.blocked) g += '<path d="M' + S[0] + " " + S[1] + " L" + B[0] + " " + B[1] + " L" + Rc[0] + " " + Rc[1] + '" style="fill:none;stroke:var(--accent);stroke-width:2"/>';
    }
    g += '<line x1="' + S[0] + '" y1="' + S[1] + '" x2="' + Rc[0] + '" y2="' + Rc[1] + '" style="stroke:var(--ink-3);stroke-dasharray:5 4"/><circle cx="' + S[0] + '" cy="' + S[1] + '" r="4" style="fill:var(--fire, var(--accent))"/>';
    g += '<line x1="' + sx(0) + '" y1="' + (gy + 30) + '" x2="' + Rc[0] + '" y2="' + (gy + 30) + '" style="stroke:var(--ink-3)"/><text x="' + ((sx(0) + Rc[0]) / 2) + '" y="' + (gy + 46) + '" text-anchor="middle">' + nf(xr, 0) + " m</text>";
    $("#sec-note").textContent = r.barrier ? (x.br.blocked ? "path difference " + nf(x.br.delta, 2) + " m · insertion loss " + nf(x.br.IL, 1) + " dB" : "barrier does not break the line of sight · no insertion loss") : "no barrier at this receptor";
    svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.style.height = H + "px"; svg.innerHTML = g;
  }

  function renderVerify() {
    tests = window.NV_TESTS.run();
    const pass = tests.filter(t => t.pass).length;
    $("#ver-note").textContent = pass + " of " + tests.length + " checks pass"; $("#ver-note").style.color = pass === tests.length ? "var(--pass)" : "var(--fail)";
    $("#verify").innerHTML = '<p class="muted" style="margin:0 0 10px">Each check compares the engine with an independent calculation: closed form, an explicit energy sum of every pass-by, hour-by-hour Ldn, or an inverse check.</p><table><thead><tr><th>Case</th><th>Check</th><th class="num">Independent</th><th class="num">Engine</th><th>Method</th><th>Result</th></tr></thead><tbody>' +
      tests.map(t => "<tr><td>" + esc(t.group) + "</td><td>" + esc(t.name) + '</td><td class="num">' + Number(t.expected).toPrecision(10) + '</td><td class="num">' + Number(t.got).toPrecision(10) + '</td><td class="muted">' + esc(t.how) + "</td><td>" + (t.pass ? '<span class="pill pass">pass</span>' : '<span class="pill fail">fail</span>') + "</td></tr>").join("") + "</tbody></table>";
  }

  /* ---------------- System link ---------------- */
  const SYS_MAP = [
    { key: "projectName", get: () => model.project.name, set: v => (model.project.name = v) },
    { key: "maxSpeed", get: () => model.traffic.speed, set: v => (model.traffic.speed = +v) },
    { key: "carsPerTrain", get: () => model.traffic.cars, set: v => (model.traffic.cars = Math.round(+v)) },
    { key: "trainLength", get: () => model.traffic.trainLength, set: v => (model.traffic.trainLength = +v) },
    { key: "headway", get: () => model.traffic.headwayDay, set: v => (model.traffic.headwayDay = +v) },
    // operating hours split into the 15 h day and 9 h night periods
    { key: "hoursPerDay", get: () => (+model.traffic.hoursDay || 0) + (+model.traffic.hoursNight || 0), set: v => { model.traffic.hoursDay = Math.min(15, +v); model.traffic.hoursNight = Math.max(0, Math.min(9, +v - 15)); } }
  ];
  function publishToSystem(ok, n) {
    if (!window.RailIQSystem) return;
    const worstN = res.reduce((m, r) => (!m || r.noise > m.noise ? r : m), null), worstV = res.reduce((m, r) => (!m || r.Lv > m.Lv ? r : m), null);
    window.RailIQSystem.publish("noise-vibration", {
      status: !n ? "info" : ok === n ? "pass" : "fail",
      headline: ok + " of " + n + " receptors meet noise and vibration criteria (screening, inputs to review)",
      metrics: [["Receptors passing", ok + " / " + n], ["Highest noise", worstN ? db(worstN.noise) + " dBA at " + worstN.r.name.split(" ")[0] : "—"], ["Highest vibration", worstV ? db(worstV.Lv) + " VdB at " + worstV.r.name.split(" ")[0] : "—"]],
      usedKeys: SYS_MAP.map(m => m.key)
    });
    if (sysBar) sysBar.refresh();
  }

  /* ---------------- export ---------------- */
  function exportResults() {
    if (!window.XLSX) { toast("The Excel library did not load — check the internet connection."); return; }
    const wb = XLSX.utils.book_new();
    const rows = [["Receptor", "Distance (m)", "Barrier", "Barrier IL (dB)", "SEL (dBA)", "Ld (dBA)", "Ln (dBA)", "Ldn (dBA)", "LAeq peak hour (dBA)", "Lmax approx (dBA)", "Noise limit", "Noise result", "Lv (VdB)", "Vibration limit", "Vibration result", "GBN (dBA)", "GBN limit", "GBN result"]];
    const r3 = v => (isFinite(v) ? Math.round(v * 10) / 10 : "");
    const pf = p => (p == null ? "" : p ? "pass" : "over");
    res.forEach(x => rows.push([x.r.name, x.d, x.r.barrier ? "Y" : "N", x.r.barrier ? r3(x.br.IL) : "", r3(x.sel), r3(x.L.Ld), r3(x.L.Ln), r3(x.L.Ldn), r3(x.L.Lpeak), r3(x.L.Lmax), x.r.limNoise, pf(x.okN), r3(x.Lv), x.r.limVib, pf(x.okV), r3(x.Lg), x.r.limGbn, pf(x.okG)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Receptors");
    const inp = [["Group", "Field", "Value"]]; ["project", "traffic", "source", "site", "vib"].forEach(g => Object.entries(model[g]).forEach(([k, v]) => inp.push([g, k, v])));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inp), "Inputs");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Case", "Check", "Independent", "Engine", "Method", "Result"]].concat(tests.map(t => [t.group, t.name, t.expected, t.got, t.how, t.pass ? "pass" : "FAIL"]))), "Verification");
    XLSX.writeFile(wb, (model.project.docRef || "NV").replace(/[^\w.-]+/g, "_") + "_noise_vibration.xlsx"); toast("Results workbook saved");
  }
  function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  function wireActions() {
    $("#b-export").onclick = exportResults;
    $("#b-json").onclick = () => download((model.project.docRef || "NV").replace(/[^\w.-]+/g, "_") + "_nv_inputs.json", JSON.stringify(model, null, 2));
    $("#b-jsonin").onclick = () => $("#f-json").click();
    $("#f-json").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const r = new FileReader(); r.onload = () => { try { const m = JSON.parse(r.result); if (!m.traffic) throw new Error("not a Rail-IQ noise & vibration inputs file"); model = normalise(m); fillInputs(); renderReceptors(); recompute(); toast("Opened " + f.name); } catch (err) { toast("Could not open " + f.name + ": " + err.message); } }; r.readAsText(f); };
    $("#b-print").onclick = () => window.print();
    $("#b-sample").onclick = () => { if (confirm("Replace all inputs with the sample?")) { model = normalise(window.NV_SAMPLE()); fillInputs(); renderReceptors(); recompute(); } };
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => { document.querySelectorAll(".tab").forEach(x => x.setAttribute("aria-selected", x === t)); document.querySelectorAll('[role="tabpanel"]').forEach(p => (p.hidden = p.id !== t.dataset.tab)); }));
    $("#selrec").addEventListener("change", e => { model.selected = +e.target.value; renderResults(); save(); });
    $("#recres").addEventListener("click", e => { const r = e.target.closest("[data-pick]"); if (!r) return; model.selected = +r.dataset.pick; renderResults(); save(); });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderResults, 150); });
  }

  model = load();
  wireInputs(); wireReceptors(); wireActions();
  fillInputs(); renderReceptors(); renderVerify();
  if (window.RailIQSystem) sysBar = window.RailIQSystem.mountBar({ module: "noise-vibration", mount: "#syslink", map: SYS_MAP, onApplied: () => { fillInputs(); recompute(); } });
  recompute();
})();

/* Rail-IQ RAMS Workbench – fault tree and RBD editor, results, Excel exchange */
(function () {
  "use strict";
  const RW = window.RailIQRW, SAMPLES = window.RailIQRWSamples;
  const KEY = "railiq.rw.v1";
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };
  const fE = (x, d) => (x == null || !isFinite(x) ? (x === Infinity ? "∞" : "—") : x === 0 ? "0" : x.toExponential(d == null ? 2 : d).replace("e", "E").replace(/E\+?(-?)(\d)$/, "E$10$2"));
  const fN = (x, d) => (x == null || !isFinite(x) ? (x === Infinity ? "∞" : "—") : x.toLocaleString("en-GB", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }));
  const fP = (x, d) => (x == null || !isFinite(x) ? "—" : (x * 100).toFixed(d == null ? 4 : d) + " %");
  const pill = (ok, y, n) => (ok == null ? '<span class="pill na">no target</span>' : ok ? '<span class="pill pass">' + (y || "pass") + "</span>" : '<span class="pill fail">' + (n || "fail") + "</span>");
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

  /* ---------------- state ---------------- */
  let S = load() || fresh();
  // A project holds several models of each kind (like an Isograph project file)
  const KINDS = { ft: { list: "fts", label: "Fault tree" }, rbd: { list: "rbds", label: "Block diagram" }, eta: { list: "etas", label: "Event tree" }, mk: { list: "mks", label: "Markov model" }, wb: { list: "wbs", label: "Weibull data set" } };
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  function withUid(m, p) { if (!m.uid) m.uid = uid(p); return m; }
  function fresh() {
    return {
      mode: "sum", project: { name: "P2427 Etihad HSR – Dubai section (MEP-P2427)", doc: "RW-SIM-001 (simulation – not a submission)" },
      fts: SAMPLES.fts.map(x => clone(x)), rbds: SAMPLES.rbds.map(x => clone(x)), etas: (SAMPLES.etas || []).map(x => clone(x)), mks: (SAMPLES.mks || []).map(x => clone(x)), wbs: (SAMPLES.wbs || []).map(x => clone(x)),
      cur: { ft: 0, rbd: 0, eta: 0, mk: 0, wb: 0 }, opt: { maxOrder: 6, cutoff: 1e-15 }
    };
  }
  function migrate(v) {
    if (!v) return null;
    if (v.ft && !v.fts) { v.fts = [v.ft]; v.rbds = [v.rbd]; delete v.ft; delete v.rbd; }
    if (!v.fts || !v.rbds) return null;
    ["etas", "mks", "wbs"].forEach(k => { if (!v[k]) v[k] = (SAMPLES[k] || []).map(x => clone(x)); });
    v.cur = Object.assign({ ft: 0, rbd: 0, eta: 0, mk: 0, wb: 0 }, v.cur || {});
    return v;
  }
  function load() { try { return migrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return null; } }
  function ensure() {
    S.fts.forEach(m => withUid(m, "ft_")); S.rbds.forEach(m => withUid(m, "rbd_")); S.etas.forEach(m => withUid(m, "eta_")); S.mks.forEach(m => withUid(m, "mk_")); S.wbs.forEach(m => withUid(m, "wb_"));
    if (!S.fts.length) S.fts.push(withUid(clone(SAMPLES.blankFT), "ft_"));
    if (!S.rbds.length) S.rbds.push(withUid(clone(SAMPLES.blankRBD), "rbd_"));
    Object.keys(KINDS).forEach(k => { const L = S[KINDS[k].list]; S.cur[k] = Math.min(Math.max(0, S.cur[k] | 0), Math.max(0, L.length - 1)); });
  }
  let saveT;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }, 300); }

  let ftRes = null, rbdRes = null, sel = { ft: null, rbd: null };
  const collapsed = new Set();
  const curModel = k => S[KINDS[k].list][S.cur[k]];

  /* ---------------- mode switch ---------------- */
  function setMode(m) {
    S.mode = m; save();
    $$(".mode").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === m));
    ["ft", "rbd", "eta", "mk", "wb", "sum", "cmp"].forEach(k => { const w = $("#ws-" + k); if (w) w.hidden = m !== k; });
    $$(".ftrbd-only").forEach(x => (x.hidden = !["ft", "rbd"].includes(m)));
    fillHeader(); recompute(); fitView();
  }

  function fillHeader() {
    $("#p-name").value = S.project.name; $("#p-doc").value = S.project.doc;
    const k = KINDS[S.mode];
    $("#modelbar").hidden = !k;
    $("#p-model").value = k ? curModel(S.mode).name || "" : "Project summary";
    $("#p-model").readOnly = !k;
    if (k) {
      const L = S[k.list];
      $("#model-kind").textContent = k.label + "s in this project";
      $("#model-sel").innerHTML = L.map((x, i) => '<option value="' + i + '"' + (i === S.cur[S.mode] ? " selected" : "") + ">" + esc(x.name || "(unnamed)") + "</option>").join("");
      $("#model-del").disabled = L.length <= 1;
    }
    const sel = $("#sample"); sel.innerHTML = '<option value="">Add a sample model…</option>' +
      SAMPLES.fts.map((x, i) => '<option value="ft:' + i + '">Fault tree – ' + esc(x.name) + "</option>").join("") +
      (SAMPLES.etas || []).map((x, i) => '<option value="eta:' + i + '">Event tree – ' + esc(x.name) + "</option>").join("") +
      SAMPLES.rbds.map((x, i) => '<option value="rbd:' + i + '">RBD – ' + esc(x.name) + "</option>").join("") +
      (SAMPLES.mks || []).map((x, i) => '<option value="mk:' + i + '">Markov – ' + esc(x.name) + "</option>").join("") +
      (SAMPLES.wbs || []).map((x, i) => '<option value="wb:' + i + '">Weibull – ' + esc(x.name) + "</option>").join("");
  }
  function addModel(kind, m) {
    const L = S[KINDS[kind].list]; withUid(m, kind + "_");
    L.push(m); S.cur[kind] = L.length - 1;
    if (kind === "ft") sel.ft = null; if (kind === "rbd") { sel.rbd = null; collapsed.clear(); initCollapse(); }
    setMode(kind);
  }
  function blankOf(kind) {
    if (kind === "ft") return clone(SAMPLES.blankFT);
    if (kind === "rbd") return clone(SAMPLES.blankRBD);
    if (kind === "eta") return { name: "New event tree", desc: "", init: { desc: "Initiating event", f: 1e-5 }, headings: [{ id: "H1", desc: "First barrier works", src: "fixed", p: 0.01 }], cats: [{ id: "C1", name: "Critical", tol: 1e-8 }], outcomes: {} };
    if (kind === "mk") return { name: "New Markov model", desc: "", horizon: 0, states: [{ id: "UP", name: "Working", up: true, init: true }, { id: "DN", name: "Failed", up: false }], trans: [{ from: "UP", to: "DN", rate: 1e-4 }, { from: "DN", to: "UP", rate: 0.25 }] };
    return { name: "New Weibull data set", desc: "", data: [] };
  }

  /* ================= FAULT TREE ================= */
  const ft = () => curModel("ft");
  const gateById = id => ft().gates.find(g => g.id === id);
  const eventById = id => ft().events.find(e => e.id === id);
  function parentsOf(id) { return ft().gates.filter(g => g.inputs.includes(id)); }
  function uniqueId(prefix) { let i = 1; const used = new Set(ft().gates.map(g => g.id).concat(ft().events.map(e => e.id))); while (used.has(prefix + i)) i++; return prefix + i; }

  // ---- layout of the tree for drawing ----
  const NW = 156, NH = 58, SYM = 40, VG = 46, HG = 16;
  function layoutFT() {
    const m = ft(), seen = new Set(), nodes = [], links = [];
    let slot = 0;
    function place(id, depth, parent) {
      const g = gateById(id), e = eventById(id);
      const n = { id, depth, kind: g ? "gate" : e ? "event" : "missing", g, e, parent, kids: [], transfer: false };
      if (g && seen.has(id)) n.transfer = true;
      if (g && !n.transfer) { seen.add(id); g.inputs.forEach(c => n.kids.push(place(c, depth + 1, n))); }
      if (!n.kids.length) { n.x = slot * (NW + HG); slot++; } else n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2;
      n.y = depth * (NH + SYM + VG);
      nodes.push(n); n.kids.forEach(k => links.push([n, k]));
      return n;
    }
    const rootN = place(m.top, 0, null);
    return { nodes, links, root: rootN, width: Math.max(1, slot) * (NW + HG), height: (Math.max(0, ...nodes.map(n => n.depth)) + 1) * (NH + SYM + VG) };
  }
  function wrap(text, max, lines) {
    const words = String(text || "").split(/\s+/), out = []; let cur = "";
    words.forEach(w => { if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) out.push(cur);
    if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…"); }
    return out;
  }
  function gateSym(type, cx, y, k, n) {
    // y = top of symbol; symbol height 30
    const w = 30, h = 30, x = cx - w / 2;
    if (type === "and") return '<path class="sym" d="M' + x + " " + (y + h) + " V" + (y + 12) + " A" + w / 2 + " " + 13 + " 0 0 1 " + (x + w) + " " + (y + 12) + " V" + (y + h) + ' Z"/>';
    const p = '<path class="sym" d="M' + x + " " + (y + h) + " Q" + cx + " " + (y + h - 8) + " " + (x + w) + " " + (y + h) + " Q" + (x + w) + " " + (y + 8) + " " + cx + " " + y + " Q" + x + " " + (y + 8) + " " + x + " " + (y + h) + ' Z"/>';
    return type === "vote" ? p + '<text class="symt" x="' + cx + '" y="' + (y + h - 7) + '" text-anchor="middle">' + k + "/" + n + "</text>" : p;
  }
  function eventSym(e, cx, y) {
    const r = 14, cy = y + 16;
    if (!e) return '<path class="sym missing" d="M' + (cx - 14) + " " + (y + 30) + " L" + cx + " " + y + " L" + (cx + 14) + " " + (y + 30) + ' Z"/>';
    if (e.model === "fixed") return '<path class="sym" d="M' + cx + " " + (cy - 15) + " L" + (cx + 15) + " " + cy + " L" + cx + " " + (cy + 15) + " L" + (cx - 15) + " " + cy + ' Z"/>';
    if (e.model === "freq") return '<path class="sym" d="M' + (cx - 14) + " " + (cy + 14) + " V" + (cy - 4) + " L" + cx + " " + (cy - 15) + " L" + (cx + 14) + " " + (cy - 4) + " V" + (cy + 14) + ' Z"/>';
    return '<circle class="sym' + (e.model === "dormant" ? " dorm" : "") + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' + (e.model === "dormant" ? '<text class="symt" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle">T</text>' : "");
  }

  function drawFT() {
    const svg = $("#ft-svg"); if (!svg) return;
    const L = layoutFT(), res = ftRes && ftRes.ok ? ftRes : null;
    let h = "";
    L.links.forEach(([a, b]) => {
      const x1 = a.x + NW / 2, y1 = a.y + NH + 32, x2 = b.x + NW / 2, y2 = b.y, ym = y1 + (y2 - y1) / 2;
      h += '<path class="lnk" d="M' + x1 + " " + y1 + " V" + ym + " H" + x2 + " V" + y2 + '"/>';
    });
    L.nodes.forEach(n => {
      const cx = n.x + NW / 2, isSel = sel.ft === n.id;
      const desc = n.g ? n.g.desc : n.e ? n.e.desc : "Missing: not defined";
      let cls = "nd " + n.kind + (isSel ? " sel" : "") + (n.transfer ? " xfer" : "");
      if (n.depth === 0 && res && res.top.pass != null) cls += res.top.pass ? " okb" : " badb";
      h += '<g class="' + cls + '" data-id="' + esc(n.id) + '">';
      h += '<rect class="box" x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="' + NH + '" rx="3"/>';
      h += '<rect class="idbar" x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="15" rx="3"/>';
      h += '<text class="idt" x="' + (n.x + 6) + '" y="' + (n.y + 11) + '">' + esc(n.id) + (n.e && n.e.ccf ? "  β " + esc(n.e.ccf) : "") + "</text>";
      wrap(desc, 27, 3).forEach((ln, i) => { h += '<text class="dt" x="' + (n.x + 6) + '" y="' + (n.y + 28 + i * 11.5) + '">' + esc(ln) + "</text>"; });
      h += '<line class="stem" x1="' + cx + '" y1="' + (n.y + NH) + '" x2="' + cx + '" y2="' + (n.y + NH + 4) + '"/>';
      if (n.transfer) h += '<path class="sym xf" d="M' + (cx - 14) + " " + (n.y + NH + 32) + " L" + cx + " " + (n.y + NH + 4) + " L" + (cx + 14) + " " + (n.y + NH + 32) + ' Z"/>';
      else if (n.g) h += gateSym(n.g.type, cx, n.y + NH + 4, n.g.k, n.g.inputs.length);
      else h += eventSym(n.e, cx, n.y + NH + 2);
      if (res) {
        const v = n.g ? res.gates[n.id] : res.events[n.id];
        if (v) h += '<text class="val" x="' + (cx + 20) + '" y="' + (n.y + NH + 16) + '">Q ' + fE(v.Q != null ? v.Q : v.q) + '</text><text class="val" x="' + (cx + 20) + '" y="' + (n.y + NH + 28) + '">W ' + fE(v.W != null ? v.W : v.w) + "</text>";
      }
      h += "</g>";
    });
    $("#ft-view").innerHTML = h;
    viewBounds.ft = { w: L.width, h: L.height };
    applyView();
  }

  // ---- side panel ----
  function ftPanel() {
    const box = $("#ft-props"), id = sel.ft, m = ft();
    const g = id && gateById(id), e = id && eventById(id);
    if (!g && !e) {
      box.innerHTML = '<h3>Fault tree</h3><p class="muted">Click a gate or event in the diagram to edit it.</p>' +
        '<div class="fld"><label>Tree name</label><input data-ftm="name" value="' + esc(m.name) + '"></div>' +
        '<div class="fld"><label>Top event</label><select data-ftm="top">' + m.gates.map(x => "<option" + (x.id === m.top ? " selected" : "") + ">" + esc(x.id) + "</option>").join("") + "</select></div>" +
        '<div class="fld"><label>Mission / lifetime (non-repairable events)</label><div class="unit"><input type="number" data-ftm="missionTime" value="' + esc(m.missionTime) + '"><span>h</span></div></div>' +
        '<div class="fld"><label>Target THR / TFFR</label><div class="unit"><input type="number" step="any" data-ftm="thr" value="' + esc(m.thr) + '"><span>/h</span></div><small>' + esc(m.thrNote || "Tolerable hazard rate of the safety function") + "</small></div>" +
        '<div class="fld"><label>Description</label><textarea data-ftm="desc" rows="4">' + esc(m.desc) + "</textarea></div>";
      return;
    }
    if (g) {
      const r = ftRes && ftRes.ok && ftRes.gates[g.id];
      const others = m.gates.map(x => x.id).concat(m.events.map(x => x.id)).filter(x => x !== g.id && !g.inputs.includes(x));
      box.innerHTML = '<h3>Gate <span class="mono">' + esc(g.id) + "</span></h3>" +
        (r ? '<div class="mini"><span>Q <b>' + fE(r.Q) + "</b></span><span>W <b>" + fE(r.W) + "</b> /h</span></div>" : "") +
        '<div class="fld"><label>ID</label><input data-g="id" value="' + esc(g.id) + '"></div>' +
        '<div class="fld"><label>Description</label><textarea data-g="desc" rows="3">' + esc(g.desc) + "</textarea></div>" +
        '<div class="row2"><div class="fld"><label>Type</label><select data-g="type"><option value="or"' + (g.type === "or" ? " selected" : "") + '>OR</option><option value="and"' + (g.type === "and" ? " selected" : "") + '>AND</option><option value="vote"' + (g.type === "vote" ? " selected" : "") + ">VOTE (k of n)</option></select></div>" +
        (g.type === "vote" ? '<div class="fld"><label>k (inputs failed)</label><input type="number" min="1" data-g="k" value="' + esc(g.k || 2) + '"></div>' : "<div></div>") + "</div>" +
        '<h4>Inputs</h4><ul class="inl">' + g.inputs.map((c, i) => '<li><span class="mono">' + esc(c) + '</span><span class="sp"></span><button class="btn xs" data-mv="' + i + ':-1" title="Move left">←</button><button class="btn xs" data-mv="' + i + ':1" title="Move right">→</button><button class="btn xs" data-rm="' + esc(c) + '" title="Remove from this gate">✕</button></li>').join("") + "</ul>" +
        '<div class="btnrow"><button class="btn sm" data-add="gate">+ Gate</button><button class="btn sm" data-add="event">+ Event</button></div>' +
        '<div class="fld"><label>Add an existing gate or event (repeated event)</label><select data-addex><option value="">choose…</option>' + others.map(x => "<option>" + esc(x) + "</option>").join("") + "</select></div>" +
        (g.id !== m.top ? '<div class="btnrow"><button class="btn sm danger" data-del="branch">Delete gate and its unshared branch</button></div>' : '<p class="muted">This is the top event.</p>');
    } else {
      const r = ftRes && ftRes.ok && ftRes.events[e.id];
      const f = RW.MODELS[e.model] ? RW.MODELS[e.model].fields : [];
      const lab = { lambda: ["Failure rate λ", "/h"], mdt: ["Mean down time τ (MALDT + MTTR)", "h"], ti: ["Proof-test interval T", "h"], q: ["Probability on demand", ""], f: ["Frequency", "/h"] };
      const groups = (m.ccf || []).map(c => c.id);
      box.innerHTML = '<h3>Event <span class="mono">' + esc(e.id) + "</span></h3>" +
        (r ? '<div class="mini"><span>q <b>' + fE(r.q) + "</b></span><span>w <b>" + fE(r.w) + '</b> /h</span><span>FV <b>' + fN(r.fvW * 100, 1) + " %</b></span></div>" : "") +
        '<div class="fld"><label>ID</label><input data-e="id" value="' + esc(e.id) + '"></div>' +
        '<div class="fld"><label>Description</label><textarea data-e="desc" rows="3">' + esc(e.desc) + "</textarea></div>" +
        '<div class="fld"><label>Model</label><select data-e="model">' + Object.keys(RW.MODELS).map(k => '<option value="' + k + '"' + (e.model === k ? " selected" : "") + ">" + esc(RW.MODELS[k].label) + "</option>").join("") + "</select></div>" +
        f.map(k => '<div class="fld"><label>' + lab[k][0] + '</label><div class="unit"><input type="number" step="any" min="0" data-e="' + k + '" value="' + esc(e[k] == null ? "" : e[k]) + '"><span>' + lab[k][1] + "</span></div>" + (k === "lambda" && num(e.lambda, 0) > 0 ? "<small>MTBF " + fN(1 / num(e.lambda, 1)) + " h</small>" : "") + "</div>").join("") +
        '<div class="fld"><label>Common cause group (β-factor)</label><select data-e="ccf"><option value="">none</option>' + groups.map(x => "<option" + (x === e.ccf ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></div>" +
        '<div class="fld"><label>Reference (FMECA / CM / data source)</label><input data-e="ref" value="' + esc(e.ref || "") + '"></div>' +
        '<p class="muted">Used in: ' + (parentsOf(e.id).map(p => '<span class="mono">' + esc(p.id) + "</span>").join(", ") || "not used") + "</p>" +
        '<div class="btnrow">' + (sel.ftParent ? '<button class="btn sm" data-rm="' + esc(e.id) + '" data-from="' + esc(sel.ftParent) + '">Remove from ' + esc(sel.ftParent) + "</button>" : "") + '<button class="btn sm danger" data-del="event">Delete event</button></div>';
    }
  }
  function renameRef(oldId, newId) {
    ft().gates.forEach(g => { g.inputs = g.inputs.map(i => (i === oldId ? newId : i)); });
    if (ft().top === oldId) ft().top = newId;
  }
  function ftPanelInput(t) {
    const m = ft();
    if (t.dataset.ftm) { const k = t.dataset.ftm; m[k] = t.type === "number" ? num(t.value, 0) : t.value; changed(false); return; }
    const g = sel.ft && gateById(sel.ft), e = sel.ft && eventById(sel.ft);
    if (g && t.dataset.g) {
      const k = t.dataset.g;
      if (k === "id") { const v = t.value.trim(); if (!v || (v !== g.id && (gateById(v) || eventById(v)))) { t.classList.add("bad"); return; } t.classList.remove("bad"); renameRef(g.id, v); g.id = v; sel.ft = v; }
      else if (k === "k") g.k = Math.max(1, Math.round(num(t.value, 2)));
      else if (k === "type") { g.type = t.value; if (g.type === "vote" && !g.k) g.k = 2; changed(true); ftPanel(); return; }
      else g[k] = t.value;
      changed(k !== "desc" || true); return;
    }
    if (e && t.dataset.e) {
      const k = t.dataset.e;
      if (k === "id") { const v = t.value.trim(); if (!v || (v !== e.id && (gateById(v) || eventById(v)))) { t.classList.add("bad"); return; } t.classList.remove("bad"); renameRef(e.id, v); e.id = v; sel.ft = v; }
      else if (["lambda", "mdt", "ti", "q", "f"].includes(k)) e[k] = num(t.value, 0);
      else if (k === "model") { e.model = t.value; changed(true); ftPanel(); return; }
      else e[k] = t.value;
      changed(true);
    }
  }
  function ftPanelClick(b) {
    const m = ft(), g = sel.ft && gateById(sel.ft);
    if (b.dataset.add && g) {
      if (b.dataset.add === "gate") { const id = uniqueId("G_"); m.gates.push({ id, type: "or", desc: "New gate", inputs: [] }); g.inputs.push(id); sel.ft = id; }
      else { const id = uniqueId("E"); m.events.push({ id, desc: "New basic event", model: "repair", lambda: 1e-5, mdt: 4 }); g.inputs.push(id); sel.ftParent = g.id; sel.ft = id; }
      changed(true); return;
    }
    if (b.dataset.mv && g) { const [i, d] = b.dataset.mv.split(":").map(Number), j = i + d; if (j >= 0 && j < g.inputs.length) { const t = g.inputs[i]; g.inputs[i] = g.inputs[j]; g.inputs[j] = t; changed(true); } return; }
    if (b.dataset.rm) { const from = b.dataset.from ? gateById(b.dataset.from) : g; if (from) { from.inputs = from.inputs.filter(x => x !== b.dataset.rm); changed(true); } return; }
    if (b.dataset.del === "event") { const id = sel.ft; m.gates.forEach(x => (x.inputs = x.inputs.filter(i => i !== id))); m.events = m.events.filter(x => x.id !== id); sel.ft = null; changed(true); return; }
    if (b.dataset.del === "branch" && g) {
      const ids = new Set();
      (function collect(id) { const x = gateById(id); if (!x) { ids.add(id); return; } ids.add(id); x.inputs.forEach(collect); })(g.id);
      // keep anything still referenced from outside the branch
      let changedSet = true;
      while (changedSet) { changedSet = false; m.gates.forEach(x => { if (!ids.has(x.id)) x.inputs.forEach(i => { if (ids.has(i) && i !== g.id) { ids.delete(i); changedSet = true; } }); }); }
      m.gates.forEach(x => (x.inputs = x.inputs.filter(i => i !== g.id)));
      m.gates = m.gates.filter(x => !ids.has(x.id)); m.events = m.events.filter(x => !ids.has(x.id));
      sel.ft = null; changed(true);
    }
  }

  // ---- tables ----
  function ftTables() {
    const m = ft(), res = ftRes && ftRes.ok ? ftRes : null;
    $("#cnt-ev").textContent = m.events.length; $("#cnt-g").textContent = m.gates.length; $("#cnt-ccf").textContent = (m.ccf || []).length;
    const groups = (m.ccf || []).map(c => c.id);
    $("#tbl-ev").innerHTML = "<thead><tr><th>ID</th><th>Description</th><th>Model</th><th class=num>λ (/h)</th><th class=num>τ MDT (h)</th><th class=num>T test (h)</th><th class=num>q</th><th class=num>f (/h)</th><th>CCF</th><th class=num title='Error factor: 95th / 50th percentile of the rate'>EF</th><th>Ref.</th><th class=num>q calc</th><th class=num>w calc (/h)</th><th></th></tr></thead><tbody>" +
      m.events.map((e, i) => {
        const f = (RW.MODELS[e.model] || { fields: [] }).fields, r = res && res.events[e.id];
        const inp = k => f.includes(k) ? '<input type="number" step="any" min="0" data-et="' + i + ":" + k + '" value="' + esc(e[k] == null ? "" : e[k]) + '">' : '<span class="muted">–</span>';
        return '<tr class="' + (sel.ft === e.id ? "rowsel" : "") + '"><td><input type="text" class="mono" data-et="' + i + ':id" value="' + esc(e.id) + '"></td><td><input type="text" data-et="' + i + ':desc" value="' + esc(e.desc) + '"></td>' +
          '<td><select data-et="' + i + ':model">' + Object.keys(RW.MODELS).map(k => '<option value="' + k + '"' + (e.model === k ? " selected" : "") + ">" + RW.MODELS[k].short + "</option>").join("") + "</select></td>" +
          "<td>" + inp("lambda") + "</td><td>" + inp("mdt") + "</td><td>" + inp("ti") + "</td><td>" + inp("q") + "</td><td>" + inp("f") + "</td>" +
          '<td><select data-et="' + i + ':ccf"><option value=""></option>' + groups.map(x => "<option" + (x === e.ccf ? " selected" : "") + ">" + esc(x) + "</option>").join("") + "</select></td>" +
          '<td><input type="number" step="0.5" min="1" data-et="' + i + ':ef" value="' + esc(e.ef == null ? "" : e.ef) + '" placeholder="1"></td><td><input type="text" data-et="' + i + ':ref" value="' + esc(e.ref || "") + '"></td>' +
          '<td class="num">' + (r ? fE(r.q) : "—") + '</td><td class="num">' + (r ? fE(r.w) : "—") + '</td><td><button class="btn icon" data-etdel="' + i + '" title="Delete event">✕</button></td></tr>';
      }).join("") + "</tbody>";
    $("#tbl-g").innerHTML = "<thead><tr><th>ID</th><th>Type</th><th class=num>k</th><th>Description</th><th>Inputs (comma separated)</th><th class=num>Q</th><th class=num>W (/h)</th></tr></thead><tbody>" +
      m.gates.map((g, i) => { const r = res && res.gates[g.id]; return '<tr class="' + (sel.ft === g.id ? "rowsel" : "") + '"><td><input type="text" class="mono" data-gt="' + i + ':id" value="' + esc(g.id) + '"></td><td><select data-gt="' + i + ':type"><option value="or"' + (g.type === "or" ? " selected" : "") + ">OR</option><option value=\"and\"" + (g.type === "and" ? " selected" : "") + ">AND</option><option value=\"vote\"" + (g.type === "vote" ? " selected" : "") + ">VOTE</option></select></td><td>" + (g.type === "vote" ? '<input type="number" min="1" data-gt="' + i + ':k" value="' + esc(g.k) + '">' : "") + '</td><td><input type="text" data-gt="' + i + ':desc" value="' + esc(g.desc) + '"></td><td><input type="text" class="mono" data-gt="' + i + ':inputs" value="' + esc(g.inputs.join(", ")) + '"></td><td class="num">' + (r ? fE(r.Q) : "—") + '</td><td class="num">' + (r ? fE(r.W) : "—") + "</td></tr>"; }).join("") + "</tbody>";
    $("#tbl-ccf").innerHTML = "<thead><tr><th>Group</th><th class=num>β</th><th>Basis / description</th><th>Members</th><th class=num>Common λ or q</th><th></th></tr></thead><tbody>" +
      (m.ccf || []).map((c, i) => { const mem = m.events.filter(e => e.ccf === c.id).map(e => e.id), r = res && res.ccf.find(x => x.id === c.id); return '<tr><td><input type="text" class="mono" data-ct="' + i + ':id" value="' + esc(c.id) + '"></td><td><input type="number" step="0.01" min="0" max="1" data-ct="' + i + ':beta" value="' + esc(c.beta) + '"></td><td><input type="text" data-ct="' + i + ':desc" value="' + esc(c.desc || "") + '"></td><td class="mono">' + esc(mem.join(", ") || "–") + '</td><td class="num">' + (r ? fE(r.lambda || r.q) : "—") + '</td><td><button class="btn icon" data-ctdel="' + i + '">✕</button></td></tr>'; }).join("") + "</tbody>";
  }
  function ftTableInput(t) {
    const m = ft();
    if (t.dataset.et) { const [i, k] = t.dataset.et.split(":"), e = m.events[+i]; if (!e) return;
      if (k === "id") { const v = t.value.trim(); if (!v || (v !== e.id && (gateById(v) || eventById(v)))) { t.classList.add("bad"); return; } t.classList.remove("bad"); renameRef(e.id, v); if (sel.ft === e.id) sel.ft = v; e.id = v; }
      else if (["lambda", "mdt", "ti", "q", "f", "ef"].includes(k)) e[k] = num(t.value, 0); else e[k] = t.value;
      changed(k === "model", true); return; }
    if (t.dataset.gt) { const [i, k] = t.dataset.gt.split(":"), g = m.gates[+i]; if (!g) return;
      if (k === "id") { const v = t.value.trim(); if (!v || (v !== g.id && (gateById(v) || eventById(v)))) { t.classList.add("bad"); return; } t.classList.remove("bad"); renameRef(g.id, v); if (sel.ft === g.id) sel.ft = v; g.id = v; }
      else if (k === "inputs") g.inputs = t.value.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      else if (k === "k") g.k = Math.max(1, Math.round(num(t.value, 2)));
      else g[k] = t.value;
      changed(k === "type", true); return; }
    if (t.dataset.ct) { const [i, k] = t.dataset.ct.split(":"), c = m.ccf[+i]; if (!c) return;
      if (k === "id") { const old = c.id, v = t.value.trim(); m.events.forEach(e => { if (e.ccf === old) e.ccf = v; }); c.id = v; }
      else if (k === "beta") c.beta = Math.min(1, Math.max(0, num(t.value, 0))); else c[k] = t.value;
      changed(false, true); }
  }

  // ---- results ----
  function ftResults() {
    const r = ftRes, m = ft();
    const iss = $("#ft-issues");
    const msgs = (r.errors || []).map(x => "<li>" + esc(x) + "</li>").join("") + (r.warnings || []).map(x => '<li class="w">' + esc(x) + "</li>").join("");
    iss.hidden = !msgs; iss.innerHTML = msgs ? "<b>" + (r.errors.length ? "Check the model" : "Notes") + "</b><ul>" + msgs + "</ul>" : "";
    iss.classList.toggle("warnonly", !r.errors.length);
    if (!r.ok) { $("#tb-result").textContent = "Model error"; $("#tb-result").className = "res bad"; ["#ft-kpis", "#ft-cs", "#ft-imp", "#ft-pareto", "#ft-curve", "#ft-ccfres"].forEach(s => ($(s).innerHTML = "")); return; }
    const t = r.top;
    $("#tb-result").textContent = t.pass == null ? fE(t.W) + " /h" : t.pass ? "Meets THR" : "THR not met";
    $("#tb-result").className = "res " + (t.pass === false ? "bad" : t.pass ? "good" : "");
    $("#ft-kpis").innerHTML =
      kpi("Top event frequency W", fE(t.W), "per hour · " + esc(t.sil), t.pass) +
      kpi("Target THR", t.thr ? fE(t.thr) : "—", t.thr ? (t.pass ? "met with margin ×" + fN(t.margin, 1) : "exceeded ×" + fN(1 / t.margin, 1)) + " " + pill(t.pass, "pass", "fail") : "set in the tree settings", null) +
      kpi("Top event unavailability Q", fE(t.Q), "exact (BDD) · rare-event " + fE(t.Qrare) + " · MCUB " + fE(t.Qmcub), null) +
      kpi("Mean time between top events", fN(t.mut) + " h", "≈ " + fN(t.mut / 8760, 1) + " years · mean down time " + fN(t.mdt, 2) + " h", null) +
      kpi("Expected top events in " + fN(r.T) + " h", fN(t.expectedInMission, 4), "W × mission time", null) +
      kpi("Minimal cut sets", fN(r.cutsets.length), Object.keys(r.orderCounts).map(o => "order " + o + ": " + r.orderCounts[o]).join(" · "), null);
    $("#ft-sumnote").textContent = r.nvars + " basic events (incl. CCF) · BDD " + r.bddNodes + " nodes · " + (r.ccf.length ? r.ccf.length + " CCF groups" : "no CCF");
    // cut sets
    const shown = r.cutsets.slice(0, 200);
    $("#ft-cs").innerHTML = '<table><thead><tr><th class=num>#</th><th class=num>Order</th><th>Cut set (events that together cause the top event)</th><th class=num>W (/h)</th><th class=num>Share of W</th><th class=num>Q</th></tr></thead><tbody>' +
      shown.map((c, i) => "<tr><td class=num>" + (i + 1) + "</td><td class=num>" + c.order + "</td><td>" + c.ids.map(id => '<span class="cse' + (id.startsWith("CCF_") ? " ccf" : "") + '" title="' + esc((eventById(id) || {}).desc || (id.startsWith("CCF_") ? "Common cause event" : "")) + '">' + esc(id) + "</span>").join(" · ") + '</td><td class=num>' + fE(c.W) + '</td><td class=num><div class="inbar"><i style="width:' + Math.max(1, c.shareW * 90) + 'px"></i><span>' + fN(c.shareW * 100, 1) + " %</span></div></td><td class=num>" + fE(c.Q) + "</td></tr>").join("") +
      "</tbody></table>" + (r.cutsets.length > 200 ? '<p class="muted">Showing 200 of ' + r.cutsets.length + ". All are in the Excel export.</p>" : "");
    // importance
    const ids = Object.keys(r.events);
    const sortKey = $("#imp-sort") ? $("#imp-sort").value : "fvW";
    ids.sort((a, b) => (r.events[b][sortKey] || 0) - (r.events[a][sortKey] || 0));
    $("#ft-imp").innerHTML = '<table><thead><tr><th>Event</th><th>Description</th><th class=num>q</th><th class=num>w (/h)</th><th class=num>FV on W</th><th class=num>FV on Q</th><th class=num>Birnbaum</th><th class=num>Criticality</th><th class=num>RAW</th><th class=num>RRW</th></tr></thead><tbody>' +
      ids.map(id => { const e = r.events[id], d = eventById(id); return '<tr><td class="mono">' + esc(id) + "</td><td>" + esc(d ? d.desc : "Common cause event") + "</td><td class=num>" + fE(e.q) + "</td><td class=num>" + fE(e.w) + '</td><td class=num><div class="inbar"><i style="width:' + Math.max(1, e.fvW * 90) + 'px"></i><span>' + fN(e.fvW * 100, 1) + " %</span></div></td><td class=num>" + fN(e.fvQ * 100, 1) + " %</td><td class=num>" + fE(e.IB) + "</td><td class=num>" + fE(e.crit) + "</td><td class=num>" + (isFinite(e.raw) ? fN(e.raw, 1) : "∞") + "</td><td class=num>" + (isFinite(e.rrw) ? fN(e.rrw, 3) : "∞") + "</td></tr>"; }).join("") + "</tbody></table>";
    // pareto of cut sets
    barChart($("#ft-pareto"), r.cutsets.slice(0, 12).map(c => ({ label: c.ids.join(" · "), v: c.shareW, txt: fN(c.shareW * 100, 1) + " %  (" + fE(c.W) + "/h)" })), "Share of the top-event frequency");
    // Q(t)
    lineChart($("#ft-curve"), r.curve.map(p => [p.t, p.Q]), { xl: "time (h)", yl: "Q(t)", fmtY: v => fE(v, 1) });
    // CCF
    $("#ft-ccfres").innerHTML = r.ccf.length ? '<table><thead><tr><th>Group</th><th class=num>β</th><th>Members</th><th>Common event</th><th class=num>λ or q of the common event</th><th class=num>Share of W</th></tr></thead><tbody>' + r.ccf.map(c => { const e = r.events[c.cid]; return "<tr><td class=mono>" + esc(c.id) + "</td><td class=num>" + c.beta + "</td><td class=mono>" + esc(c.members.join(", ")) + "</td><td class=mono>" + esc(c.cid) + "</td><td class=num>" + fE(c.lambda || c.q) + "</td><td class=num>" + (e ? fN(e.fvW * 100, 1) + " %" : "—") + "</td></tr>"; }).join("") + "</tbody></table>" : '<p class="muted">No common-cause groups. Add one on the CCF tab and assign events to it.</p>';
    publish();
  }
  function kpi(l, v, s, ok) { return '<div class="kpi' + (ok === true ? " pass" : ok === false ? " fail" : "") + '"><div class="l">' + esc(l) + '</div><div class="v">' + v + '</div><div class="s">' + s + "</div></div>"; }

  /* ================= RBD ================= */
  const rbd = () => curModel("rbd");
  function findNode(id, n, parent) {
    n = n || rbd().root;
    if (n.id === id) return { node: n, parent };
    for (const c of n.children || []) { const r = findNode(id, c, n); if (r) return r; }
    return null;
  }
  function allNodes(n, out) { out = out || []; n = n || rbd().root; out.push(n); (n.children || []).forEach(c => allNodes(c, out)); return out; }
  function rbdUid(prefix) { const used = new Set(allNodes().map(n => n.id)); let i = 1; while (used.has(prefix + i)) i++; return prefix + i; }

  const BW = 176, BH = 66, SG = 30, PG = 14, PAD = 24, RG = 44;
  function measure(n) {
    if (n.type === "block" || (n.type !== "block" && collapsed.has(n.id) && n !== rbd().root)) return (n._w = BW, n._h = BH, n);
    const ch = n.children || [];
    ch.forEach(measure);
    if (!ch.length) { n._w = BW; n._h = BH; return n; }
    if (n === rbd().root && n.type === "series" && ch.length > 5) {
      // long top-level series: wrap into rows of up to 5, read left to right, top to bottom
      const per = 5; n._rows = [];
      for (let i = 0; i < ch.length; i += per) { const r = ch.slice(i, i + per); n._rows.push({ items: r, w: r.reduce((s, c) => s + c._w, 0) + SG * (r.length - 1), h: Math.max(...r.map(c => c._h)) }); }
      n._w = Math.max(...n._rows.map(r => r.w)); n._h = n._rows.reduce((s, r) => s + r.h, 0) + RG * (n._rows.length - 1);
      return n;
    }
    n._rows = null;
    if (n.type === "series") { n._w = ch.reduce((s, c) => s + c._w, 0) + SG * (ch.length - 1); n._h = Math.max(...ch.map(c => c._h)); }
    else { n._w = Math.max(...ch.map(c => c._w)) + 2 * PAD; n._h = ch.reduce((s, c) => s + c._h, 0) + PG * (ch.length - 1) + 22; }
    const labelled = n.type === "series" && n !== rbd().root && n.name;
    if (labelled) { n._w += 16; n._h += 30; }
    return n;
  }
  function drawRBD() {
    const svg = $("#rbd-svg"); if (!svg) return;
    const rootN = rbd().root; measure(rootN);
    const res = rbdRes && rbdRes.ok ? rbdRes : null, spf = new Set(res ? res.spf : []);
    const imp = res ? res.blockImp : {}, maxImp = Math.max(1e-9, ...Object.values(imp).map(x => x.fvQ));
    const subRes = {}; if (res) res.subs.forEach(s => (subRes[s.id] = s));
    let h = "";
    const line = (x1, y1, x2, y2) => { h += '<path class="lnk" d="M' + x1 + " " + y1 + " H" + ((x1 + x2) / 2) + " V" + y2 + " H" + x2 + '"/>'; };
    function blockBox(n, x, y, groupBox) {
      const isSel = sel.rbd === n.id, nonsaf = n.saf === false;
      const fv = imp[n.id] ? imp[n.id].fvQ / maxImp : 0;
      let cls = "nd blk" + (isSel ? " sel" : "") + (spf.has(n.id) ? " spf" : "") + (nonsaf ? " nonsaf" : "");
      const sr = subRes[n.id];
      if (groupBox && sr && sr.passBudget != null) cls += sr.passBudget ? " okb" : " badb";
      h += '<g class="' + cls + '" data-id="' + esc(n.id) + '">';
      h += '<rect class="box" x="' + x + '" y="' + y + '" width="' + BW + '" height="' + BH + '" rx="4"/>';
      if (fv > 0.02 && !groupBox) h += '<rect class="heat" x="' + x + '" y="' + (y + BH - 4) + '" width="' + (BW * fv) + '" height="4"/>';
      const name = n.name || n.id;
      wrap(name, 29, 2).forEach((ln, i) => { h += '<text class="dt b" x="' + (x + 8) + '" y="' + (y + 16 + i * 13) + '">' + esc(ln) + "</text>"; });
      if (groupBox) {
        h += '<text class="val" x="' + (x + 8) + '" y="' + (y + 46) + '">' + (sr ? "A " + fP(sr.A, 5) : (n.children || []).length + " items") + "</text>";
        h += '<text class="val" x="' + (x + 8) + '" y="' + (y + 58) + '">' + (sr ? "λSAF " + fE(sr.W) + (sr.lamBudget ? " / " + fE(sr.lamBudget) : "") : "") + "</text>";
        h += '<text class="badge" x="' + (x + BW - 6) + '" y="' + (y + 46) + '" text-anchor="end">⊞ ' + (n.children || []).length + "</text>";
      } else {
        const mt = RW.blockMTTF(n);
        h += '<text class="val" x="' + (x + 8) + '" y="' + (y + 46) + '">' + (n.dist === "weibull" ? "Weibull β " + fN(num(n.beta, 1), 2) + " · η " + fN(num(n.eta, 0)) : "MTBF " + fN(mt) + " h") + "</text>";
        h += '<text class="val" x="' + (x + 8) + '" y="' + (y + 58) + '">MDT ' + fN(RW.blockMDT(n), 2) + " h" + (n.dormant ? " (incl. MUFT " + fN(RW.blockMUFT(n)) + ")" : "") + "</text>";
        const q = Math.max(1, Math.round(num(n.qty, 1))), k = Math.max(1, Math.round(num(n.k, q)));
        if (q > 1) h += '<rect class="kbox" x="' + (x + BW - 40) + '" y="' + (y - 8) + '" width="36" height="16" rx="3"/><text class="kt" x="' + (x + BW - 22) + '" y="' + (y + 4) + '" text-anchor="middle">' + Math.min(k, q) + "/" + q + "</text>";
        if (spf.has(n.id)) h += '<text class="spft" x="' + (x + 8) + '" y="' + (y - 4) + '">SINGLE POINT</text>';
        if (nonsaf) h += '<text class="badge" x="' + (x + BW - 8) + '" y="' + (y + 16) + '" text-anchor="end">non-SAF</text>';
      }
      h += "</g>";
    }
    function draw(n, x, y) { // returns [entryY, exitY] at the vertical centre
      const cy = y + n._h / 2;
      if (n.type === "block") { blockBox(n, x, cy - BH / 2, false); return; }
      if (n !== rootN && collapsed.has(n.id)) { blockBox(n, x, cy - BH / 2, true); return; }
      const ch = n.children || [];
      const labelled = n.type === "series" && n !== rootN && n.name;
      let ix = x, iy = y, iw = n._w, ih = n._h;
      if (labelled) {
        const sr = subRes[n.id];
        h += '<g class="grp' + (sel.rbd === n.id ? " sel" : "") + (sr && sr.passBudget === false ? " badg" : "") + '" data-id="' + esc(n.id) + '"><rect class="gbox" x="' + x + '" y="' + y + '" width="' + n._w + '" height="' + n._h + '" rx="6"/>' +
          '<text class="gt" x="' + (x + 10) + '" y="' + (y + 17) + '">' + esc(n.name) + (sr ? "   ·   A " + fP(sr.A, 5) + "   ·   λSAF " + fE(sr.W) + (sr.lamBudget ? " (budget " + fE(sr.lamBudget) + ")" : "") : "") + "</text></g>";
        ix = x + 8; iy = y + 26; iw = n._w - 16; ih = n._h - 30;
      }
      if (!ch.length) { h += '<text class="muted" x="' + (ix + 6) + '" y="' + (iy + ih / 2) + '">empty group</text>'; return; }
      if (n._rows) {
        let ry = iy, prev = null;
        n._rows.forEach((row, ri) => {
          const mid = ry + row.h / 2; let cx = ix;
          if (prev) { const yb = ry - RG / 2; h += '<path class="lnk" d="M' + prev.x + " " + prev.y + " H" + (prev.x + 14) + " V" + yb + " H" + (ix - 16) + " V" + mid + " H" + ix + '"/>'; }
          else n._in = mid;
          row.items.forEach((c, i) => { if (i) line(cx - SG, mid, cx, mid); draw(c, cx, mid - c._h / 2); cx += c._w + SG; });
          prev = { x: cx - SG, y: mid };
          ry += row.h + RG;
        });
        n._out = prev;
        return;
      }
      if (n.type === "series") {
        let cx = ix; const mid = iy + ih / 2; let prevExit = null;
        ch.forEach(c => { const top = mid - c._h / 2; if (prevExit != null) line(prevExit, mid, cx, mid); draw(c, cx, top); prevExit = cx + c._w; cx += c._w + SG; });
      } else {
        const k = n.type === "parallel" ? 1 : Math.max(1, Math.round(num(n.k, 1)));
        const lx = ix + 6, rx = ix + iw - 6, mid = iy + ih / 2;
        h += '<g class="grp' + (sel.rbd === n.id ? " sel" : "") + '" data-id="' + esc(n.id) + '"><text class="gk" x="' + (ix + 4) + '" y="' + (iy + 13) + '">' + (n.type === "standby" ? "standby " : n.type === "parallel" ? "parallel " : "") + k + " of " + ch.length + (n.name ? " · " + esc(n.name) : "") + "</text></g>";
        let cy2 = iy + 22;
        const ys = [];
        ch.forEach(c => { const ccx = ix + PAD + (iw - 2 * PAD - c._w) / 2; draw(c, ccx, cy2); const m = cy2 + c._h / 2; ys.push(m); h += '<path class="lnk" d="M' + lx + " " + m + " H" + ccx + '"/><path class="lnk" d="M' + (ccx + c._w) + " " + m + " H" + rx + '"/>'; cy2 += c._h + PG; });
        h += '<path class="lnk rail" d="M' + lx + " " + Math.min(...ys, mid) + " V" + Math.max(...ys, mid) + '"/><path class="lnk rail" d="M' + rx + " " + Math.min(...ys, mid) + " V" + Math.max(...ys, mid) + '"/>';
        h += '<path class="lnk" d="M' + ix + " " + mid + " H" + lx + '"/><path class="lnk" d="M' + rx + " " + mid + " H" + (ix + iw) + '"/>';
      }
    }
    const X0 = 40;
    rootN._in = null; rootN._out = null;
    const body = h.length;
    draw(rootN, X0, 0);
    const inY = rootN._in != null ? rootN._in : rootN._h / 2;
    const out = rootN._out || { x: X0 + rootN._w, y: rootN._h / 2 };
    h = h.slice(0, body) + '<circle class="term" cx="14" cy="' + inY + '" r="6"/><path class="lnk" d="M20 ' + inY + " H" + X0 + '"/>' + h.slice(body);
    h += '<path class="lnk" d="M' + out.x + " " + out.y + " H" + (out.x + 20) + '"/><circle class="term" cx="' + (out.x + 26) + '" cy="' + out.y + '" r="6"/>';
    $("#rbd-view").innerHTML = h;
    viewBounds.rbd = { w: X0 + rootN._w + 40, h: rootN._h };
    applyView();
  }

  function rbdPanel() {
    const box = $("#rbd-props"), m = rbd(), f = sel.rbd && findNode(sel.rbd);
    if (!f) {
      box.innerHTML = '<h3>Block diagram</h3><p class="muted">Click a block or group to edit it. Click a collapsed group (⊞) twice to open it.</p>' +
        '<div class="fld"><label>Model name</label><input data-rm="name" value="' + esc(m.name) + '"></div>' +
        '<div class="row2"><div class="fld"><label>Operating hours per year</label><div class="unit"><input type="number" data-rm="hoursPerYear" value="' + esc(m.hoursPerYear) + '"><span>h</span></div></div>' +
        '<div class="fld"><label>Mission time</label><div class="unit"><input type="number" data-rm="missionTime" value="' + esc(m.missionTime) + '"><span>h</span></div></div></div>' +
        '<div class="row2"><div class="fld"><label>Target availability</label><div class="unit"><input type="number" step="any" data-rm="targetA" value="' + esc(m.targetA) + '"><span>%</span></div></div>' +
        '<div class="fld"><label>Target MTBSAF</label><div class="unit"><input type="number" data-rm="targetMTBSAF" value="' + esc(m.targetMTBSAF) + '"><span>h</span></div></div></div>' +
        '<div class="fld"><label>Description</label><textarea data-rm="desc" rows="4">' + esc(m.desc) + "</textarea></div>" +
        '<div class="btnrow"><button class="btn sm" data-rx="expandall">Expand all</button><button class="btn sm" data-rx="collapseall">Collapse subsystems</button></div>';
      return;
    }
    const n = f.node, isRoot = n === m.root;
    const head = '<h3>' + (n.type === "block" ? "Block" : "Group") + ' <span class="mono">' + esc(n.id) + "</span></h3>";
    const move = isRoot ? "" : '<div class="btnrow"><button class="btn sm" data-rx="up">↑ Earlier</button><button class="btn sm" data-rx="down">↓ Later</button><button class="btn sm" data-rx="dup">Duplicate</button><button class="btn sm danger" data-rx="del">Delete</button></div>';
    const sr = rbdRes && rbdRes.ok && rbdRes.subs.find(s => s.id === n.id);
    const imp = rbdRes && rbdRes.ok && rbdRes.blockImp[n.id];
    if (n.type === "block") {
      const mdtSplit = n.maldt != null;
      box.innerHTML = head + (imp ? '<div class="mini"><span>Share of downtime <b>' + fN(imp.fvQ * 100, 1) + " %</b></span><span>of SAF <b>" + fN(imp.fvW * 100, 1) + " %</b></span></div>" : "") +
        '<div class="fld"><label>ID</label><input data-rb="id" value="' + esc(n.id) + '"></div>' +
        '<div class="fld"><label>Name</label><input data-rb="name" value="' + esc(n.name || "") + '"></div>' +
        '<div class="row2"><div class="fld"><label>Units installed (n)</label><input type="number" min="1" data-rb="qty" value="' + esc(n.qty || 1) + '"></div><div class="fld"><label>Units required (k)</label><input type="number" min="1" data-rb="k" value="' + esc(n.k || n.qty || 1) + '"></div></div>' +
        '<div class="fld"><label>Failure distribution</label><select data-rb="dist"><option value="exp"' + (n.dist !== "weibull" ? " selected" : "") + '>Exponential (constant rate)</option><option value="weibull"' + (n.dist === "weibull" ? " selected" : "") + ">Weibull</option></select></div>" +
        (n.dist === "weibull"
          ? '<div class="row2"><div class="fld"><label>Shape β</label><input type="number" step="any" data-rb="beta" value="' + esc(n.beta || 1) + '"></div><div class="fld"><label>Scale η</label><div class="unit"><input type="number" step="any" data-rb="eta" value="' + esc(n.eta || "") + '"><span>h</span></div></div></div><small class="muted">Mean life η·Γ(1+1/β) = ' + fN(RW.blockMTTF(n)) + " h</small>"
          : '<div class="fld"><label>MTBF</label><div class="unit"><input type="number" step="any" data-rb="mtbf" value="' + esc(n.mtbf || "") + '"><span>h</span></div><small>λ = ' + fE(1 / num(n.mtbf, Infinity)) + " /h</small></div>") +
        '<div class="row2"><div class="fld"><label>MALDT</label><div class="unit"><input type="number" step="any" data-rb="maldt" value="' + esc(mdtSplit ? n.maldt : "") + '" placeholder="0.25 / 1"><span>h</span></div></div><div class="fld"><label>MTTR</label><div class="unit"><input type="number" step="any" data-rb="mttr" value="' + esc(mdtSplit ? n.mttr : "") + '"><span>h</span></div></div></div>' +
        '<div class="fld"><label>Mean down time MDT (= MALDT + MTTR)</label><div class="unit"><input type="number" step="any" data-rb="mdt" value="' + esc(n.mdt) + '"' + (mdtSplit ? " readonly" : "") + '><span>h</span></div><small>Annex 2 §4.10.9: MALDT 0.25 h control room, 1 h trackside</small></div>' +
        '<label class="chk"><input type="checkbox" data-rb="saf"' + (n.saf !== false ? " checked" : "") + "> Service-affecting failure (SAF)</label>" +
        '<label class="chk"><input type="checkbox" data-rb="dormant"' + (n.dormant ? " checked" : "") + "> Unrevealed failure, found by proof test</label>" +
        (n.dormant ? '<div class="fld"><label>Proof-test interval</label><div class="unit"><input type="number" step="any" data-rb="ti" value="' + esc(n.ti || "") + '"><span>h</span></div><small>MUFT = T/2 = ' + fN(RW.blockMUFT(n), 1) + " h is added to the MDT (Annex 2 §3.3.1)</small></div>" : "") +
        '<div class="fld"><label>Data source / reference</label><input data-rb="ref" value="' + esc(n.ref || "") + '" placeholder="NPRD-2016 …, FMECA FM-…"></div>' + move;
    } else {
      box.innerHTML = head + (sr ? '<div class="mini"><span>A <b>' + fP(sr.A, 5) + "</b></span><span>λSAF <b>" + fE(sr.W) + "</b></span><span>MTBSAF <b>" + fN(sr.mut) + " h</b></span></div>" : "") +
        '<div class="fld"><label>ID</label><input data-rb="id" value="' + esc(n.id) + '"></div>' +
        '<div class="fld"><label>Name</label><input data-rb="name" value="' + esc(n.name || "") + '"></div>' +
        (isRoot ? "" : '<div class="row2"><div class="fld"><label>Arrangement</label><select data-rb="type"><option value="series"' + (n.type === "series" ? " selected" : "") + '>Series (all needed)</option><option value="parallel"' + (n.type === "parallel" ? " selected" : "") + '>Parallel (1 needed)</option><option value="kofn"' + (n.type === "kofn" ? " selected" : "") + '>k of n needed</option><option value="standby"' + (n.type === "standby" ? " selected" : "") + ">Standby (k active)</option></select></div>" +
          (n.type === "kofn" || n.type === "standby" ? '<div class="fld"><label>k needed</label><input type="number" min="1" data-rb="k" value="' + esc(n.k || 1) + '"></div>' : "<div></div>") + "</div>") +
        (f.parent === m.root ? '<div class="row2"><div class="fld"><label>λ(SAF) budget</label><div class="unit"><input type="number" step="any" data-rb="lamBudget" value="' + esc(n.lamBudget || "") + '"><span>/h</span></div></div><div class="fld"><label>Availability target</label><div class="unit"><input type="number" step="any" data-rb="targetA" value="' + esc(n.targetA || "") + '"><span>%</span></div></div></div>' : "") +
        '<div class="btnrow"><button class="btn sm" data-rx="addblock">+ Block</button><button class="btn sm" data-rx="addseries">+ Series group</button><button class="btn sm" data-rx="addpar">+ Parallel group</button></div>' +
        (isRoot ? "" : '<div class="btnrow"><button class="btn sm" data-rx="toggle">' + (collapsed.has(n.id) ? "Open group" : "Collapse group") + "</button></div>") + move;
    }
  }
  function rbdPanelInput(t) {
    const m = rbd();
    if (t.dataset.rm) { const k = t.dataset.rm; m[k] = t.type === "number" ? num(t.value, 0) : t.value; changed(false); return; }
    const f = sel.rbd && findNode(sel.rbd); if (!f || !t.dataset.rb) return;
    const n = f.node, k = t.dataset.rb;
    if (k === "id") { const v = t.value.trim(); if (!v || (v !== n.id && findNode(v))) { t.classList.add("bad"); return; } t.classList.remove("bad"); if (collapsed.has(n.id)) { collapsed.delete(n.id); collapsed.add(v); } n.id = v; sel.rbd = v; changed(true, true); return; }
    if (k === "saf" || k === "dormant") { n[k] = t.checked; changed(true); rbdPanel(); return; }
    if (k === "dist" || k === "type") { n[k] = t.value; if (k === "type" && (t.value === "kofn" || t.value === "standby") && !n.k) n.k = 1; changed(true); rbdPanel(); return; }
    if (k === "maldt" || k === "mttr") { n[k] = num(t.value, 0); if (n.maldt == null) n.maldt = 0; if (n.mttr == null) n.mttr = 0; n.mdt = num(n.maldt, 0) + num(n.mttr, 0); const md = $('[data-rb="mdt"]'); if (md) { md.value = n.mdt; md.readOnly = true; } changed(true, true); return; }
    if (["qty", "k", "mtbf", "mdt", "beta", "eta", "ti", "lamBudget", "targetA"].includes(k)) n[k] = num(t.value, 0); else n[k] = t.value;
    changed(true, true);
  }
  function rbdPanelClick(b) {
    const m = rbd(), x = b.dataset.rx;
    if (x === "expandall") { collapsed.clear(); drawRBD(); fitView(); return; }
    if (x === "collapseall") { (m.root.children || []).forEach(c => { if (c.type !== "block") collapsed.add(c.id); }); drawRBD(); fitView(); return; }
    const f = sel.rbd && findNode(sel.rbd); if (!f) return;
    const n = f.node, p = f.parent;
    const newBlock = () => ({ type: "block", id: rbdUid("B"), name: "New block", mtbf: 10000, mdt: 2, maldt: 1, mttr: 1, qty: 1, k: 1, saf: true, dist: "exp" });
    if (x === "addblock") { n.children = n.children || []; const b2 = newBlock(); n.children.push(b2); collapsed.delete(n.id); sel.rbd = b2.id; }
    else if (x === "addseries" || x === "addpar") { n.children = n.children || []; const g = { type: x === "addpar" ? "parallel" : "series", id: rbdUid("G"), name: x === "addpar" ? "Redundant group" : "Group", children: [newBlock()] }; n.children.push(g); collapsed.delete(n.id); sel.rbd = g.id; }
    else if (x === "toggle") { if (collapsed.has(n.id)) collapsed.delete(n.id); else collapsed.add(n.id); }
    else if (p && (x === "up" || x === "down")) { const i = p.children.indexOf(n), j = i + (x === "up" ? -1 : 1); if (j >= 0 && j < p.children.length) { p.children[i] = p.children[j]; p.children[j] = n; } }
    else if (p && x === "dup") { const c = clone(n); const re = o => { o.id = rbdUid(o.type === "block" ? "B" : "G") + "_" + Math.random().toString(36).slice(2, 5); (o.children || []).forEach(re); }; re(c); c.name = (c.name || "") + " (copy)"; p.children.splice(p.children.indexOf(n) + 1, 0, c); sel.rbd = c.id; }
    else if (p && x === "del") { p.children = p.children.filter(c => c !== n); sel.rbd = p.id; }
    changed(true);
  }

  function rbdTable() {
    const rows = [];
    (function walk(n, path) { (n.children || []).forEach(c => { if (c.type === "block") rows.push({ n: c, path }); else walk(c, path ? path + " › " + (c.name || c.id) : (c.name || c.id)); }); })(rbd().root, "");
    $("#cnt-blk").textContent = rows.length;
    const imp = rbdRes && rbdRes.ok ? rbdRes.blockImp : {};
    $("#tbl-blk").innerHTML = "<thead><tr><th>ID</th><th>Name</th><th>Group</th><th class=num>n</th><th class=num>k</th><th>Dist.</th><th class=num>MTBF / η (h)</th><th class=num>β</th><th class=num>MDT (h)</th><th>SAF</th><th class=num>Test T (h)</th><th>Reference</th><th class=num>Share of downtime</th></tr></thead><tbody>" +
      rows.map(({ n, path }) => { const id = esc(n.id), w = n.dist === "weibull"; return '<tr class="' + (sel.rbd === n.id ? "rowsel" : "") + (n.saf === false ? " nonsaf" : "") + '"><td class="mono">' + id + '</td><td><input type="text" data-bt="' + id + ':name" value="' + esc(n.name || "") + '"></td><td class="muted small">' + esc(path) + '</td><td><input type="number" min="1" data-bt="' + id + ':qty" value="' + esc(n.qty || 1) + '"></td><td><input type="number" min="1" data-bt="' + id + ':k" value="' + esc(n.k || n.qty || 1) + '"></td><td><select data-bt="' + id + ':dist"><option value="exp"' + (!w ? " selected" : "") + '>Exp</option><option value="weibull"' + (w ? " selected" : "") + ">Weibull</option></select></td><td><input type=\"number\" step=\"any\" data-bt=\"" + id + ":" + (w ? "eta" : "mtbf") + '" value="' + esc(w ? n.eta : n.mtbf) + '"></td><td>' + (w ? '<input type="number" step="any" data-bt="' + id + ':beta" value="' + esc(n.beta) + '">' : '<span class="muted">–</span>') + '</td><td><input type="number" step="any" data-bt="' + id + ':mdt" value="' + esc(n.mdt) + '"></td><td><input type="checkbox" data-bt="' + id + ':saf"' + (n.saf !== false ? " checked" : "") + '></td><td><input type="number" step="any" data-bt="' + id + ':ti" value="' + esc(n.dormant ? n.ti : "") + '" placeholder="–"></td><td><input type="text" data-bt="' + id + ':ref" value="' + esc(n.ref || "") + '"></td><td class=num>' + (imp[n.id] ? fN(imp[n.id].fvQ * 100, 1) + " %" : "—") + "</td></tr>"; }).join("") + "</tbody>";
  }
  function rbdTableInput(t) {
    const [id, k] = t.dataset.bt.split(":"), f = findNode(id); if (!f) return;
    const n = f.node;
    if (k === "saf") n.saf = t.checked;
    else if (k === "ti") { const v = num(t.value, 0); n.ti = v; n.dormant = v > 0; }
    else if (k === "mdt") { n.mdt = num(t.value, 0); delete n.maldt; delete n.mttr; }
    else if (["qty", "k", "mtbf", "eta", "beta"].includes(k)) n[k] = num(t.value, 0);
    else n[k] = t.value;
    changed(k === "dist", true);
  }

  function rbdResults() {
    const r = rbdRes;
    const iss = $("#rbd-issues"), msgs = (r.errors || []).map(x => "<li>" + esc(x) + "</li>").join("");
    iss.hidden = !msgs; iss.innerHTML = msgs ? "<b>Check the model</b><ul>" + msgs + "</ul>" : "";
    if (!r.ok) { $("#tb-result").textContent = "Model error"; $("#tb-result").className = "res bad"; return; }
    const s = r.system;
    const allPass = s.passA !== false && s.passM !== false && r.subs.every(x => x.passBudget !== false);
    $("#tb-result").textContent = s.passA === false || s.passM === false ? "Target not met" : allPass ? "Meets targets" : "Budget exceeded";
    $("#tb-result").className = "res " + (allPass ? "good" : "bad");
    $("#rbd-kpis").innerHTML =
      kpi("System availability (SAF)", fP(s.A, 5), s.targetA ? "target " + fN(s.targetA, 4) + " % " + pill(s.passA) : "no target", s.passA) +
      kpi("MTBSAF", fN(s.mtbsaf) + " h", s.targetM ? "target " + fN(s.targetM) + " h " + pill(s.passM) : "no target", s.passM) +
      kpi("λ(SAF)", fE(s.W) + " /h", fN(s.safPerYear, 3) + " service-affecting failures per year", null) +
      kpi("Mean down time (system)", fN(s.mdt, 2) + " h", "downtime " + fN(s.downtimeMinYr, 1) + " min per year", null) +
      kpi("MTBF, all failures", fN(s.mtbfAll) + " h", "λ all " + fE(s.lamAll) + " /h · maintenance demand " + fN(s.lamAll * r.hpy, 1) + " /yr", null) +
      kpi("Mission reliability", fP(s.Rmission, 4), "no SAF in " + fN(r.mission) + " h, without repair · MTTF " + fN(s.mttf) + " h", null) +
      kpi("Single points of failure", String(r.spf.length), r.spf.length ? esc(r.spf.join(", ")) : "none found in the SAF model", r.spf.length ? false : true);
    $("#rbd-sumnote").textContent = r.blocks.length + " blocks · " + r.cutsets.length + " minimal cut sets (order ≤ 4) · exact BDD solution";
    // allocation
    $("#rbd-alloc").innerHTML = '<table><thead><tr><th>Subsystem</th><th class=num>Availability</th><th class=num>λ(SAF) predicted (/h)</th><th class=num>λ(SAF) budget (/h)</th><th class=num>Margin (/h)</th><th class=num>Use of budget</th><th class=num>MTBSAF (h)</th><th class=num>MDT (h)</th><th class=num>λ all (/h)</th><th>Result</th></tr></thead><tbody>' +
      r.subs.map(x => '<tr><td>' + esc(x.name) + "</td><td class=num>" + fP(x.A, 5) + "</td><td class=num>" + fE(x.W) + "</td><td class=num>" + (x.lamBudget ? fE(x.lamBudget) : "—") + "</td><td class=num>" + (x.margin != null ? fE(x.margin) : "—") + '</td><td class=num><div class="inbar"><i style="width:' + Math.min(90, Math.max(1, (x.lamBudget ? x.W / x.lamBudget : 0) * 90)) + "px;" + (x.passBudget === false ? "background:var(--fail)" : "") + '"></i><span>' + (x.lamBudget ? fN(x.W / x.lamBudget * 100, 0) + " %" : "—") + "</span></div></td><td class=num>" + fN(x.mut) + "</td><td class=num>" + fN(x.mdt, 2) + "</td><td class=num>" + fE(x.lamAll) + "</td><td>" + pill(x.passBudget, "within budget", "over budget") + "</td></tr>").join("") +
      "</tbody></table>";
    // contributors
    const imp = Object.keys(r.blockImp).map(id => ({ id, v: r.blockImp[id].fvQ, w: r.blockImp[id].fvW, n: (findNode(id) || { node: {} }).node.name || id })).sort((a, b) => b.v - a.v).slice(0, 14);
    barChart($("#rbd-pareto"), imp.map(x => ({ label: x.n, v: x.v, txt: fN(x.v * 100, 1) + " % of downtime · " + fN(x.w * 100, 1) + " % of SAF" })), "Share of system unavailability");
    lineChart($("#rbd-curve"), r.relCurve.map(p => [p.t, p.R]), { xl: "operating time without repair (h)", yl: "R(t)", fmtY: v => v.toFixed(2), ymin: 0, ymax: 1 });
    $("#rbd-cs").innerHTML = '<table><thead><tr><th class=num>#</th><th class=num>Order</th><th>Blocks / units failed together</th><th class=num>λ (/h)</th><th class=num>Share of downtime</th></tr></thead><tbody>' +
      r.cutsets.slice(0, 60).map((c, i) => "<tr><td class=num>" + (i + 1) + "</td><td class=num>" + c.order + "</td><td>" + c.blocks.map(b => '<span class="cse' + (c.order === 1 ? " spf" : "") + '">' + esc(b) + "</span>").join(" · ") + "</td><td class=num>" + fE(c.W) + "</td><td class=num>" + fN(c.shareQ * 100, 2) + " %</td></tr>").join("") + "</tbody></table>";
    publish();
  }

  /* ---------------- Monte Carlo ---------------- */
  let simRun = null;
  function runSim() {
    if (simRun) { simRun.stop = true; return; }
    const years = num($("#mc-years").value, 10), runs = Math.round(num($("#mc-runs").value, 1000));
    const life = years * num(rbd().hoursPerYear, 8760);
    const sim = RW.simulator(rbd(), { life, runs, seed: Math.round(num($("#mc-seed").value, 1)), repairDist: $("#mc-rep").value, switchFail: num($("#mc-sw").value, 0) });
    if (sim.error) { $("#mc-out").innerHTML = '<p class="bad">' + esc(sim.error) + "</p>"; return; }
    simRun = { stop: false };
    $("#b-mc").textContent = "Stop";
    const t0 = performance.now();
    const tick = () => {
      if (simRun.stop) return done(sim.summary());
      const s = sim.step(Math.max(1, Math.round(runs / 50)));
      showSim(s, performance.now() - t0);
      if (s.finished) return done(s);
      setTimeout(tick, 0);
    };
    const done = s => { simRun = null; $("#b-mc").textContent = "Run simulation"; showSim(s, performance.now() - t0, true); };
    tick();
  }
  function showSim(s, ms, final) {
    const a = rbdRes && rbdRes.ok ? rbdRes.system : null;
    const inA = a ? a.A >= s.Alo && a.A <= s.Ahi : null, inM = a && s.failures ? a.mtbsaf >= s.mtbsafLo && a.mtbsaf <= s.mtbsafHi : null;
    const cause = Object.keys(s.cause).map(k => [k, s.cause[k]]).sort((x, y) => y[1] - x[1]).slice(0, 8);
    $("#mc-bar").style.width = (s.done / s.runs * 100) + "%";
    $("#mc-out").innerHTML = '<div class="kpis">' +
      kpi("Simulated availability", fP(s.A, 5), "95 % interval " + fP(s.Alo, 5) + " – " + fP(s.Ahi, 5), null) +
      kpi("Analytic availability", a ? fP(a.A, 5) : "—", a ? (inA ? '<span class="pill pass">inside the interval</span>' : '<span class="pill warn">outside the interval</span>') : "", null) +
      kpi("Simulated MTBSAF", s.failures ? fN(s.mtbsaf) + " h" : "no failure", s.failures ? "95 % interval " + fN(s.mtbsafLo) + " – " + (isFinite(s.mtbsafHi) ? fN(s.mtbsafHi) : "∞") + " h" : "increase runs or life", null) +
      kpi("Analytic MTBSAF", a ? fN(a.mtbsaf) + " h" : "—", inM == null ? "" : inM ? '<span class="pill pass">inside the interval</span>' : '<span class="pill warn">outside the interval</span>', null) +
      kpi("System failures simulated", fN(s.failures), fN(s.failuresPerRun, 3) + " per life of " + fN(s.life) + " h", null) +
      kpi("Runs", fN(s.done) + " / " + fN(s.runs), fN(ms / 1000, 1) + " s" + (final ? "" : " · running…"), null) + "</div>" +
      (cause.length ? '<h4 style="margin:14px 0 6px">Blocks whose failure brought the system down</h4><table><thead><tr><th>Block</th><th class=num>System failures caused</th><th class=num>Share</th></tr></thead><tbody>' + cause.map(([k, v]) => "<tr><td>" + esc((findNode(k) || { node: { name: k } }).node.name || k) + "</td><td class=num>" + fN(v) + "</td><td class=num>" + fN(v / Math.max(1, s.failures) * 100, 1) + " %</td></tr>").join("") + "</tbody></table>" : "") +
      '<p class="muted small">Analytic results treat standby groups as active redundancy (conservative). The simulation models cold standby (idle units do not fail) and the switch failure probability, so a standby group can make the simulated MTBSAF higher than the analytic one.</p>';
  }

  /* ---------------- charts ---------------- */
  function barChart(svg, rows, title) {
    const W = 900, rh = 26, top = 8, H = top + rows.length * rh + 22, lw = 330, max = Math.max(1e-12, ...rows.map(r => r.v));
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    let h = "";
    rows.forEach((r, i) => {
      const y = top + i * rh, bw = (W - lw - 200) * r.v / max;
      h += '<text class="lbl" x="' + (lw - 8) + '" y="' + (y + 16) + '" text-anchor="end">' + esc(r.label.length > 52 ? r.label.slice(0, 50) + "…" : r.label) + "</text>";
      h += '<rect class="bar" x="' + lw + '" y="' + (y + 5) + '" width="' + Math.max(1, bw) + '" height="15" rx="2"/>';
      h += '<text x="' + (lw + bw + 6) + '" y="' + (y + 16) + '">' + esc(r.txt) + "</text>";
    });
    h += '<text x="' + lw + '" y="' + (H - 4) + '">' + esc(title) + "</text>";
    svg.innerHTML = rows.length ? h : '<text x="10" y="20">No data</text>';
  }
  function lineChart(svg, pts, o) {
    const W = 900, H = 280, L = 74, R = 16, T = 12, B = 40;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    if (!pts.length) { svg.innerHTML = ""; return; }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs) || 1, y0 = o.ymin != null ? o.ymin : 0, y1 = o.ymax != null ? o.ymax : Math.max(...ys) * 1.08 || 1;
    const X = x => L + (x - x0) / (x1 - x0 || 1) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0 || 1)) * (H - T - B);
    let h = "";
    for (let i = 0; i <= 4; i++) { const v = y0 + (y1 - y0) * i / 4, y = Y(v); h += '<line class="gr" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + o.fmtY(v) + "</text>"; }
    for (let i = 0; i <= 5; i++) { const v = x0 + (x1 - x0) * i / 5, x = X(v); h += '<line class="gr" x1="' + x + '" x2="' + x + '" y1="' + T + '" y2="' + (H - B) + '"/><text x="' + x + '" y="' + (H - B + 16) + '" text-anchor="middle">' + fN(v) + "</text>"; }
    h += '<path class="ln" d="' + pts.map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ") + '"/>';
    h += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(o.xl) + '</text><text x="14" y="' + (T + 10) + '">' + esc(o.yl) + "</text>";
    svg.innerHTML = h;
  }

  /* ---------------- pan / zoom ---------------- */
  const view = { ft: { x: 20, y: 20, s: 1 }, rbd: { x: 20, y: 20, s: 1 } }, viewBounds = { ft: { w: 1, h: 1 }, rbd: { w: 1, h: 1 } };
  function applyView() { const m = S.mode, v = view[m], g = $(m === "ft" ? "#ft-view" : "#rbd-view"); if (g) g.setAttribute("transform", "translate(" + v.x + " " + v.y + ") scale(" + v.s + ")"); }
  function fitView() {
    const m = S.mode, svg = $(m === "ft" ? "#ft-svg" : "#rbd-svg"); if (!svg) return;
    const r = svg.getBoundingClientRect(), b = viewBounds[m];
    if (!r.width) return;
    let s = Math.max(0.12, Math.min(1.1, (r.width - 40) / b.w, (r.height - 40) / b.h));
    if (m === "ft" && s < 0.5) {
      // large tree: keep it readable and centre the top event; pan or zoom out to see the rest
      s = 0.5; const L = layoutFT(), rx = L.root ? L.root.x + NW / 2 : b.w / 2;
      view.ft = { s, x: r.width / 2 - rx * s, y: 24 };
    } else view[m] = { s, x: (r.width - b.w * s) / 2, y: Math.max(20, (r.height - b.h * s) / 2) };
    applyView();
  }
  function zoomBy(f, cx, cy) {
    const m = S.mode, v = view[m], svg = $(m === "ft" ? "#ft-svg" : "#rbd-svg"), r = svg.getBoundingClientRect();
    if (cx == null) { cx = r.width / 2; cy = Math.min(r.height / 2, v.y + 60); }
    const ns = Math.min(3, Math.max(0.08, v.s * f));
    v.x = cx - (cx - v.x) * ns / v.s; v.y = cy - (cy - v.y) * ns / v.s; v.s = ns; applyView();
  }
  function wireCanvas(svgSel, kind) {
    const svg = $(svgSel); let drag = null, moved = false;
    svg.addEventListener("wheel", e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    svg.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, vx: view[kind].x, vy: view[kind].y }; moved = false; });
    window.addEventListener("pointermove", e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; view[kind].x = drag.vx + dx; view[kind].y = drag.vy + dy; applyView(); });
    window.addEventListener("pointerup", () => { drag = null; });
    svg.addEventListener("click", e => {
      if (moved) return;
      const g = e.target.closest("[data-id]");
      if (kind === "ft") {
        sel.ft = g ? g.dataset.id : null;
        // remember the parent the event was clicked under
        sel.ftParent = null;
        if (g) { const L = layoutFT(); const idx = Array.from(svg.querySelectorAll("[data-id]")).indexOf(g); const n = L.nodes[idx]; if (n && n.parent) sel.ftParent = n.parent.id; }
        drawFT(); ftPanel(); ftTables();
      } else {
        const id = g ? g.dataset.id : null;
        if (id && sel.rbd === id && collapsed.has(id)) collapsed.delete(id);
        sel.rbd = id; drawRBD(); rbdPanel(); rbdTable();
      }
    });
  }

  /* ---------------- recompute ---------------- */
  let rt;
  function changed(redraw, keepPanel) {
    save();
    clearTimeout(rt);
    rt = setTimeout(() => { recompute(); if (!keepPanel) { if (S.mode === "ft") ftPanel(); else rbdPanel(); } }, 120);
  }
  function recompute() {
    $("#status").className = "status";
    if (!["ft", "rbd"].includes(S.mode)) {
      const st = window.RWExt ? window.RWExt.render(S.mode) : { ok: true, text: "" };
      $("#status").className = "status" + (st && st.bad ? " bad" : "");
      $("#status span").textContent = (st && st.text) || "Ready";
      $("#tb-result").textContent = (st && st.result) || "—"; $("#tb-result").className = "res " + (st && st.bad ? "bad" : st && st.good ? "good" : "");
      return;
    }
    if (S.mode === "ft") {
      ftRes = RW.analyseFT(ft(), S.opt);
      drawFT(); ftTables(); ftResults(); ftPanel();
    } else {
      rbdRes = RW.analyseRBD(rbd());
      drawRBD(); rbdTable(); rbdResults(); rbdPanel();
    }
    const bad = S.mode === "ft" ? !ftRes.ok || ftRes.top.pass === false : !rbdRes.ok;
    $("#status").className = "status" + (bad ? " bad" : "");
    $("#status span").textContent = S.mode === "ft" ? (ftRes.ok ? "Solved exactly · " + ftRes.cutsets.length + " cut sets" : "Model error") : (rbdRes.ok ? "Solved exactly" : "Model error");
  }

  /* ---------------- System page link ---------------- */
  function publish() {
    if (!window.RailIQSystem) return;
    try {
      if (S.mode === "ft" && ftRes && ftRes.ok) {
        const t = ftRes.top;
        window.RailIQSystem.publish("rams-workbench", { status: t.pass === false ? "fail" : t.pass ? "pass" : "info", headline: ft().name + ": W = " + fE(t.W) + " /h (" + t.sil + ")" + (t.thr ? ", THR " + fE(t.thr) : ""), metrics: [{ label: "Top-event frequency", value: fE(t.W) + " /h" }, { label: "SIL band", value: t.sil }, { label: "Cut sets", value: String(ftRes.cutsets.length) }], usedKeys: ["projectName"] });
      } else if (S.mode === "rbd" && rbdRes && rbdRes.ok) {
        const s = rbdRes.system;
        window.RailIQSystem.publish("rams-workbench", { status: s.passA === false || s.passM === false ? "fail" : "pass", headline: rbd().name + ": A = " + fP(s.A, 4) + ", MTBSAF " + fN(s.mtbsaf) + " h", metrics: [{ label: "Availability", value: fP(s.A, 4) }, { label: "MTBSAF", value: fN(s.mtbsaf) + " h" }, { label: "Single points of failure", value: String(rbdRes.spf.length) }], usedKeys: ["projectName", "hoursPerDay", "daysPerYear"] });
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------------- Excel exchange ---------------- */
  function exportXlsx() {
    if (!window.XLSX) { toast("Excel library not loaded (needs internet once)."); return; }
    if (!["ft", "rbd"].includes(S.mode)) { if (window.RWExt) window.RWExt.exportXlsx(S.mode); return; }
    const wb = XLSX.utils.book_new(), add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    const info = [["Rail-IQ RAMS Workbench export"], ["Project", S.project.name], ["Document ref.", S.project.doc], ["Exported", new Date().toISOString()], ["Note", "Rail-IQ is a design-stage checking tool. Contract deliverables use the Isograph tools named in Appendix 5 §2.11.1; re-enter or import these tables there and compare."]];
    if (S.mode === "ft") {
      const m = ft(), r = ftRes && ftRes.ok ? ftRes : null;
      if (r) info.push([], ["Fault tree", m.name], ["Top event", m.top], ["Top event frequency W (/h)", r.top.W], ["Top event unavailability Q", r.top.Q], ["Q rare-event", r.top.Qrare], ["Q min cut upper bound", r.top.Qmcub], ["Target THR (/h)", m.thr], ["SIL band of W", r.top.sil], ["Meets THR", r.top.pass == null ? "no target" : r.top.pass ? "yes" : "no"], ["Mission time (h)", m.missionTime]);
      add("Summary", info);
      add("Gates", [["Gate ID", "Type", "Vote k", "Description", "Inputs", "Q", "W (/h)"]].concat(m.gates.map(g => [g.id, g.type.toUpperCase(), g.type === "vote" ? g.k : "", g.desc, g.inputs.join(", "), r && r.gates[g.id] ? r.gates[g.id].Q : "", r && r.gates[g.id] ? r.gates[g.id].W : ""])));
      add("Events", [["Event ID", "Description", "Model", "Failure rate (/h)", "Mean down time (h)", "Test interval (h)", "Probability", "Frequency (/h)", "CCF group", "Reference", "q", "w (/h)"]].concat(m.events.map(e => [e.id, e.desc, e.model, e.lambda == null ? "" : e.lambda, e.mdt == null ? "" : e.mdt, e.ti == null ? "" : e.ti, e.q == null ? "" : e.q, e.f == null ? "" : e.f, e.ccf || "", e.ref || "", r && r.events[e.id] ? r.events[e.id].q : "", r && r.events[e.id] ? r.events[e.id].w : ""])));
      add("CCF", [["Group", "Beta", "Description"]].concat((m.ccf || []).map(c => [c.id, c.beta, c.desc || ""])));
      if (r) {
        add("Cut sets", [["#", "Order", "Events", "W (/h)", "Share of W", "Q"]].concat(r.cutsets.map((c, i) => [i + 1, c.order, c.ids.join(" . "), c.W, c.shareW, c.Q])));
        add("Importance", [["Event", "q", "w (/h)", "FV on W", "FV on Q", "Birnbaum", "Criticality", "RAW", "RRW"]].concat(Object.keys(r.events).map(id => { const e = r.events[id]; return [id, e.q, e.w, e.fvW, e.fvQ, e.IB, e.crit, isFinite(e.raw) ? e.raw : "inf", isFinite(e.rrw) ? e.rrw : "inf"]; })));
      }
      XLSX.writeFile(wb, "RailIQ_FTA_" + (m.top || "tree") + ".xlsx");
    } else {
      const m = rbd(), r = rbdRes && rbdRes.ok ? rbdRes : null;
      if (r) info.push([], ["RBD", m.name], ["System availability", r.system.A], ["MTBSAF (h)", r.system.mtbsaf], ["λ(SAF) (/h)", r.system.W], ["MDT (h)", r.system.mdt], ["MTBF all failures (h)", r.system.mtbfAll], ["Target availability (%)", m.targetA], ["Target MTBSAF (h)", m.targetMTBSAF], ["Single points of failure", r.spf.join(", ") || "none"]);
      add("Summary", info);
      const rows = [["ID", "Parent", "Type", "Name", "k needed", "Units n", "Distribution", "MTBF (h)", "Weibull beta", "Weibull eta (h)", "MALDT (h)", "MTTR (h)", "MDT (h)", "SAF", "Dormant", "Test interval (h)", "Lambda budget (/h)", "Target A (%)", "Reference"]];
      (function walk(n, p) { rows.push([n.id, p ? p.id : "", n.type, n.name || "", n.type === "block" ? n.k || n.qty || 1 : n.k || "", n.type === "block" ? n.qty || 1 : "", n.type === "block" ? n.dist || "exp" : "", n.mtbf || "", n.beta || "", n.eta || "", n.maldt == null ? "" : n.maldt, n.mttr == null ? "" : n.mttr, n.mdt == null ? "" : n.mdt, n.type === "block" ? (n.saf === false ? "N" : "Y") : "", n.dormant ? "Y" : "", n.ti || "", n.lamBudget || "", n.targetA || "", n.ref || ""]); (n.children || []).forEach(c => walk(c, n)); })(m.root, null);
      add("Blocks", rows);
      if (r) {
        add("Subsystems", [["Subsystem", "Availability", "Lambda SAF predicted (/h)", "Lambda SAF budget (/h)", "Margin (/h)", "MTBSAF (h)", "MDT (h)", "Lambda all (/h)"]].concat(r.subs.map(x => [x.name, x.A, x.W, x.lamBudget || "", x.margin == null ? "" : x.margin, x.mut, x.mdt, x.lamAll])));
        add("Cut sets", [["#", "Order", "Blocks", "Lambda (/h)", "Share of downtime"]].concat(r.cutsets.map((c, i) => [i + 1, c.order, c.blocks.join(" . "), c.W, c.shareQ])));
        add("Contributors", [["Block", "Share of downtime", "Share of SAF"]].concat(Object.keys(r.blockImp).map(id => [id, r.blockImp[id].fvQ, r.blockImp[id].fvW])));
      }
      XLSX.writeFile(wb, "RailIQ_RBD_" + (m.root.id || "model") + ".xlsx");
    }
    toast("Excel workbook saved.");
  }
  function importXlsx(file) {
    if (!window.XLSX) { toast("Excel library not loaded."); return; }
    const rd = new FileReader();
    rd.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheet = n => { const k = wb.SheetNames.find(x => x.toLowerCase() === n.toLowerCase()); return k ? XLSX.utils.sheet_to_json(wb.Sheets[k], { defval: "" }) : null; };
        const pick = (row, ...names) => { for (const n of names) { const k = Object.keys(row).find(x => x.toLowerCase().startsWith(n.toLowerCase())); if (k && row[k] !== "") return row[k]; } return ""; };
        const gs = sheet("Gates"), es = sheet("Events"), bs = sheet("Blocks");
        if (gs && es) {
          const m = { name: file.name.replace(/\.xlsx?$/i, ""), desc: "Imported from " + file.name, missionTime: 8760, thr: 1e-6, gates: [], events: [], ccf: [] };
          gs.forEach(r => { const id = String(pick(r, "Gate ID", "ID")).trim(); if (!id) return; m.gates.push({ id, type: String(pick(r, "Type") || "OR").toLowerCase(), k: num(pick(r, "Vote", "k"), 2), desc: String(pick(r, "Description")), inputs: String(pick(r, "Inputs")).split(/[,;\s]+/).filter(Boolean) }); });
          es.forEach(r => { const id = String(pick(r, "Event ID", "ID")).trim(); if (!id) return; const e = { id, desc: String(pick(r, "Description")), model: String(pick(r, "Model") || "repair").toLowerCase() }; [["lambda", "Failure rate"], ["mdt", "Mean down"], ["ti", "Test interval"], ["q", "Probability"], ["f", "Frequency"]].forEach(([k, h]) => { const v = pick(r, h); if (v !== "") e[k] = num(v, 0); }); const c = pick(r, "CCF"); if (c) e.ccf = String(c); const rf = pick(r, "Reference"); if (rf) e.ref = String(rf); m.events.push(e); });
          const cs = sheet("CCF"); if (cs) cs.forEach(r => { const id = String(pick(r, "Group")).trim(); if (id) m.ccf.push({ id, beta: num(pick(r, "Beta"), 0.05), desc: String(pick(r, "Description")) }); });
          // settings from a Rail-IQ export's Summary sheet, when present
          const sk = wb.SheetNames.find(x => x.toLowerCase() === "summary");
          if (sk) XLSX.utils.sheet_to_json(wb.Sheets[sk], { header: 1 }).forEach(r => {
            const k = String(r[0] || "").toLowerCase(), v = r[1];
            if (k.startsWith("target thr")) m.thr = num(v, m.thr); else if (k.startsWith("mission time")) m.missionTime = num(v, m.missionTime); else if (k === "fault tree" && v) m.name = String(v);
          });
          const used = new Set(); m.gates.forEach(g => g.inputs.forEach(i => used.add(i)));
          const top = m.gates.find(g => !used.has(g.id)); m.top = top ? top.id : (m.gates[0] || {}).id;
          addModel("ft", m); toast("Fault tree imported: " + m.gates.length + " gates, " + m.events.length + " events.");
        } else if (bs) {
          const byId = new Map(), rows = [];
          bs.forEach(r => { const id = String(pick(r, "ID")).trim(); if (!id) return; const type = String(pick(r, "Type") || "block").toLowerCase(); const n = { id, type, name: String(pick(r, "Name")) }; if (type === "block") { Object.assign(n, { qty: num(pick(r, "Units"), 1), k: num(pick(r, "k needed"), num(pick(r, "Units"), 1)), dist: String(pick(r, "Distribution") || "exp").toLowerCase(), mtbf: num(pick(r, "MTBF"), 0), beta: num(pick(r, "Weibull beta"), 1), eta: num(pick(r, "Weibull eta"), 0), mdt: num(pick(r, "MDT"), 0), saf: String(pick(r, "SAF") || "Y").toUpperCase() !== "N", dormant: String(pick(r, "Dormant")).toUpperCase() === "Y", ti: num(pick(r, "Test interval"), 0), ref: String(pick(r, "Reference")) }); const ml = pick(r, "MALDT"), mr = pick(r, "MTTR"); if (ml !== "" || mr !== "") { n.maldt = num(ml, 0); n.mttr = num(mr, 0); n.mdt = n.maldt + n.mttr; } } else { n.children = []; const k = pick(r, "k needed"); if (k !== "") n.k = num(k, 1); const lb = pick(r, "Lambda budget"); if (lb !== "") n.lamBudget = num(lb, 0); const ta = pick(r, "Target A"); if (ta !== "") n.targetA = num(ta, 0); } byId.set(id, n); rows.push([n, String(pick(r, "Parent")).trim()]); });
          let rootN = null; rows.forEach(([n, p]) => { if (p && byId.has(p)) byId.get(p).children.push(n); else if (!rootN) rootN = n; });
          if (!rootN || rootN.type === "block") throw new Error("The Blocks sheet needs one group without a parent (the system).");
          const prevR = rbd(); addModel("rbd", { name: file.name.replace(/\.xlsx?$/i, ""), desc: "Imported from " + file.name, hoursPerYear: prevR.hoursPerYear || 8760, missionTime: prevR.missionTime || 24, targetA: prevR.targetA, targetMTBSAF: prevR.targetMTBSAF, root: rootN });
          sel.rbd = null; collapsed.clear(); setMode("rbd"); toast("RBD imported: " + byId.size + " rows.");
        } else toast("No Gates/Events or Blocks sheet found. Use an exported workbook as the template.");
      } catch (err) { toast("Import failed: " + err.message); }
    };
    rd.readAsArrayBuffer(file);
  }
  function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  /* ---------------- verification ---------------- */
  function verify() {
    const r = window.RailIQRWTests.run(), ok = r.filter(x => x.pass).length;
    $("#ver-note").textContent = ok + " of " + r.length + " checks pass";
    $("#verify").innerHTML = '<table><thead><tr><th>Check</th><th class=num>Rail-IQ</th><th class=num>Expected</th><th>Basis</th><th>Result</th></tr></thead><tbody>' +
      r.map(x => "<tr><td>" + esc(x.name) + "</td><td class=num>" + (Math.abs(x.got) < 1e-3 && x.got !== 0 ? fE(x.got, 5) : fN(x.got, 6)) + "</td><td class=num>" + (Math.abs(x.exp) < 1e-3 && x.exp !== 0 ? fE(x.exp, 5) : fN(x.exp, 6)) + "</td><td class=muted>" + esc(x.ref) + "</td><td>" + pill(x.pass) + "</td></tr>").join("") + "</tbody></table>";
  }

  /* ---------------- wiring ---------------- */
  function init() {
    ensure();
    fillHeader();
    $$(".mode").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("#p-name").addEventListener("input", e => { S.project.name = e.target.value; save(); });
    $("#p-doc").addEventListener("input", e => { S.project.doc = e.target.value; save(); });
    $("#p-model").addEventListener("input", e => { if (KINDS[S.mode]) { curModel(S.mode).name = e.target.value; save(); const o = $("#model-sel").selectedOptions[0]; if (o) o.textContent = e.target.value; } });
    $("#sample").addEventListener("change", e => {
      const v = e.target.value; e.target.value = ""; if (!v) return;
      const [k, i] = v.split(":");
      const src = { ft: SAMPLES.fts, rbd: SAMPLES.rbds, eta: SAMPLES.etas, mk: SAMPLES.mks, wb: SAMPLES.wbs }[k];
      const m = clone(src[+i]); delete m.uid;
      if (S[KINDS[k].list].some(x => x.name === m.name)) m.name += " (copy)";
      addModel(k, m); toast("Added to the project: " + m.name);
    });
    $("#model-sel").addEventListener("change", e => { S.cur[S.mode] = +e.target.value; if (S.mode === "ft") sel.ft = null; if (S.mode === "rbd") { sel.rbd = null; collapsed.clear(); initCollapse(); } setMode(S.mode); });
    $("#model-new").addEventListener("click", () => addModel(S.mode, blankOf(S.mode)));
    $("#model-dup").addEventListener("click", () => { const m = clone(curModel(S.mode)); delete m.uid; m.name = (m.name || "") + " (copy)"; addModel(S.mode, m); });
    $("#model-del").addEventListener("click", () => {
      const L = S[KINDS[S.mode].list]; if (L.length <= 1) return;
      if (!confirm("Delete \"" + (curModel(S.mode).name || "this model") + "\" from the project? Save the project first if you may need it again.")) return;
      L.splice(S.cur[S.mode], 1); S.cur[S.mode] = Math.max(0, S.cur[S.mode] - 1); sel.ft = null; sel.rbd = null; setMode(S.mode);
    });
    if (window.RWExt) window.RWExt.init(host);
    $("#ft-props").addEventListener("input", e => ftPanelInput(e.target));
    $("#ft-props").addEventListener("change", e => { if (e.target.dataset.addex !== undefined) { const g = gateById(sel.ft); if (g && e.target.value) { g.inputs.push(e.target.value); changed(true); } } else if (e.target.tagName === "SELECT") ftPanelInput(e.target); });
    $("#ft-props").addEventListener("click", e => { const b = e.target.closest("button"); if (b) ftPanelClick(b); });
    $("#ft-tables").addEventListener("change", e => ftTableInput(e.target));
    $("#ft-tables").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.etdel != null) { const ev = ft().events[+b.dataset.etdel]; if (ev) { ft().gates.forEach(g => (g.inputs = g.inputs.filter(i => i !== ev.id))); ft().events.splice(+b.dataset.etdel, 1); changed(true); } }
      if (b.dataset.ctdel != null) { const c = ft().ccf[+b.dataset.ctdel]; if (c) { ft().events.forEach(e => { if (e.ccf === c.id) e.ccf = ""; }); ft().ccf.splice(+b.dataset.ctdel, 1); changed(true); } }
      if (b.id === "b-addev") { const id = uniqueId("E"); ft().events.push({ id, desc: "New basic event", model: "repair", lambda: 1e-5, mdt: 4 }); changed(true); toast(id + " added. Add it to a gate from the gate panel."); }
      if (b.id === "b-addccf") { ft().ccf = ft().ccf || []; let i = 1; while (ft().ccf.some(c => c.id === "CCF" + i)) i++; ft().ccf.push({ id: "CCF" + i, beta: 0.05, desc: "" }); changed(true); }
    });
    $$("#ft-tables .tab").forEach(t => t.addEventListener("click", () => { $$("#ft-tables .tab").forEach(x => x.setAttribute("aria-selected", x === t)); $$("#ft-tables [role=tabpanel]").forEach(p => (p.hidden = p.id !== t.dataset.tab)); }));
    $("#imp-sort").addEventListener("change", () => ftResults());
    $("#rbd-props").addEventListener("input", e => { if (e.target.tagName !== "SELECT" && e.target.type !== "checkbox") rbdPanelInput(e.target); });
    $("#rbd-props").addEventListener("change", e => { if (e.target.tagName === "SELECT" || e.target.type === "checkbox") rbdPanelInput(e.target); });
    $("#rbd-props").addEventListener("click", e => { const b = e.target.closest("button"); if (b) rbdPanelClick(b); });
    $("#tbl-blk").addEventListener("change", e => { if (e.target.dataset.bt) rbdTableInput(e.target); });
    $("#b-mc").addEventListener("click", runSim);
    wireCanvas("#ft-svg", "ft"); wireCanvas("#rbd-svg", "rbd");
    $$("[data-zoom]").forEach(b => b.addEventListener("click", () => { const z = b.dataset.zoom; if (z === "fit") fitView(); else zoomBy(z === "in" ? 1.25 : 0.8); }));
    $("#b-export").addEventListener("click", exportXlsx);
    $("#b-import").addEventListener("click", () => $("#f-xlsx").click());
    $("#f-xlsx").addEventListener("change", e => { if (e.target.files[0]) importXlsx(e.target.files[0]); e.target.value = ""; });
    $("#b-json").addEventListener("click", () => download("RailIQ_RAMS_Workbench.json", JSON.stringify(S, null, 1)));
    $("#b-jsonin").addEventListener("click", () => $("#f-json").click());
    $("#f-json").addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const v = migrate(JSON.parse(t)); if (v) { S = v; ensure(); sel.ft = null; sel.rbd = null; collapsed.clear(); initCollapse(); fillHeader(); setMode(S.mode || "sum"); toast("Project opened."); } else toast("Not a RAMS Workbench file."); }).catch(err => toast("Could not read: " + err.message)); e.target.value = ""; });
    $("#b-print").addEventListener("click", () => window.print());
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(fitView, 150); });
    if (window.RailIQSystem && window.RailIQSystem.mountBar) {
      try { window.RailIQSystem.mountBar({ module: "rams-workbench", mount: "#syslink", map: [{ key: "projectName", get: () => S.project.name, set: v => { S.project.name = v; fillHeader(); save(); } }, { key: "hoursPerDay", get: () => num(rbd().hoursPerYear, 8760) / 365, set: v => { rbd().hoursPerYear = num(v, 24) * 365; save(); if (S.mode === "rbd") recompute(); } }], onApplied: () => recompute() }); } catch (e) { /* ignore */ }
    }
    initCollapse();
    verify();
    const h = location.hash.slice(1), hm = { rbd: "rbd", fta: "ft", eta: "eta", markov: "mk", weibull: "wb", summary: "sum", isograph: "cmp" }[h];
    setMode(hm || S.mode || "sum");
  }
  // shared helpers for the extra workspaces (event tree, Markov, Weibull, project summary)
  const host = {
    get S() { return S; }, KINDS, curModel, save, toast, esc, num, fE, fN, fP, pill, kpi, lineChart, barChart, setMode, clone,
    ftValue: uidOrIdx => { const m = S.fts.find(x => x.uid === uidOrIdx); if (!m) return null; const r = RW.analyseFT(m, S.opt); return r.ok ? { ok: true, Q: r.top.Q, W: r.top.W, name: m.name } : { ok: false }; },
    rbdBlocks: () => { const out = []; (function w(n) { if (n.type === "block") out.push(n); else (n.children || []).forEach(w); })(rbd().root); return out; },
    openModel: (kind, i) => { S.cur[kind] = i; sel.ft = null; sel.rbd = null; collapsed.clear(); initCollapse(); setMode(kind); },
    analyseFTModel: m => RW.analyseFT(m, S.opt), analyseRBDModel: m => RW.analyseRBD(m)
  };
  function initCollapse() { const r = rbd().root; if ((r.children || []).length > 5) r.children.forEach(c => { if (c.type !== "block") collapsed.add(c.id); }); }
  document.addEventListener("DOMContentLoaded", init);
})();

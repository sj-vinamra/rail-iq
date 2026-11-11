/* Rail-IQ portal pages, all built from RAILIQ_CATALOG:
     home        index.html       hero, network view, railway systems grid
     systems     systems.html     all systems, or one system (?s=power) listing only its simulators by subsystem
     simulators  simulators.html  every simulator with search and filters
   The page type comes from <body data-page="...">. */
(function () {
  "use strict";
  const R = window.RailIQ, CAT = window.RAILIQ_CATALOG, DOM = window.RAILIQ_DOMAINS, SYS = window.RAILIQ_SYSTEMS;
  const $ = s => document.querySelector(s);
  const esc = R.esc;
  const PAGE = document.body.dataset.page || "home";
  const SHOW_PIPE = window.RAILIQ_SHOW_PIPELINE !== false; // false: only working simulators exist on the portal
  const SYS_ID = (() => { const s = new URLSearchParams(location.search).get("s"); return SYS[s] ? s : null; })();

  const STATUS_ORDER = { live: 0, beta: 1, planned: 2 };
  const state = { q: "", domain: null, system: SYS_ID, status: "all", sort: "status" };
  const statusLabel = s => (s === "planned" ? "Pipeline" : s);
  const sysUrl = k => "systems.html?s=" + encodeURIComponent(k);

  /* ---------- URL hash <-> filters ---------- */
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    state.q = h.get("q") || "";
    state.domain = DOM[h.get("domain")] ? h.get("domain") : null;
    if (PAGE === "simulators") state.system = SYS[h.get("system")] ? h.get("system") : null;
    state.status = ["all", "live", "planned"].includes(h.get("status")) ? h.get("status") : "all";
    return h.get("m");
  }
  function writeHash() {
    const h = new URLSearchParams();
    if (state.q) h.set("q", state.q);
    if (state.domain) h.set("domain", state.domain);
    if (PAGE === "simulators" && state.system) h.set("system", state.system);
    if (state.status !== "all") h.set("status", state.status);
    const s = h.toString();
    try { history.replaceState(null, "", s ? "#" + s : location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  /* ---------- stats ---------- */
  function countUp(el, to) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
    const t0 = performance.now(), d = 900;
    (function f(t) { const u = Math.min(1, (t - t0) / d); el.textContent = Math.round(to * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(f); })(t0);
  }
  function renderStats() {
    const live = CAT.filter(R.isOpenable).length;
    const vals = { live, pipe: CAT.length - live, sys: Object.keys(SYS).length, dom: Object.keys(DOM).length };
    document.querySelectorAll("[data-stat]").forEach(el => {
      if (el.dataset.stat === "pipe" && !SHOW_PIPE) { const t = el.closest(".stat"); if (t) t.remove(); return; }
      countUp(el, vals[el.dataset.stat]);
    });
  }

  /* ---------- railway systems grid ---------- */
  function renderSystemsGrid(box) {
    box.innerHTML = Object.entries(SYS).map(([k, s]) => {
      const all = CAT.filter(m => m.discipline === k), av = all.filter(R.isOpenable).length;
      const subs = (s.subsystems || []).map(sub => {
        const n = all.filter(m => m.subsystem === sub), a = n.filter(R.isOpenable).length;
        return "<span>" + esc(sub) + "<b>" + (a ? a + " available" : n.length ? n.length + " planned" : "—") + "</b></span>";
      }).join("");
      const ft = av + " available" + (SHOW_PIPE ? " · " + (all.length - av) + " planned" : "");
      return '<a class="syscard" href="' + sysUrl(k) + '"><div class="top"><span class="ico">' + R.icon(s.icon) + "</span><h3>" + esc(s.label) + "</h3></div>" +
        "<p>" + esc(s.blurb || "") + '</p><div class="subs">' + subs + '</div><div class="ft"><span>' + ft + '</span><span class="sp"></span>Open' + R.icon("arrow") + "</div></a>";
    }).join("");
  }

  /* ---------- system tabs (systems pages) ---------- */
  function renderSystemTabs(box) {
    box.innerHTML = '<a href="systems.html"' + (!SYS_ID ? ' aria-current="page"' : "") + ">" + R.icon("grid") + "All systems</a>" +
      Object.entries(SYS).map(([k, s]) => '<a href="' + sysUrl(k) + '"' + (k === SYS_ID ? ' aria-current="page"' : "") + ">" + R.icon(s.icon) + esc(s.label) + "</a>").join("");
  }

  /* ---------- one system: header ---------- */
  function renderSystemHero() {
    const s = SYS[SYS_ID], all = CAT.filter(m => m.discipline === SYS_ID), av = all.filter(R.isOpenable).length;
    const doms = Object.keys(DOM).filter(d => all.some(m => (m.domains || []).includes(d)));
    document.title = s.label + " · Rail-IQ";
    $("#crumbHere").textContent = s.label;
    $("#sysIco").innerHTML = R.icon(s.icon);
    $("#sysName").textContent = s.label;
    $("#sysBlurb").textContent = s.blurb || "";
    $("#sysMeta").innerHTML = '<span class="tag">' + av + " available</span>" + (SHOW_PIPE ? '<span class="tag">' + (all.length - av) + " planned</span>" : "") + '<span class="tag">' + (s.subsystems || []).length + " sub-system" + ((s.subsystems || []).length === 1 ? "" : "s") + "</span>" +
      doms.map(d => '<span class="dom" style="--c:' + DOM[d].color + '"><i></i>' + esc(DOM[d].label) + "</span>").join("");
  }

  /* ---------- filters ---------- */
  function matches(m) {
    if (state.system && m.discipline !== state.system) return false;
    if (state.domain && !(m.domains || []).includes(state.domain)) return false;
    if (state.status === "live" && !R.isOpenable(m)) return false;
    if (state.status === "planned" && R.isOpenable(m)) return false;
    if (state.q) {
      const hay = [m.title, m.summary, m.description, (SYS[m.discipline] || {}).label, m.subsystem, (m.domains || []).map(d => (DOM[d] || {}).label).join(" "), (m.standards || []).join(" "), (m.features || []).join(" ")].join(" ").toLowerCase();
      if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t))) return false;
    }
    return true;
  }
  function renderChips() {
    if (!SHOW_PIPE) { const seg = $("#statseg"); if (seg) seg.remove(); } // without a pipeline, Available = All
    const dc = $("#domchips");
    if (dc) dc.innerHTML = '<button class="chip" data-dom="" aria-pressed="' + !state.domain + '">All types</button>' +
      Object.entries(DOM).map(([k, d]) => '<button class="chip" data-dom="' + k + '" style="--c:' + d.color + '" aria-pressed="' + (state.domain === k) + '"><i></i>' + esc(d.label) + "</button>").join("");
    const sc = $("#syschips");
    if (sc) sc.innerHTML = '<button class="chip" data-sys="" aria-pressed="' + !state.system + '">All systems</button>' +
      Object.entries(SYS).map(([k, s]) => '<button class="chip" data-sys="' + k + '" aria-pressed="' + (state.system === k) + '">' + esc(s.label) + ' <span class="mono" style="opacity:.6">' + CAT.filter(m => m.discipline === k).length + "</span></button>").join("");
    document.querySelectorAll("#statseg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.status === state.status));
    document.querySelectorAll("#netlegend button").forEach(b => b.setAttribute("aria-pressed", b.dataset.dom === state.domain));
  }

  /* ---------- cards ---------- */
  function card(m, i) {
    const s = SYS[m.discipline] || { label: m.discipline, icon: "grid" }, open = R.isOpenable(m);
    const doms = (m.domains || []).map(k => DOM[k]).filter(Boolean);
    return '<article class="card ' + (open ? "" : "planned") + '" style="animation-delay:' + Math.min(i, 12) * 35 + 'ms" data-id="' + m.id + '">' +
      '<div class="rail">' + doms.map(x => '<i style="--c:' + x.color + '"></i>').join("") + "</div>" +
      '<div class="body"><div class="top"><span class="ico">' + R.icon(s.icon) + '</span><span class="disc-l">' + esc(PAGE === "systems" ? m.subsystem || s.label : s.label) + '</span><span class="pill ' + m.status + '">' + statusLabel(m.status) + "</span></div>" +
      "<h3>" + esc(m.title) + "</h3><p>" + esc(m.summary) + "</p>" +
      '<div class="doms">' + doms.map(x => '<span class="dom" style="--c:' + x.color + '"><i></i>' + esc(x.label) + "</span>").join("") + "</div>" +
      ((m.standards || []).length ? '<div class="stds">' + m.standards.map(esc).join(" · ") + "</div>" : "") + "</div>" +
      '<footer><span class="meta">' + (open ? esc(m.version || "") + (m.updated ? " · " + esc(m.updated) : "") : "In the Rail-IQ pipeline") + "</span>" +
      '<button class="btn sm ghost" data-details="' + m.id + '">' + R.icon("info") + "Details</button>" +
      (open ? '<a class="btn sm primary" href="' + R.launchUrl(m) + '">' + R.icon("play") + "Launch</a>" : "") + "</footer></article>";
  }
  const sorted = list => list.sort((a, b) =>
    state.sort === "name" ? a.title.localeCompare(b.title) :
    state.sort === "updated" ? String(b.updated || "").localeCompare(String(a.updated || "")) :
    (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.title.localeCompare(b.title));

  function renderCards() {
    const list = sorted(CAT.filter(matches));
    const parts = [];
    if (state.domain) parts.push(DOM[state.domain].label);
    if (PAGE === "simulators" && state.system) parts.push(SYS[state.system].label);
    if (state.status !== "all") parts.push(state.status === "live" ? "Available" : "Pipeline");
    if (state.q) parts.push("“" + state.q + "”");
    const total = PAGE === "systems" ? CAT.filter(m => m.discipline === SYS_ID).length : CAT.length;
    $("#resultline").innerHTML = "<span>" + list.length + " of " + total + " simulators" + (parts.length ? " · " + parts.map(esc).join(" · ") : "") + "</span>" + (parts.length ? '<button id="clear">clear</button>' : "");
    if (PAGE === "systems") {
      // one block per subsystem, listing only this system's simulators
      const subs = (SYS[SYS_ID].subsystems || []).slice();
      list.forEach(m => { if (m.subsystem && !subs.includes(m.subsystem)) subs.push(m.subsystem); });
      if (list.some(m => !m.subsystem)) subs.push("Other");
      let i = 0;
      $("#grid").innerHTML = subs.map(sub => {
        const ms = list.filter(m => (m.subsystem || "Other") === sub);
        const any = CAT.some(m => m.discipline === SYS_ID && (m.subsystem || "Other") === sub);
        return '<div class="subhead"><h3>' + esc(sub) + "</h3><span>" + ms.length + " simulator" + (ms.length === 1 ? "" : "s") + "</span></div>" +
          (ms.length ? '<div class="grid">' + ms.map(m => card(m, i++)).join("") + "</div>" : '<div class="subempty">' + (any ? "No simulator here matches the filters." : "No simulator yet. Suggest one to the Rail-IQ team.") + "</div>");
      }).join("");
    } else {
      $("#grid").innerHTML = list.length ? '<div class="grid">' + list.map(card).join("") + "</div>" :
        '<div class="empty">No simulator matches these filters. <button class="btn sm" id="clear2" style="margin-left:8px">Clear filters</button></div>';
    }
  }

  /* ---------- recent ---------- */
  function renderRecent() {
    const box = $("#recent"); if (!box) return;
    const r = R.recent();
    if (!r.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<span class="lbl">Recently opened</span>' + r.map(x => {
      const m = R.byId(x.id);
      return '<a href="' + R.launchUrl(m) + '">' + R.icon((SYS[m.discipline] || {}).icon || "grid", 'width="16" height="16"') + esc(m.title) + " <small>" + R.ago(x.t) + "</small></a>";
    }).join("");
  }

  /* ---------- detail drawer ---------- */
  const scrim = $("#scrim"), drawer = $("#drawer");
  let lastFocus = null;
  function openDrawer(m) {
    if (!drawer) { location.href = "simulators.html#m=" + encodeURIComponent(m.id); return; }
    lastFocus = document.activeElement;
    const s = SYS[m.discipline] || { label: m.discipline, icon: "grid" }, open = R.isOpenable(m);
    drawer.innerHTML =
      '<div class="dh"><div style="flex:1;min-width:0"><span class="pill ' + m.status + '">' + statusLabel(m.status) + '</span> <span class="mono" style="font-size:12px;color:var(--ink-3);margin-left:6px">' + esc(s.label) + (m.subsystem ? " · " + esc(m.subsystem) : "") + (m.version ? " · " + esc(m.version) : "") + "</span>" +
      '<h3 id="drawer-title">' + esc(m.title) + '</h3></div><button class="iconbtn" id="dclose" aria-label="Close">' + R.icon("close") + "</button></div>" +
      '<div class="db"><p>' + esc(m.description || m.summary) + "</p>" +
      ((m.features || []).length ? '<div><h5>' + (open ? "What it does" : "Planned scope") + '</h5><ul class="feat">' + m.features.map(f => "<li>" + esc(f) + "</li>").join("") + "</ul></div>" : "") +
      ((m.outputs || []).length ? '<div><h5>Outputs</h5><div class="tags">' + m.outputs.map(o => '<span class="tag">' + esc(o) + "</span>").join("") + "</div></div>" : "") +
      '<div><h5>Applies to</h5><div class="tags">' + (m.domains || []).map(k => DOM[k] ? '<span class="dom" style="--c:' + DOM[k].color + '"><i></i>' + esc(DOM[k].label) + "</span>" : "").join("") + "</div></div>" +
      ((m.standards || []).length ? '<div><h5>Reference standards</h5><div class="tags">' + m.standards.map(x => '<span class="tag mono">' + esc(x) + "</span>").join("") + "</div></div>" : "") +
      ((m.resources || []).length ? '<div class="res"><h5>Files & resources</h5>' + m.resources.map(r => '<a href="' + esc(r.href) + '" target="_blank" rel="noopener"><span>' + esc(r.label) + "</span>" + R.icon("ext", 'width="15" height="15"') + "</a>").join("") + "</div>" : "") +
      '<div><h5>System</h5><div class="tags"><a class="tag" href="' + sysUrl(m.discipline) + '" style="text-decoration:none">' + esc(s.label) + " →</a></div></div></div>" +
      '<div class="df">' + (open
        ? '<a class="btn primary" href="' + R.launchUrl(m) + '">' + R.icon("play") + 'Launch in workspace</a><a class="btn" href="' + esc(m.entry) + '" target="_blank" rel="noopener">' + R.icon("ext") + "Open standalone</a>"
        : '<span style="color:var(--ink-3);font-size:14px">This simulator is on the Rail-IQ roadmap and not yet available.</span>') + "</div>";
    drawer.setAttribute("aria-labelledby", "drawer-title");
    scrim.hidden = false; drawer.hidden = false;
    requestAnimationFrame(() => { scrim.classList.add("on"); drawer.classList.add("on"); });
    $("#dclose").onclick = closeDrawer;
    setTimeout(() => $("#dclose").focus(), 60);
  }
  function closeDrawer() {
    scrim.classList.remove("on"); drawer.classList.remove("on");
    setTimeout(() => { scrim.hidden = true; drawer.hidden = true; }, 260);
    if (lastFocus) lastFocus.focus();
  }
  if (scrim) scrim.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && drawer && !drawer.hidden) closeDrawer(); });

  /* ---------- update + events (pages with a list) ---------- */
  let net = null;
  function update() { renderChips(); renderCards(); writeHash(); if (net) net.setFocus(state.domain); }
  function wireList() {
    const q = $("#q");
    q.value = state.q;
    let tmr;
    q.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = q.value.trim(); update(); }, 120); });
    $("#domchips").addEventListener("click", e => { const b = e.target.closest("[data-dom]"); if (!b) return; state.domain = b.dataset.dom || null; update(); });
    const sc = $("#syschips"); if (sc) sc.addEventListener("click", e => { const b = e.target.closest("[data-sys]"); if (!b) return; state.system = b.dataset.sys || null; update(); });
    $("#statseg").addEventListener("click", e => { const b = e.target.closest("[data-status]"); if (!b) return; state.status = b.dataset.status; update(); });
    const so = $("#sort"); if (so) so.addEventListener("change", e => { state.sort = e.target.value; renderCards(); });
    document.addEventListener("click", e => {
      if (e.target.closest("#clear,#clear2")) { state.q = ""; state.domain = null; if (PAGE === "simulators") state.system = null; state.status = "all"; q.value = ""; update(); }
    });
    document.addEventListener("keydown", e => { if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); q.select(); } });
    window.addEventListener("hashchange", () => { const m = readHash(); q.value = state.q; update(); if (m && R.byId(m)) openDrawer(R.byId(m)); });
  }
  document.addEventListener("click", e => {
    const d = e.target.closest("[data-details]"); if (d) { openDrawer(R.byId(d.dataset.details)); return; }
    const c = e.target.closest(".card"); if (c && !e.target.closest("a,button")) openDrawer(R.byId(c.dataset.id));
  });

  /* ---------- network view (home) ---------- */
  function mountNetwork() {
    const cv = $("#net");
    if (!cv || !window.RailIQNetwork) return;
    net = window.RailIQNetwork.mount(cv, { tip: $("#nettip"), onSelect: dom => { location.href = "simulators.html#domain=" + dom; } });
    const legend = $("#netlegend");
    legend.innerHTML = Object.entries(DOM).map(([k, d]) => '<button data-dom="' + k + '" style="--c:' + d.color + '" aria-pressed="false"><i></i>' + esc(d.label) + "</button>").join("");
    legend.addEventListener("click", e => { const b = e.target.closest("[data-dom]"); if (b) location.href = "simulators.html#domain=" + b.dataset.dom; });
    legend.addEventListener("mouseover", e => { const b = e.target.closest("[data-dom]"); if (b) net.setFocus(b.dataset.dom); });
    legend.addEventListener("mouseleave", () => net.setFocus(null));
    $("#trains").textContent = net.trainCount;
    const clk = $("#clock");
    const tick = () => { clk.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); };
    tick(); setInterval(tick, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const deep = readHash();
    renderStats(); renderRecent(); mountNetwork();
    const sg = $("#systemsGrid"); if (sg && !SYS_ID) renderSystemsGrid(sg);
    const tabs = $("#systabs"); if (tabs) renderSystemTabs(tabs);
    if (PAGE === "systems") {
      document.body.classList.toggle("one-system", !!SYS_ID);
      if (SYS_ID) renderSystemHero();
    }
    if ($("#grid") && (PAGE === "simulators" || SYS_ID)) { wireList(); update(); }
    R.mountPalette({ onDetails: openDrawer });
    if (deep && R.byId(deep)) openDrawer(R.byId(deep));
    const y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
  });
})();

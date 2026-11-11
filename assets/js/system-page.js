/* Rail-IQ System page: shared parameters, data flow between simulators and their latest results. */
(function () {
  "use strict";
  const R = window.RailIQ, S = window.RailIQSystem, CAT = window.RAILIQ_CATALOG || [], DIS = window.RAILIQ_DISCIPLINES || {};
  const $ = s => document.querySelector(s), esc = R.esc;
  const SHORT = { "dc-traction-power": "DC traction power", "apm-onboard-telecom": "APM telecom", "rams": "RAMS", "tunnel-ventilation": "Tunnel ventilation", "noise-vibration": "Noise & vibration" };
  const STATUS = { pass: ["pass", "Pass"], fail: ["fail", "Fail"], info: ["live", "Run"], stale: ["stale", "Out of date"], none: ["none", "Not run yet"] };
  const short = id => SHORT[id] || (R.byId(id) || {}).title || id;

  // simulators shown: everything that can be opened, plus anything a parameter is linked to
  function modules() {
    const ids = new Set(CAT.filter(R.isOpenable).map(m => m.id));
    S.FIELDS.forEach(f => f.usedBy.forEach(id => { if (R.isOpenable(R.byId(id))) ids.add(id); }));
    return CAT.filter(m => ids.has(m.id));
  }
  const linked = id => S.FIELDS.filter(f => f.usedBy.includes(id));
  function statusOf(id, res) { const r = res[id]; if (!r) return "none"; if (r.stale && r.stale.length) return "stale"; return r.status in STATUS ? r.status : "info"; }

  /* ---------------- hero + stats ---------------- */
  function renderHero() {
    const v = S.get(), m = S.meta(), res = S.results(), mods = modules();
    $("#sysTitle").textContent = v.lineName || v.projectName || "System";
    document.title = (v.lineName || "System") + " · Rail-IQ";
    $("#sysSub").textContent = [v.projectName, v.systemType, m.custom ? "updated " + R.ago(m.updated) + (m.by ? " from " + short(m.by) : "") : "sample values: edit below"].filter(Boolean).join(" · ");
    const st = mods.map(x => statusOf(x.id, res));
    const cnt = k => st.filter(s => s === k).length;
    const tiles = [[mods.filter(x => linked(x.id).length).length, "simulators linked"], [S.FIELDS.length, "shared parameters"], [cnt("pass"), "passing"], [cnt("fail"), "failing"], [cnt("stale"), "out of date"]];
    $("#sysStats").innerHTML = tiles.map(t => "<div><b>" + t[0] + "</b><span>" + t[1] + "</span></div>").join("");
  }

  /* ---------------- module result cards ---------------- */
  function renderMods() {
    const res = S.results();
    $("#mods").innerHTML = modules().map(m => {
      const r = res[m.id], s = statusOf(m.id, res), [cls, txt] = STATUS[s], d = DIS[m.discipline] || {};
      const lk = linked(m.id).length;
      let body = '<div class="hl">' + (r ? esc(r.headline) : lk ? "Open the simulator and run it to post a result here." : "This simulator has no shared parameters yet.") + "</div>";
      if (r && r.metrics && r.metrics.length) body += "<dl>" + r.metrics.map(x => "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>").join("") + "</dl>";
      if (s === "stale") body += '<div class="hl" style="color:var(--beta);min-height:0;margin-bottom:10px">Changed since this run: ' + r.stale.map(k => esc(S.byKey[k].label)).join(", ") + "</div>";
      return '<article class="mod"><div class="hd"><span class="ico">' + R.icon(d.icon || "grid") + "</span><h3>" + esc(m.title) + '</h3><span class="pill ' + cls + '">' + txt + "</span></div>" + body +
        '<footer><span>' + lk + " linked value" + (lk === 1 ? "" : "s") + (r ? " · run " + R.ago(r.at) : "") + '</span><span class="sp"></span><a class="btn sm primary" href="' + R.launchUrl(m) + '">' + R.icon("play") + "Open</a></footer></article>";
    }).join("");
  }

  /* ---------------- data-flow diagram ---------------- */
  function renderFlow() {
    const svg = $("#flowSvg"), res = S.results(), mods = modules();
    const groups = S.GROUPS.filter(g => S.FIELDS.some(f => f.g === g.id));
    const W = 1000, rowG = 46, rowM = Math.max(58, (groups.length * rowG) / Math.max(1, mods.length));
    const H = Math.max(groups.length * rowG, mods.length * rowM) + 20;
    const gy = i => 10 + (H - 20 - groups.length * rowG) / 2 + i * rowG + rowG / 2;
    const my = i => 10 + (H - 20 - mods.length * rowM) / 2 + i * rowM + rowM / 2;
    const col = { pass: "var(--live)", fail: "#C4362C", stale: "var(--beta)", info: "var(--l-metro)", none: "var(--ink-3)" };
    let g = "";
    groups.forEach((gr, i) => mods.forEach((m, j) => {
      const n = S.FIELDS.filter(f => f.g === gr.id && f.usedBy.includes(m.id)).length; if (!n) return;
      const x1 = 230, y1 = gy(i), x2 = 760, y2 = my(j);
      g += '<path class="ln" data-g="' + gr.id + '" data-m="' + m.id + '" d="M' + x1 + " " + y1 + " C " + (x1 + 220) + " " + y1 + ", " + (x2 - 220) + " " + y2 + ", " + x2 + " " + y2 + '" style="stroke:' + col[statusOf(m.id, res)] + ";stroke-width:" + (1.6 + n * 0.7) + '"/>';
    }));
    groups.forEach((gr, i) => {
      const n = S.FIELDS.filter(f => f.g === gr.id).length, y = gy(i);
      g += '<g class="nd" data-g="' + gr.id + '"><rect x="20" y="' + (y - 17) + '" width="210" height="34" rx="8" style="fill:var(--surface);stroke:var(--line-2)"/>' +
        '<text x="34" y="' + (y + 5) + '" style="font-size:14px;font-weight:600">' + esc(gr.label) + '</text><text class="sm" x="218" y="' + (y + 4) + '" text-anchor="end">' + n + "</text></g>";
    });
    mods.forEach((m, j) => {
      const s = statusOf(m.id, res), y = my(j);
      g += '<g class="nd" data-m="' + m.id + '"><rect x="760" y="' + (y - 21) + '" width="220" height="42" rx="8" style="fill:var(--surface);stroke:' + col[s] + ';stroke-width:1.5"/>' +
        '<circle cx="778" cy="' + y + '" r="5" style="fill:' + col[s] + '"/><text x="792" y="' + (y - 2) + '" style="font-size:14px;font-weight:600">' + esc(short(m.id)) + '</text>' +
        '<text class="sm" x="792" y="' + (y + 13) + '">' + STATUS[s][1].toLowerCase() + " · " + linked(m.id).length + " values</text></g>";
    });
    g += '<text class="sm" x="20" y="' + (H - 1) + '">SYSTEM PARAMETER GROUPS</text><text class="sm" x="980" y="' + (H - 1) + '" text-anchor="end">SIMULATORS</text>';
    svg.setAttribute("viewBox", "0 0 " + W + " " + (H + 6)); svg.innerHTML = g;
  }
  function wireFlow() {
    const box = $("#flowBox");
    box.addEventListener("mouseover", e => {
      const n = e.target.closest("g.nd"); if (!n) return;
      box.classList.add("focus");
      box.querySelectorAll("path.ln").forEach(p => p.classList.toggle("on", (n.dataset.g && p.dataset.g === n.dataset.g) || (n.dataset.m && p.dataset.m === n.dataset.m)));
    });
    box.addEventListener("mouseleave", () => box.classList.remove("focus"));
    box.addEventListener("click", e => { const n = e.target.closest("g.nd[data-m]"); if (n) location.href = R.launchUrl(R.byId(n.dataset.m)); });
  }

  /* ---------------- parameter editor ---------------- */
  function renderParams() {
    const v = S.get();
    $("#paramGrid").innerHTML = S.GROUPS.map(gr => {
      const fs = S.FIELDS.filter(f => f.g === gr.id); if (!fs.length) return "";
      return '<div class="pgrp"><h4>' + esc(gr.label) + "</h4>" + fs.map(f => {
        const id = "p_" + f.key;
        const input = f.type === "select"
          ? '<select id="' + id + '" data-k="' + f.key + '">' + f.options.map(o => "<option" + (String(v[f.key]) === o ? " selected" : "") + ">" + esc(o) + "</option>").join("") + "</select>"
          : '<input id="' + id + '" data-k="' + f.key + '" type="' + (f.type === "text" ? "text" : "number") + '" step="any" value="' + esc(v[f.key] ?? "") + '">' + (f.unit ? '<span class="u">' + esc(f.unit) + "</span>" : "");
        const use = f.usedBy.length ? f.usedBy.map(id2 => "<span>" + esc(short(id2)) + "</span>").join("") : "<em>for reference; not linked to a simulator yet</em>";
        return '<div class="pf"' + (f.type === "text" ? ' style="grid-template-columns:1fr 1.6fr"' : "") + '><label for="' + id + '">' + esc(f.label) + '</label><div class="in">' + input + '</div><div class="use">' + use + "</div></div>";
      }).join("") + "</div>";
    }).join("");
  }
  function wireParams() {
    let t;
    const save = el => S.set(el.dataset.k, el.type === "number" ? (el.value === "" ? "" : +el.value) : el.value, "System page");
    $("#paramGrid").addEventListener("input", e => { const el = e.target; if (!el.dataset.k) return; clearTimeout(t); t = setTimeout(() => save(el), 300); });
    $("#paramGrid").addEventListener("change", e => { const el = e.target; if (el.dataset.k) { clearTimeout(t); save(el); } });
    $("#bExport").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ railiqSystem: 1, values: S.get() }, null, 2)], { type: "application/json" }));
      a.download = ((S.get().lineName || "system").replace(/[^\w.-]+/g, "_")) + "_RailIQ_system.json"; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
    };
    $("#bImport").onclick = () => $("#fImport").click();
    $("#fImport").onchange = e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { const j = JSON.parse(r.result); const vals = j.values || j; const ch = S.setMany(vals, "System page"); renderAll(); alert("Imported " + ch.length + " changed value(s) from " + f.name); } catch (err) { alert("Could not read " + f.name + ": " + err.message); } };
      r.readAsText(f);
    };
    $("#bReset").onclick = () => { if (confirm("Reset all System parameters to the sample values?")) { S.reset(); renderAll(); } };
  }

  function renderSummary() { renderHero(); renderMods(); renderFlow(); }
  function renderAll() { renderSummary(); renderParams(); }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll(); wireFlow(); wireParams();
    R.mountPalette({});
    // other tabs (a simulator posting a result) or this page's own edits
    S.onChange(d => { renderSummary(); if (d && d.external && d.type === "values") renderParams(); });
  });
})();

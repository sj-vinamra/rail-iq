/*
 * Rail-IQ System link
 * -------------------
 * One shared set of system parameters (the "System") that every module can read
 * from and write to, plus a record of each module's latest result.
 *
 *   RailIQSystem.FIELDS            parameter definitions (group, key, label, unit, usedBy)
 *   RailIQSystem.get()             current values (stored in the browser, sample by default)
 *   RailIQSystem.set(key, value)   change one value      setMany({...}) change several
 *   RailIQSystem.publish(id, s)    store a module's latest result summary
 *   RailIQSystem.results()         all published results, with a "stale" flag
 *   RailIQSystem.mountBar(opts)    adds the "System link" bar to a module page
 *
 * Modules exchange parameters through the System: a value defined once (e.g. the
 * fleet size or the tunnel cross-section) flows to every module that uses it.
 */
(function (root) {
  "use strict";
  const KEY_VALUES = "railiq.system.v1", KEY_RESULTS = "railiq.results.v1", EVT = "railiq:system";

  const GROUPS = [
    { id: "project", label: "Project" }, { id: "operation", label: "Operation" }, { id: "route", label: "Route" },
    { id: "stock", label: "Rolling stock" }, { id: "power", label: "Traction power" }, { id: "tunnel", label: "Tunnel" },
    { id: "env", label: "Environment" }, { id: "targets", label: "Design targets" }
  ];
  // usedBy lists the modules that read the value (module ids from the catalogue)
  const FIELDS = [
    { g: "project", key: "projectName", label: "Project name", type: "text", def: "Sample metro line (replace with project data)", usedBy: ["dc-traction-power", "rams", "tunnel-ventilation", "noise-vibration"] },
    { g: "project", key: "lineName", label: "Line / system", type: "text", def: "Line 1, driverless metro", usedBy: ["rams"] },
    { g: "project", key: "systemType", label: "System type", type: "select", options: ["Metro", "APM", "High-speed"], def: "Metro", usedBy: [] },
    { g: "operation", key: "hoursPerDay", label: "Operating hours per day", unit: "h", def: 20, usedBy: ["rams", "noise-vibration"] },
    { g: "operation", key: "daysPerYear", label: "Operating days per year", unit: "d", def: 365, usedBy: ["rams"] },
    { g: "operation", key: "headway", label: "Peak headway", unit: "s", def: 180, usedBy: ["dc-traction-power", "noise-vibration"] },
    { g: "operation", key: "trainsInService", label: "Trains in service (peak)", unit: "no.", def: 7, usedBy: ["rams"] },
    { g: "operation", key: "fleetSize", label: "Fleet size incl. spares", unit: "no.", def: 8, usedBy: ["rams"] },
    { g: "route", key: "routeLength", label: "Route length", unit: "km", def: 18.8, usedBy: [] },
    { g: "route", key: "stations", label: "Stations", unit: "no.", def: 16, usedBy: [] },
    { g: "stock", key: "carsPerTrain", label: "Cars per train", unit: "no.", def: 6, usedBy: ["dc-traction-power", "noise-vibration"] },
    { g: "stock", key: "trainLength", label: "Train length", unit: "m", def: 132, usedBy: ["dc-traction-power", "tunnel-ventilation", "noise-vibration"] },
    { g: "stock", key: "trainArea", label: "Train frontal area", unit: "m²", def: 9.8, usedBy: ["tunnel-ventilation"] },
    { g: "stock", key: "trainPerimeter", label: "Train perimeter", unit: "m", def: 13.2, usedBy: ["tunnel-ventilation"] },
    { g: "stock", key: "maxSpeed", label: "Maximum line speed", unit: "km/h", def: 80, usedBy: ["noise-vibration"] },
    { g: "power", key: "tractionSystem", label: "Traction supply", type: "text", def: "750 V DC third rail", usedBy: ["dc-traction-power"] },
    { g: "power", key: "tssCount", label: "Traction substations", unit: "no.", def: 8, usedBy: ["dc-traction-power", "rams"] },
    { g: "power", key: "tssRedundancy", label: "Substation redundancy", type: "select", options: ["N-1", "None"], def: "N-1", usedBy: ["rams"] },
    { g: "tunnel", key: "tunnelLength", label: "Tunnel section length", unit: "m", def: 1500, usedBy: ["tunnel-ventilation"] },
    { g: "tunnel", key: "tunnelArea", label: "Tunnel cross-section", unit: "m²", def: 22.1, usedBy: ["tunnel-ventilation"] },
    { g: "tunnel", key: "tunnelPerimeter", label: "Tunnel perimeter", unit: "m", def: 16.7, usedBy: ["tunnel-ventilation"] },
    { g: "tunnel", key: "tunnelHeight", label: "Tunnel height", unit: "m", def: 5.3, usedBy: ["tunnel-ventilation"] },
    { g: "tunnel", key: "tunnelGrade", label: "Tunnel gradient", unit: "%", def: -2, usedBy: ["tunnel-ventilation"] },
    { g: "env", key: "ambientTemp", label: "Ambient temperature", unit: "°C", def: 30, usedBy: ["tunnel-ventilation"] },
    { g: "env", key: "airDensity", label: "Air density", unit: "kg/m³", def: 1.16, usedBy: ["tunnel-ventilation"] },
    { g: "targets", key: "availabilityTarget", label: "Service availability target", unit: "%", def: 99.9, usedBy: ["rams"] },
    { g: "targets", key: "mtbsafTarget", label: "MTBSAF target", unit: "h", def: 300, usedBy: ["rams"] },
    { g: "targets", key: "designFire", label: "Design train fire", unit: "MW", def: 15, usedBy: ["tunnel-ventilation"] }
  ];
  const byKey = {}; FIELDS.forEach(f => (byKey[f.key] = f));

  /* ---------------- storage ---------------- */
  function read(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function defaults() { const o = {}; FIELDS.forEach(f => (o[f.key] = f.def)); return o; }
  function get() { const s = read(KEY_VALUES) || {}; const o = defaults(); Object.keys(s.values || {}).forEach(k => { if (k in byKey) o[k] = s.values[k]; }); return o; }
  function meta() { const s = read(KEY_VALUES) || {}; return { updated: s.updated || null, by: s.by || null, custom: !!s.values }; }
  function norm(f, v) { if (f.type === "text" || f.type === "select") return v == null ? "" : String(v); const x = parseFloat(v); return isFinite(x) ? x : ""; }
  function setMany(obj, by) {
    const cur = get(), changed = [];
    Object.keys(obj).forEach(k => { const f = byKey[k]; if (!f) return; const v = norm(f, obj[k]); if (v === "" && f.type !== "text") return; if (!same(cur[k], v)) { cur[k] = v; changed.push(k); } });
    if (changed.length) { write(KEY_VALUES, { values: cur, updated: Date.now(), by: by || "System page" }); emit({ type: "values", keys: changed }); }
    return changed;
  }
  function set(k, v, by) { const o = {}; o[k] = v; return setMany(o, by); }
  function reset() { try { localStorage.removeItem(KEY_VALUES); } catch (e) { /* ignore */ } emit({ type: "values", keys: FIELDS.map(f => f.key) }); }
  function same(a, b) { if (typeof a === "number" || typeof b === "number") { const x = parseFloat(a), y = parseFloat(b); return isFinite(x) && isFinite(y) ? Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)) : String(a) === String(b); } return String(a ?? "") === String(b ?? ""); }

  /* ---------------- results ---------------- */
  // summary: { status: "pass" | "fail" | "info", headline, metrics: [[label, value]], usedKeys: [...] }
  function publish(id, summary) {
    const all = read(KEY_RESULTS) || {}, vals = get(), snap = {};
    (summary.usedKeys || []).forEach(k => (snap[k] = vals[k]));
    all[id] = { status: summary.status || "info", headline: summary.headline || "", metrics: summary.metrics || [], snapshot: snap, at: Date.now() };
    write(KEY_RESULTS, all); emit({ type: "results", id });
  }
  function results() {
    const all = read(KEY_RESULTS) || {}, vals = get();
    Object.keys(all).forEach(id => { const r = all[id]; r.stale = Object.keys(r.snapshot || {}).filter(k => !same(r.snapshot[k], vals[k])); });
    return all;
  }

  /* ---------------- events (this page and other tabs) ---------------- */
  const listeners = [];
  function emit(d) { listeners.forEach(fn => { try { fn(d); } catch (e) { /* ignore */ } }); try { root.dispatchEvent(new CustomEvent(EVT, { detail: d })); } catch (e) { /* ignore */ } }
  function onChange(fn) { listeners.push(fn); }
  root.addEventListener("storage", e => { if (e.key === KEY_VALUES || e.key === KEY_RESULTS) emit({ type: e.key === KEY_VALUES ? "values" : "results", external: true }); });

  /* ---------------- "System link" bar for module pages ---------------- */
  // opts: { module, mount (element or selector), map: [{ key, get(), set(v) }], onApplied(), systemUrl }
  function mountBar(opts) {
    const host = typeof opts.mount === "string" ? document.querySelector(opts.mount) : opts.mount;
    if (!host) return null;
    if (!document.getElementById("rq-syslink-css")) {
      const st = document.createElement("style"); st.id = "rq-syslink-css";
      st.textContent =
        ".rq-sys{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:9px 12px;border:1px solid var(--rq-line,#c9cdc4);border-radius:8px;background:var(--rq-bg,rgba(29,108,136,.07));font:13px/1.4 var(--f-body,system-ui,sans-serif);color:inherit}" +
        ".rq-sys b{font-weight:600}.rq-sys .rq-tag{font:600 10.5px var(--f-mono,ui-monospace,monospace);letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:4px;background:#1d6c88;color:#fff}" +
        ".rq-sys .rq-diff{font-size:12.5px}.rq-sys .rq-diff.ok{color:var(--pass,#1e7a4a)}.rq-sys .rq-diff.no{color:var(--warn,#9a6200)}" +
        ".rq-sys .rq-sp{flex:1}.rq-sys button,.rq-sys a.rq-btn{font:inherit;font-size:12.5px;height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--rq-line,#b5bab0);background:var(--panel,#fff);color:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}" +
        ".rq-sys button:hover,.rq-sys a.rq-btn:hover{border-color:currentColor}.rq-sys details{flex-basis:100%;font-size:12.5px}.rq-sys summary{cursor:pointer;opacity:.75}" +
        ".rq-sys table{border-collapse:collapse;margin-top:6px;font-size:12.5px}.rq-sys td,.rq-sys th{padding:3px 10px 3px 0;text-align:left;border:0}.rq-sys th{font-weight:500;opacity:.65}.rq-sys tr.d td{color:var(--warn,#9a6200);font-weight:600}" +
        "@media print{.rq-sys{display:none}}";
      document.head.appendChild(st);
    }
    const bar = document.createElement("div"); bar.className = "rq-sys"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "System link");
    host.prepend(bar);
    const url = opts.systemUrl || "../../system.html";
    function rows() {
      const sys = get();
      return opts.map.map(m => { const f = byKey[m.key]; let mv; try { mv = m.get(); } catch (e) { mv = undefined; } return { m, f, sv: sys[m.key], mv, diff: mv !== undefined && mv !== null && mv !== "" && !same(mv, sys[m.key]) }; }).filter(r => r.f);
    }
    function fmt(v) { return v === undefined || v === null || v === "" ? "—" : typeof v === "number" ? Number(v).toLocaleString("en-GB", { maximumFractionDigits: 3 }) : String(v); }
    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
    function render() {
      const r = rows(), nd = r.filter(x => x.diff).length, sys = get();
      bar.innerHTML = '<span class="rq-tag">System</span><b>' + esc(sys.lineName || sys.projectName || "System") + "</b>" +
        '<span class="rq-diff ' + (nd ? "no" : "ok") + '">' + (nd ? nd + " of " + r.length + " linked values differ from the System" : "all " + r.length + " linked values match the System") + "</span>" +
        '<span class="rq-sp"></span><button type="button" data-rq="pull" title="Copy the System values into this module">Use System values</button>' +
        '<button type="button" data-rq="push" title="Copy this module\'s values to the System, so other modules can use them">Send to System</button>' +
        '<a class="rq-btn" href="' + esc(url) + '" target="_top">Open System-wide page</a>' +
        '<details><summary>Linked values</summary><table><tr><th>Parameter</th><th>System</th><th>This module</th></tr>' +
        r.map(x => '<tr class="' + (x.diff ? "d" : "") + '"><td>' + esc(x.f.label) + (x.f.unit ? " (" + esc(x.f.unit) + ")" : "") + "</td><td>" + esc(fmt(x.sv)) + "</td><td>" + esc(fmt(x.mv)) + "</td></tr>").join("") + "</table></details>";
    }
    bar.addEventListener("click", e => {
      const b = e.target.closest("[data-rq]"); if (!b) return;
      const r = rows();
      if (b.dataset.rq === "pull") {
        const todo = r.filter(x => x.sv !== undefined && x.sv !== "" && !same(x.mv, x.sv));
        todo.forEach(x => { try { x.m.set(x.sv); } catch (err) { console.warn("System link: could not set", x.m.key, err); } });
        if (opts.onApplied) opts.onApplied(todo.map(x => x.m.key));
        note(todo.length ? "Updated " + todo.length + " value" + (todo.length > 1 ? "s" : "") + " from the System" : "Already matches the System");
      } else {
        const o = {}; r.forEach(x => { if (x.mv !== undefined && x.mv !== null && x.mv !== "") o[x.m.key] = x.mv; });
        const ch = setMany(o, opts.module);
        note(ch.length ? "Sent " + ch.length + " value" + (ch.length > 1 ? "s" : "") + " to the System" : "The System already has these values");
      }
      render();
    });
    function note(msg) {
      let t = document.getElementById("rq-sys-note");
      if (!t) { t = document.createElement("div"); t.id = "rq-sys-note"; t.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#121820;color:#fff;padding:9px 16px;border-radius:8px;font:13.5px system-ui,sans-serif;z-index:9999"; document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false; clearTimeout(note._t); note._t = setTimeout(() => (t.hidden = true), 3000);
    }
    onChange(() => render());
    render();
    return { refresh: render };
  }

  root.RailIQSystem = { GROUPS, FIELDS, byKey, defaults, get, meta, set, setMany, reset, publish, results, onChange, mountBar, same };
})(window);

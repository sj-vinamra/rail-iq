/*
 * Rail-IQ Noise & Vibration engine (Phase 1, screening level)
 * ----------------------------------------------------------
 * Airborne train noise at wayside receptors (line source) and ground-borne
 * vibration / ground-borne noise, compared with criteria set per receptor.
 *
 * Noise
 *   SEL(d)  = SEL_ref + 10 log10(Ncars) + Kv log10(v / v_ref) + adj - Kd log10(d / d_ref) - IL_barrier
 *             (SEL_ref: one car at d_ref and v_ref; Kd = 10 hard ground, 15 soft ground)
 *   LAeq,T  = SEL + 10 log10(N) - 10 log10(T)          N pass-bys in T seconds
 *   Ldn     = 10 log10[(15 * 10^(Ld/10) + 9 * 10^((Ln + 10)/10)) / 24]
 *   Lmax    ~ SEL - 10 log10(train length / speed)      (approximate, receptor close to the track)
 *   Barrier (Maekawa): N = 2 delta / lambda at 500 Hz, IL = 10 log10(3 + 20 N), capped at 20 dB;
 *             IL = 0 when the barrier does not break the line of sight
 * Vibration
 *   Lv(d)   = Lv_ref + 20 log10(v / v_ref) + adj_track + adj_building - 20 n log10(d / d_ref) - 8.686 alpha (d - d_ref)
 *   L_GBN   = Lv - K_gbn                                (K_gbn = 50 typical, 35 low-frequency, 55 high-frequency)
 * All reference values are inputs; the defaults are placeholders for review.
 */
(function (root) {
  "use strict";
  const LOG = Math.log10, C_AIR = 343, F_REF = 500;
  const sum10 = arr => 10 * LOG(arr.reduce((a, x) => a + Math.pow(10, x / 10), 0));

  function selAt(m, d, barrierIL) {
    const s = m.source, t = m.traffic;
    return +s.selRef + 10 * LOG(Math.max(1, +t.cars)) + +s.kSpeed * LOG(+t.speed / +s.vRef) + (+s.adj || 0)
      - +m.site.kDist * LOG(d / +s.dRef) - (barrierIL || 0);
  }
  // pass-bys per hour, both directions
  const perHour = (headway, dirs) => (+headway > 0 ? (3600 / +headway) * Math.max(1, +dirs || 1) : 0);
  function levels(m, sel) {
    const t = m.traffic, nd = perHour(t.headwayDay, t.directions), nn = perHour(t.headwayNight, t.directions);
    const hd = Math.min(15, Math.max(0, +t.hoursDay)), hn = Math.min(9, Math.max(0, +t.hoursNight));
    const Nd = nd * hd, Nn = nn * hn;
    const Ld = Nd > 0 ? sel + 10 * LOG(Nd) - 10 * LOG(15 * 3600) : -Infinity;
    const Ln = Nn > 0 ? sel + 10 * LOG(Nn) - 10 * LOG(9 * 3600) : -Infinity;
    const Ldn = 10 * LOG((15 * Math.pow(10, Ld / 10) + 9 * Math.pow(10, (Ln + 10) / 10)) / 24);
    const Lpeak = nd > 0 ? sel + 10 * LOG(nd) - 10 * LOG(3600) : -Infinity;
    const Lmax = sel - 10 * LOG(Math.max(0.5, +t.trainLength / (+t.speed / 3.6)));
    return { Ld, Ln, Ldn, Lpeak, Lmax, Nd, Nn };
  }

  /** Maekawa barrier insertion loss for a 2D section: source at x = 0, barrier at xb, receiver at xr */
  function barrier(hs, xb, hb, xr, hr) {
    if (!(xb > 0 && xr > xb)) return { IL: 0, delta: 0, blocked: false, N: 0 };
    const sight = hs + ((hr - hs) * xb) / xr;
    const a = Math.hypot(xb, hb - hs), b = Math.hypot(xr - xb, hb - hr), c = Math.hypot(xr, hr - hs);
    const delta = a + b - c, blocked = hb > sight;
    if (!blocked) return { IL: 0, delta, blocked, N: 0 };
    const N = (2 * delta) / (C_AIR / F_REF);
    return { IL: Math.min(20, 10 * LOG(3 + 20 * N)), delta, blocked, N };
  }

  function vibAt(m, d, adjBuilding) {
    const v = m.vib, t = m.traffic;
    return +v.lvRef + 20 * LOG(+t.speed / +v.vRef) + (+v.adjTrack || 0) + (adjBuilding || 0)
      - 20 * +v.n * LOG(d / +v.dRef) - 8.686 * +v.alpha * (d - +v.dRef);
  }

  function noiseMetric(m, L) { return m.site.metric === "Lpeak" ? L.Lpeak : L.Ldn; }

  function evaluate(m) {
    const s = m.site, out = [];
    m.receptors.forEach(r => {
      const d = Math.max(1, +r.dist);
      const br = r.barrier ? barrier(+s.srcHeight, +s.barrierDist, +s.barrierHeight, d, +r.height) : { IL: 0, blocked: false, N: 0, delta: 0 };
      const sel = selAt(m, d, br.IL), L = levels(m, sel);
      const Lv = vibAt(m, d, +r.adjBuilding || 0), Lg = Lv - +m.vib.kGbn;
      const noise = noiseMetric(m, L);
      const okN = r.limNoise === "" || r.limNoise == null ? null : noise <= +r.limNoise + 1e-9;
      const okV = r.limVib === "" || r.limVib == null ? null : Lv <= +r.limVib + 1e-9;
      const okG = r.limGbn === "" || r.limGbn == null ? null : Lg <= +r.limGbn + 1e-9;
      const checks = [okN, okV, okG].filter(x => x != null);
      out.push({ r, d, br, sel, L, noise, Lv, Lg, okN, okV, okG, pass: checks.length ? checks.every(Boolean) : null });
    });
    return out;
  }

  /** distance (m) at which a level falls to a limit, by bisection on a decreasing function */
  function distanceTo(fn, limit, dMin, dMax) {
    let lo = dMin || 1, hi = dMax || 5000;
    if (fn(lo) <= limit) return lo;
    if (fn(hi) > limit) return Infinity;
    for (let i = 0; i < 100; i++) { const mid = Math.sqrt(lo * hi); if (fn(mid) > limit) lo = mid; else hi = mid; }
    return hi;
  }
  function screening(m, limNoise, limVib) {
    const dn = limNoise === "" || limNoise == null ? null : distanceTo(d => noiseMetric(m, levels(m, selAt(m, d, 0))), +limNoise);
    const dv = limVib === "" || limVib == null ? null : distanceTo(d => vibAt(m, d, 0), +limVib);
    return { noise: dn, vib: dv };
  }

  const API = { sum10, selAt, perHour, levels, barrier, vibAt, noiseMetric, evaluate, distanceTo, screening };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.NV = API;
})(typeof window !== "undefined" ? window : globalThis);

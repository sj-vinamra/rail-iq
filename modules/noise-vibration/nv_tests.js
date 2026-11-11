/* Rail-IQ Noise & Vibration — verification cases (engine vs independent calculation). */
(function (root) {
  "use strict";
  const NV = root.NV, LOG = Math.log10;
  const close = (a, b, tol) => (isFinite(a) && isFinite(b) ? Math.abs(a - b) <= tol : a === b);

  function base() {
    return {
      traffic: { speed: 80, cars: 6, trainLength: 120, headwayDay: 180, headwayNight: 600, hoursDay: 15, hoursNight: 4, directions: 2 },
      source: { selRef: 82, dRef: 15, vRef: 80, kSpeed: 20, adj: 0 },
      site: { kDist: 10, metric: "Ldn", srcHeight: 0.5, barrierDist: 4, barrierHeight: 3 },
      vib: { lvRef: 80, dRef: 15, vRef: 80, n: 0.5, alpha: 0.01, adjTrack: 0, kGbn: 50 },
      receptors: []
    };
  }

  function run() {
    const out = [];
    const add = (group, name, expected, got, tol, how) => out.push({ group, name, expected, got, pass: close(expected, got, tol), how });
    const m = base();

    // 1 source term
    add("Source", "SEL at reference distance, 6 cars, 80 km/h = 82 + 10 log 6", 82 + 10 * LOG(6), NV.selAt(m, 15, 0), 1e-12, "closed form");
    add("Source", "Doubling speed adds 20 log 2 = 6.02 dB", 20 * LOG(2), NV.selAt({ ...m, traffic: { ...m.traffic, speed: 160 } }, 15, 0) - NV.selAt(m, 15, 0), 1e-12, "closed form");
    add("Propagation", "Line source, hard ground: -3.01 dB per doubling of distance", -10 * LOG(2), NV.selAt(m, 30, 0) - NV.selAt(m, 15, 0), 1e-12, "closed form");

    // 2 LAeq from SEL by explicit energy sum of every pass-by
    {
      const sel = 90, L = NV.levels(m, sel), nPerHour = (3600 / 180) * 2;
      const events = Array(nPerHour).fill(sel);
      add("Event to LAeq", "Peak-hour LAeq = energy sum of 40 pass-bys / 3600 s", NV.sum10(events) - 10 * LOG(3600), L.Lpeak, 1e-9, "explicit energy sum");
      // Ldn by hour-by-hour 24 h energy average with the 10 dB night penalty
      const hours = [];
      for (let h = 0; h < 24; h++) {
        const day = h >= 7 && h < 22;
        const inDay = day && h < 7 + 15, inNight = !day && ((h >= 22) || h < 2);     // 4 night service hours: 22, 23, 0, 1
        const n = inDay ? 40 : inNight ? (3600 / 600) * 2 : 0;
        hours.push(n ? sel + 10 * LOG(n) - 10 * LOG(3600) + (day ? 0 : 10) : -Infinity);
      }
      add("Event to LAeq", "Ldn = 24 h energy average, night +10 dB", NV.sum10(hours) - 10 * LOG(24), L.Ldn, 1e-9, "hour-by-hour sum");
    }
    // 3 barrier (Maekawa)
    {
      const b = NV.barrier(0.5, 4, 3, 30, 1.5);
      const a = Math.hypot(4, 2.5), c = Math.hypot(26, 1.5), dd = Math.hypot(30, 1);
      add("Barrier", "Path difference delta", a + c - dd, b.delta, 1e-12, "geometry");
      add("Barrier", "Insertion loss 10 log(3 + 20 N), N = 2 delta / lambda", 10 * LOG(3 + 20 * (2 * (a + c - dd) / (343 / 500))), b.IL, 1e-12, "Maekawa");
      add("Barrier", "No loss when the barrier is below the line of sight", 0, NV.barrier(0.5, 4, 0.6, 30, 10).IL, 0, "geometry");
    }
    // 4 vibration
    {
      add("Vibration", "Lv at reference distance and speed = Lv_ref", 80, NV.vibAt(m, 15, 0), 1e-12, "definition");
      const d = 60, exp = 80 - 20 * 0.5 * LOG(60 / 15) - 8.686 * 0.01 * (60 - 15);
      add("Vibration", "Geometric spreading plus material damping at 60 m", exp, NV.vibAt(m, d, 0), 1e-12, "Bornitz form");
    }
    // 5 screening distance is the inverse of the level calculation
    {
      const lim = 60, d = NV.screening(m, lim, null).noise;
      add("Screening", "Level at the screening distance equals the limit", lim, NV.levels(m, NV.selAt(m, d, 0)).Ldn, 1e-6, "inverse check");
    }
    return out;
  }
  root.NV_TESTS = { run };
})(typeof window !== "undefined" ? window : globalThis);

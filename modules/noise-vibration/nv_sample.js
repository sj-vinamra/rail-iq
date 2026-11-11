/* Rail-IQ Noise & Vibration — sample model.
   ILLUSTRATIVE VALUES ONLY. Reference levels and criteria are placeholders that must be
   checked by an acoustic specialist against FTA (2018), project measurements or the
   client's criteria before any use. */
window.NV_SAMPLE = function () {
  return {
    version: 1,
    project: { name: "Sample metro line (replace with project data)", docRef: "NV-SIM-001", section: "At-grade section, ch 4+200 to 5+100" },
    traffic: { speed: 80, cars: 6, trainLength: 132, headwayDay: 180, headwayNight: 480, hoursDay: 15, hoursNight: 5, directions: 2 },
    source: { selRef: 82, dRef: 15, vRef: 80, kSpeed: 20, adj: 0, adjPreset: "ballast" },
    site: { kDist: 15, metric: "Ldn", srcHeight: 0.5, barrierDist: 4, barrierHeight: 3 },
    vib: { lvRef: 80, dRef: 15, vRef: 80, n: 0.5, alpha: 0.01, adjTrack: 0, kGbn: 50 },
    receptors: [
      { name: "R1 Residential block", dist: 25, height: 4.5, barrier: false, adjBuilding: -5, limNoise: 65, limVib: 72, limGbn: 35 },
      { name: "R2 Residential with barrier", dist: 25, height: 4.5, barrier: true, adjBuilding: -5, limNoise: 65, limVib: 72, limGbn: 35 },
      { name: "R3 School", dist: 45, height: 1.5, barrier: false, adjBuilding: -5, limNoise: 60, limVib: 75, limGbn: 40 },
      { name: "R4 Hospital", dist: 70, height: 7.5, barrier: false, adjBuilding: -10, limNoise: 55, limVib: 72, limGbn: 35 },
      { name: "R5 Office", dist: 15, height: 1.5, barrier: false, adjBuilding: -5, limNoise: 70, limVib: 84, limGbn: 43 }
    ],
    selected: 1
  };
};

/*
 * Rail-IQ module registry
 * -----------------------
 * Every simulator shown on the portal is one entry here. The home page, filters,
 * search, command palette and the workspace switcher are all built from this list,
 * so adding a new simulator = drop its folder in /modules and add one entry below.
 *
 * Fields
 *   id          unique slug, also used in workspace.html?m=<id>
 *   title       display name
 *   summary     one line for the card
 *   description longer text for the detail drawer
 *   domains     any of: metro, apm, hsr
 *   discipline  railway system key from RAILIQ_SYSTEMS (power, telecom, atc, ...)
 *   subsystem   group inside that system (one of the system's subsystems)
 *   status      live | beta | planned
 *   entry       path to the module's HTML, relative to the site root (live/beta only)
 *   version     module revision shown on the card
 *   updated     ISO date of last update
 *   standards   reference standards covered
 *   features    bullet list for the detail drawer
 *   outputs     what the module produces
 *   resources   extra links [{label, href}] (relative to site root)
 */
// Railway types Rail-IQ covers for now
window.RAILIQ_DOMAINS = {
  metro: { label: "Metro",      color: "var(--l-metro)" },
  apm:   { label: "APM",        color: "var(--l-apm)" },
  hsr:   { label: "High-speed", color: "var(--l-hsr)" }
};

// Railway systems; each has its own page listing only its simulators, grouped by subsystem
window.RAILIQ_SYSTEMS = {
  power:      { label: "Power Supply", icon: "bolt", blurb: "Traction power and HV supply for DC 750 V / 1500 V and AC 25 kV railways.",
                subsystems: ["DC traction (750 V / 1500 V)", "AC traction (25 kV)", "HV network & catenary"] },
  telecom:    { label: "Telecom", icon: "antenna", blurb: "Onboard and wayside communications: radio, CCTV, PA / PIDS and data networks.",
                subsystems: ["Onboard telecom", "Radio & wayside"] },
  rams:       { label: "RAMS & Assurance", icon: "shield", blurb: "Reliability, availability and failure-mode analysis for the whole system.",
                subsystems: ["Reliability & availability"] },
  nv:         { label: "Noise & Vibration", icon: "wave", blurb: "Wayside noise, ground-borne vibration and ground-borne noise.",
                subsystems: ["Wayside noise & vibration"] },
  operations: { label: "Operations", icon: "clock", blurb: "Running time, energy, timetable and fleet.",
                subsystems: ["Running time & energy", "Timetable & fleet"] },
  atc:        { label: "ATC & Signalling", icon: "signal", blurb: "Automatic train control and signalling: CBTC, headway and line capacity.",
                subsystems: ["CBTC / ATC"] },
  tvs:        { label: "Tunnel Ventilation & E&M", icon: "station", blurb: "Tunnel ventilation, smoke control and station evacuation.",
                subsystems: ["Tunnel ventilation", "Stations & evacuation"] }
};
// every system, including ones with no working simulator yet (the home page shows them as "Coming soon")
window.RAILIQ_SYSTEMS_ALL = JSON.parse(JSON.stringify(window.RAILIQ_SYSTEMS));
window.RAILIQ_DISCIPLINES = window.RAILIQ_SYSTEMS; // older name, still used by some pages

window.RAILIQ_CATALOG = [
  {
    id: "dc-traction-power",
    title: "DC Traction Power Model",
    summary: "Second-by-second DC load flow, TSS sizing, short circuit, harmonics and EMC on the real alignment.",
    description:
      "Runs every train on the real alignment, builds the timetable on any number of UP / DOWN tracks and solves the nodal DC network each second through every traction substation. Checks ratings against rolling RMS windows, scans short-circuit cases, evaluates rectifier harmonics and rail potential / stray current, and repeats the design check over every single-TSS outage. The HTML model and the Python model share one engine and give the same numbers.",
    domains: ["metro", "apm"],
    discipline: "power",
    subsystem: "DC traction (750 V / 1500 V)",
    status: "live",
    entry: "modules/dc-traction-power/DC_Traction_Power_Model.html",
    version: "2026.10",
    updated: "2026-10-20",
    standards: ["EN 50163", "EN 50122-1", "EN 50122-2", "IEC 60909", "IEC 61000-3-6"],
    features: [
      "Train run on a 5 m grid: braking curve, effort limits, Davis + gradient + curve resistance",
      "Timetable on any number of UP / DOWN tracks, skip-stop patterns, several train types",
      "Nodal load flow each second with diode TSS, inverters, regen limit and low-voltage cut-back",
      "Equipment sizing with next standard size, 1-min / 15-min / 1-h RMS duty checks",
      "Short circuit: sustained current, di/dt, time to trip, AC fault levels",
      "Harmonics vs IEC limits, rail potential, stray current, magnetic field, telecom noise",
      "Reads Word train data (tables, charts, graph images) and Excel alignment",
      "Design check over every single-TSS outage; Word / PDF / Excel reports"
    ],
    outputs: ["Line schematic", "Train graph", "TSS currents", "Voltage envelope", "Sizing table", "Pass / fail list", "Word + PDF reports", "Excel workbook"],
    resources: [
      { label: "Module README", href: "modules/dc-traction-power/README.md" },
      { label: "Alignment template (.xlsx)", href: "modules/dc-traction-power/samples/Alignment_Template.xlsx" },
      { label: "Train data template (.docx)", href: "modules/dc-traction-power/samples/Train_Data_Template.docx" },
      { label: "Python engine", href: "modules/dc-traction-power/python/tps_model.py" }
    ]
  },
  {
    id: "apm-onboard-telecom",
    title: "APM Onboard Telecom Layout",
    summary: "Interactive 3D vehicle with onboard telecom equipment, wayside bearers and CCTV coverage.",
    description:
      "A three-dimensional, three-car APM consist showing where every onboard telecom item sits and how the train talks to the wayside. Switch between exterior, cutaway, walk-inside and roof views; compare 5.8 GHz, private LTE and TETRA bearers with their coverage; overlay the signal flow and CCTV camera coverage while the train runs.",
    domains: ["apm"],
    discipline: "telecom",
    subsystem: "Onboard telecom",
    status: "live",
    entry: "modules/apm-onboard-telecom/index.html",
    version: "Rev 16",
    updated: "2026-09-23",
    standards: [],
    features: [
      "3D consist with exterior, cutaway, walk-inside and roof views",
      "Train-to-wayside bearers: 5.8 GHz, private LTE and TETRA with coverage",
      "Wayside coverage view with the train running at adjustable speed",
      "Signal-flow overlay between onboard systems",
      "CCTV camera coverage overlay",
      "Equipment by system: CCTV, PA, PIDS, network, radio, power, racks"
    ],
    outputs: ["3D layout", "Bearer coverage", "Signal flow", "CCTV coverage"],
    resources: []
  },

  /* ---------------- pipeline ---------------- */
  {
    id: "ac-traction-power",
    title: "AC 25 kV Traction Power",
    summary: "Autotransformer and booster-transformer feeding, neutral sections, unbalance at the grid.",
    description: "Load flow for 1×25 kV and 2×25 kV feeding with autotransformers, phase unbalance at the point of common coupling, neutral-section placement and feeder-station sizing for mainline and high-speed corridors.",
    domains: ["hsr", "metro"],
    discipline: "power",
    subsystem: "AC traction (25 kV)",
    status: "planned",
    standards: ["EN 50163", "EN 50388", "IEC 61000-3-13"],
    features: ["2×25 kV AT network solver", "Voltage unbalance at PCC", "Neutral-section and feeder-station layout"],
    outputs: ["Pantograph voltage", "Transformer loading", "Unbalance factor"]
  },
  {
    id: "train-performance",
    title: "Train Performance & Running Time",
    summary: "Run-time, energy and speed profile for any rolling stock on any alignment.",
    description: "Stand-alone running-time calculator built on the Rail-IQ train-run engine: flat-out and coasting strategies, energy per run, regenerated energy and sensitivity to dwell and speed limits.",
    domains: ["metro", "apm", "hsr"],
    discipline: "operations",
    subsystem: "Running time & energy",
    status: "planned",
    standards: ["EN 15528", "UIC 544-1"],
    features: ["Coasting / eco-driving strategies", "Energy per run and per passenger-km", "Dwell sensitivity"],
    outputs: ["Speed-distance", "Run-time table", "Energy breakdown"]
  },
  {
    id: "cbtc-headway",
    title: "CBTC Headway & Capacity",
    summary: "Safe-braking-model headway, turnback capacity and line throughput.",
    description: "Computes the minimum headway from the safe braking model, station dwell and turnback layout, and turns it into line capacity in trains and passengers per hour per direction.",
    domains: ["metro", "apm"],
    discipline: "atc",
    subsystem: "CBTC / ATC",
    status: "planned",
    standards: ["IEEE 1474.1", "IEC 62290"],
    features: ["Safe braking model", "Station and turnback headway", "PPHPD capacity"],
    outputs: ["Headway diagram", "Blocking times", "Capacity table"]
  },
  {
    id: "radio-coverage",
    title: "Radio Coverage & Link Budget",
    summary: "LTE / TETRA / Wi-Fi link budget and handover zones along the alignment.",
    description: "Link budget along the route for trackside radio — site spacing, tunnel leaky feeder, handover overlap and redundancy for train-to-ground communication.",
    domains: ["metro", "apm", "hsr"],
    discipline: "telecom",
    subsystem: "Radio & wayside",
    status: "planned",
    standards: ["3GPP TS 36.101", "ETSI EN 300 392"],
    features: ["Free-space, tunnel and urban path loss", "Leaky-feeder budget", "Handover overlap check"],
    outputs: ["Coverage profile", "Site list", "Margin table"]
  },
  {
    id: "timetable-fleet",
    title: "Timetable & Fleet Sizing",
    summary: "Service pattern, cycle time and the fleet needed to run it, with depot reserve.",
    description: "Builds a service pattern from demand and headway, computes round-trip cycle time and the fleet including maintenance reserve and operating spares.",
    domains: ["metro", "apm", "hsr"],
    discipline: "operations",
    subsystem: "Timetable & fleet",
    status: "planned",
    standards: [],
    features: ["Peak / off-peak patterns", "Cycle and layover time", "Maintenance reserve"],
    outputs: ["Time-distance graph", "Fleet requirement"]
  },
  {
    id: "hv-catenary",
    title: "HV Network & Catenary",
    summary: "HV power distribution and overhead catenary: cable sizing, voltage drop, protection and OCS checks.",
    description: "HV ring network load flow and cable sizing from the bulk supply points to the traction and station substations, short-circuit levels and protection grading, and overhead catenary checks for span, tension and wire wear.",
    domains: ["hsr", "metro"],
    discipline: "power",
    subsystem: "HV network & catenary",
    status: "planned",
    standards: ["IEC 60909", "EN 50119", "EN 50122-1"],
    features: ["HV ring network load flow and cable sizing", "Short-circuit levels and protection grading", "Catenary span, tension and wire wear checks"],
    outputs: ["Network diagram", "Cable schedule", "Protection settings", "OCS check list"]
  },
  {
    id: "passenger-flow",
    title: "Station Passenger Flow & Egress",
    summary: "Platform clearance and evacuation times against NFPA 130.",
    description: "Platform clearance and point-of-safety times for station evacuation, with stair, escalator and fare-gate capacities.",
    domains: ["metro", "apm", "hsr"],
    discipline: "tvs",
    subsystem: "Stations & evacuation",
    status: "planned",
    standards: ["NFPA 130"],
    features: ["4-minute platform clearance", "6-minute point of safety", "Element capacities"],
    outputs: ["Egress timeline", "Bottleneck list"]
  },
  {
    id: "tunnel-ventilation",
    title: "Tunnel Ventilation",
    summary: "Tunnel airflow from jet fans and station fan plants, critical velocity for train fires, fan sizing and the largest controllable fire.",
    description: "Phase 1 longitudinal ventilation model of one tunnel bore. Solves the steady pressure balance of jet fans, end fan plants on their fan curves (with shaft and damper losses), portal pressure and fire buoyancy against tunnel friction, local losses and a stalled train's annulus. Checks each scenario against the critical velocity (Kennedy / NFPA 502 or Li & Ingason) with a design margin, sizes jet fans and end fan combinations, and finds the largest fire the fans can control. Beta: for early sizing and checks; not a replacement for SES or CFD.",
    domains: ["metro", "hsr"],
    discipline: "tvs",
    subsystem: "Tunnel ventilation",
    status: "beta",
    entry: "modules/tunnel-ventilation/index.html",
    version: "Phase 1 (beta)",
    updated: "2026-10-21",
    standards: ["NFPA 130", "NFPA 502", "PIARC"],
    features: [
      "Steady 1D pressure balance: tunnel friction, entry/exit and local losses, stalled-train annulus",
      "Jet fans with installation efficiency; end fan plants on fan curves with shaft & damper loss",
      "Portal (wind) pressure and fire buoyancy on the gradient",
      "Critical velocity: Kennedy (NFPA 502 / 130) with grade factor, or Li & Ingason",
      "Scenario table with fan failures, required smoke direction and design margin",
      "Fan sizing: minimum jet fans and end-fan combinations for a fire scenario",
      "Largest fire the selected fans can control",
      "Verification tab: solver checked against closed-form solutions and a second root finder"
    ],
    outputs: ["Scenario pass/fail table", "Tunnel schematic", "Pressure balance", "Fan and tunnel curves", "Fire-size chart", "Sizing tables", "Excel workbook", "PDF report"],
    resources: []
  },
  {
    id: "rams",
    title: "RAMS & Availability",
    summary: "Service availability, MTBSAF and target allocation from an equipment list with k-out-of-n redundancy, plus an FMECA register.",
    description: "Phase 1 RAM model. Builds the system as subsystems in series, each made of items with k-out-of-n redundancy and independent repair, and computes steady-state availability, MTBSAF, equivalent MTTR, downtime per year and mission reliability for service-affecting failures. Allocates system targets to subsystems (equal, ARINC or weighted), ranks the largest contributors to downtime and keeps an FMECA register with RPN and a severity × occurrence matrix. A built-in verification tab checks the engine against closed-form results and brute-force state enumeration. Beta: results to be reviewed by a RAM engineer before use in a submission.",
    domains: ["metro", "apm", "hsr"],
    discipline: "rams",
    subsystem: "Reliability & availability",
    status: "beta",
    entry: "modules/rams/index.html",
    version: "Phase 1 (beta)",
    updated: "2026-10-20",
    standards: ["EN 50126-1", "EN 50126-2", "IEC 61078", "IEC 60812"],
    features: [
      "Equipment table: quantity, units required (k-out-of-n), MTBF, MTTR, service-affecting flag",
      "System availability, MTBSAF, equivalent MTTR, downtime per year, failures per year",
      "Reliability block diagram drawn from the equipment table",
      "Target allocation to subsystems: equal, ARINC or weighted",
      "Largest contributors to downtime and mission reliability curve",
      "FMECA register with RPN, action flag and severity × occurrence matrix",
      "Excel template import / export, JSON inputs, printable report",
      "Verification tab: engine checked against closed-form and brute-force results"
    ],
    outputs: ["Availability roll-up", "Allocation table", "Block diagram", "Pareto of contributors", "FMECA summary", "Excel workbook", "PDF report"],
    resources: []
  },
  {
    id: "noise-vibration",
    title: "Noise & Vibration",
    summary: "Screening of train noise and ground-borne vibration at wayside receptors, with barriers and distances to criteria.",
    description: "Phase 1 screening model. Train pass-by noise from a per-car reference level with speed, number of cars, track and distance terms, period levels (Ld, Ln, Ldn, peak-hour LAeq) from the timetable, Maekawa barrier loss, and ground-borne vibration and ground-borne noise at each receptor against its own criteria. Shows level against distance, the distance at which each criterion is met, and a cross-section to each receptor. Beta: reference levels and criteria are placeholders to be reviewed by an acoustic specialist.",
    domains: ["metro", "apm", "hsr"],
    discipline: "nv",
    subsystem: "Wayside noise & vibration",
    status: "beta",
    entry: "modules/noise-vibration/index.html",
    version: "Phase 1 (beta)",
    updated: "2026-10-22",
    standards: ["FTA 2018", "ISO 3095", "ISO 9613-2"],
    features: [
      "Pass-by SEL with speed, cars, track / structure and ground terms",
      "Ld, Ln, Ldn and peak-hour LAeq from day and night headways",
      "Noise barrier insertion loss (Maekawa) with cross-section view",
      "Ground-borne vibration and ground-borne noise per receptor",
      "Distance at which each criterion is met (screening distance)",
      "Linked to the System: speed, cars, train length, headway, operating hours",
      "Verification tab: engine checked against independent calculations"
    ],
    outputs: ["Receptor table", "Level against distance", "Cross-section", "Screening distances", "Excel workbook"],
    resources: []
  }
];

/*
 * Pipeline visibility
 * -------------------
 * false = the portal shows only simulators that can be opened (live or beta); planned ones,
 *         and any system or sub-system left with nothing to open, are hidden everywhere.
 * true  = planned simulators are shown again as "Pipeline" cards.
 */
window.RAILIQ_SHOW_PIPELINE = false;

window.RAILIQ_CATALOG_ALL = window.RAILIQ_CATALOG;
if (!window.RAILIQ_SHOW_PIPELINE) {
  window.RAILIQ_CATALOG = window.RAILIQ_CATALOG_ALL.filter(function (m) { return m.entry && (m.status === "live" || m.status === "beta"); });
  Object.keys(window.RAILIQ_SYSTEMS).forEach(function (k) {
    var mine = window.RAILIQ_CATALOG.filter(function (m) { return m.discipline === k; });
    if (!mine.length) { delete window.RAILIQ_SYSTEMS[k]; return; }
    var s = window.RAILIQ_SYSTEMS[k];
    s.subsystems = (s.subsystems || []).filter(function (sub) { return mine.some(function (m) { return m.subsystem === sub; }); });
  });
}

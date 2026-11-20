/*
 * Sample models for the RAMS Workbench, based on P2427 HSR (Dubai section, MEP-P2427).
 * Project-sourced: safety-function IDs (SIL Determination Worksheet), SBS codes and λ(SAF) budgets
 *   (RAM Analysis Workbook RP-00027-AA, MEP-P2427 sub-allocation, draft), availability / MTBSAF targets (draft, TQ-07),
 *   19 h operating day, MALDT 0.25 h control room / 1 h trackside (Annex 2 §4.10.9), redundancy from the FMECA RP-00026-AA.
 * NOT project data: every failure rate, MTTR and proof-test interval is an illustrative generic value
 *   (no failure data at DCP1). Replace with NPRD / FMD / supplier data before any use in a deliverable.
 */
(function (root) {
  "use strict";
  const ILL = "Illustrative generic value – replace with NPRD/FMD/supplier data (no failure data at DCP1)";

  const ftTVS = {
    name: "SF_MEP_015 – TVS fire-mode ventilation",
    desc: "Loss of tunnel ventilation fire mode for the incident section (smoke-free evacuation route). P2427 safety function SF_MEP_015; chain: OCC/ICMS request → TICS logic solver → shaft I/O → shaft fans and dampers, with dual LV supply.",
    top: "TOP",
    missionTime: 8760,
    thr: 1e-6,
    thrNote: "Assumed SIL 2 (THR < 1E-06 /h, EN 50126-2 Table 2) – confirm from the SIL Determination Report",
    gates: [
      { id: "TOP", type: "or", desc: "TVS fails to provide fire-mode airflow for the incident tunnel section (SF_MEP_015)", inputs: ["G_CMD", "G_FAN", "G_PATH", "G_PWR"] },
      { id: "G_CMD", type: "or", desc: "Fire-mode command does not reach the shaft", inputs: ["G_TICS", "G_NET", "IO_SHAFT", "ICMS_REQ"] },
      { id: "G_TICS", type: "and", desc: "Both TICS logic solvers (hot-standby pair) fail", inputs: ["TICS_A", "TICS_B"] },
      { id: "G_NET", type: "and", desc: "Both fibre paths to the shaft lost (dual ring)", inputs: ["FIB_A", "FIB_B"] },
      { id: "G_FAN", type: "vote", k: 2, desc: "Two or more of the three shaft fan trains unavailable (N+1, 2 of 3 needed)", inputs: ["G_F1", "G_F2", "G_F3"] },
      { id: "G_F1", type: "or", desc: "Fan train 1 unavailable", inputs: ["FAN1", "VFD1"] },
      { id: "G_F2", type: "or", desc: "Fan train 2 unavailable", inputs: ["FAN2", "VFD2"] },
      { id: "G_F3", type: "or", desc: "Fan train 3 unavailable", inputs: ["FAN3", "VFD3"] },
      { id: "G_PATH", type: "or", desc: "Fire-mode airflow path blocked by a damper", inputs: ["DMP1", "DMP2"] },
      { id: "G_PWR", type: "and", desc: "Both LV supplies to the TVS lost (Essential and Very Essential)", inputs: ["ESS", "VESS"] }
    ],
    events: [
      { id: "TICS_A", desc: "TICS logic solver CPU A fails", model: "repair", lambda: 2e-5, mdt: 1.25, ccf: "TICS", ref: "FM-005" },
      { id: "TICS_B", desc: "TICS logic solver CPU B fails", model: "repair", lambda: 2e-5, mdt: 1.25, ccf: "TICS", ref: "FM-005" },
      { id: "FIB_A", desc: "Fibre path A to the shaft lost", model: "repair", lambda: 1e-5, mdt: 3, ccf: "RING", ref: "FM-006" },
      { id: "FIB_B", desc: "Fibre path B to the shaft lost", model: "repair", lambda: 1e-5, mdt: 3, ccf: "RING", ref: "FM-006" },
      { id: "IO_SHAFT", desc: "Shaft remote I/O fails without alarm (dangerous undetected)", model: "dormant", lambda: 5e-6, ti: 720, mdt: 2, ref: "FM-049" },
      { id: "ICMS_REQ", desc: "OCC/ICMS fire-mode request not delivered (interface SF_ICMS_002, P2428)", model: "repair", lambda: 1e-6, mdt: 1.25, ref: "Interface" },
      { id: "FAN1", desc: "Shaft fan 1 fails to start on demand", model: "dormant", lambda: 1e-5, ti: 720, mdt: 9, ccf: "FANS", ref: "FM-001" },
      { id: "FAN2", desc: "Shaft fan 2 fails to start on demand", model: "dormant", lambda: 1e-5, ti: 720, mdt: 9, ccf: "FANS", ref: "FM-001" },
      { id: "FAN3", desc: "Shaft fan 3 fails to start on demand", model: "dormant", lambda: 1e-5, ti: 720, mdt: 9, ccf: "FANS", ref: "FM-001" },
      { id: "VFD1", desc: "VFD 1 trips or fails", model: "repair", lambda: 1.5e-5, mdt: 5, ref: "FM-003" },
      { id: "VFD2", desc: "VFD 2 trips or fails", model: "repair", lambda: 1.5e-5, mdt: 5, ref: "FM-003" },
      { id: "VFD3", desc: "VFD 3 trips or fails", model: "repair", lambda: 1.5e-5, mdt: 5, ref: "FM-003" },
      { id: "DMP1", desc: "Shaft motorised damper 1 fails closed", model: "dormant", lambda: 4e-6, ti: 720, mdt: 5, ref: "FM-004" },
      { id: "DMP2", desc: "Shaft motorised damper 2 fails closed", model: "dormant", lambda: 4e-6, ti: 720, mdt: 5, ref: "FM-004" },
      { id: "ESS", desc: "Essential LV supply to TVS lost", model: "repair", lambda: 8e-6, mdt: 3, ccf: "LVSUP", ref: "CM.0133" },
      { id: "VESS", desc: "Very Essential LV supply to TVS lost", model: "repair", lambda: 8e-6, mdt: 3, ccf: "LVSUP", ref: "CM.0133" }
    ],
    ccf: [
      { id: "TICS", beta: 0.05, desc: "Same hardware and software in both logic solvers" },
      { id: "RING", beta: 0.02, desc: "Fibre paths – shared routes at the shaft (CCF analysis)" },
      { id: "FANS", beta: 0.05, desc: "Identical fans, same environment and maintenance" },
      { id: "LVSUP", beta: 0.02, desc: "Two supplies from the same intake substation" }
    ]
  };

  const ftFire = {
    name: "SF_MEP_013/014 – Tunnel fire detection and alarm transmission",
    desc: "Failure to detect a tunnel fire or to transmit the alarm to OCC/ICMS. P2427 safety functions SF_MEP_013 (detection) and SF_MEP_014 (transmission).",
    top: "TOP",
    missionTime: 8760,
    thr: 1e-6,
    thrNote: "Assumed SIL 2 (THR < 1E-06 /h) – confirm from the SIL Determination Report",
    gates: [
      { id: "TOP", type: "or", desc: "Tunnel fire not detected, or alarm not transmitted to OCC (SF_MEP_013/014)", inputs: ["G_DET", "G_PANEL", "G_TX", "G_PSU"] },
      { id: "G_DET", type: "and", desc: "Both overlapping linear heat detection zones fail", inputs: ["LHD_A", "LHD_B"] },
      { id: "G_PANEL", type: "and", desc: "Both networked fire alarm panels fail", inputs: ["FACP_1", "FACP_2"] },
      { id: "G_TX", type: "and", desc: "Both transmission paths to ICMS fail (CCF-012)", inputs: ["IFU_A", "IFU_B"] },
      { id: "G_PSU", type: "and", desc: "Loss of panel power: mains and standby battery", inputs: ["MAINS", "BATT"] }
    ],
    events: [
      { id: "LHD_A", desc: "Linear heat detection zone A fails to detect", model: "dormant", lambda: 2e-6, ti: 4380, mdt: 4, ccf: "LHD", ref: "FM-011" },
      { id: "LHD_B", desc: "Linear heat detection zone B (overlap) fails to detect", model: "dormant", lambda: 2e-6, ti: 4380, mdt: 4, ccf: "LHD", ref: "FM-011" },
      { id: "FACP_1", desc: "Fire alarm control panel 1 fails", model: "repair", lambda: 1e-5, mdt: 1.25, ccf: "FACP", ref: "FM-014" },
      { id: "FACP_2", desc: "Fire alarm control panel 2 fails", model: "repair", lambda: 1e-5, mdt: 1.25, ccf: "FACP", ref: "FM-014" },
      { id: "IFU_A", desc: "Interface path A to ICMS fails", model: "repair", lambda: 5e-6, mdt: 1.25, ccf: "IFU", ref: "FM-015" },
      { id: "IFU_B", desc: "Interface path B to ICMS fails", model: "repair", lambda: 5e-6, mdt: 1.25, ccf: "IFU", ref: "FM-015" },
      { id: "MAINS", desc: "Panel mains supply lost", model: "repair", lambda: 2e-5, mdt: 2, ref: "CM.0291" },
      { id: "BATT", desc: "Panel standby battery fails (found at test)", model: "dormant", lambda: 3e-6, ti: 4380, mdt: 1.25, ref: "FM-026" }
    ],
    ccf: [
      { id: "LHD", beta: 0.1, desc: "Same detector cable type and environment" },
      { id: "FACP", beta: 0.05, desc: "Same panel hardware and firmware" },
      { id: "IFU", beta: 0.02, desc: "Dual independent paths (CCF-012)" }
    ]
  };

  let n = 0;
  // MALDT per Annex 2 §4.10.9: 0.25 h for control-room equipment (MDT 1.25 h here), 1 h for station / trackside equipment
  const B = (id, name, mtbf, mdt, qty, k, extra) => { const maldt = mdt <= 1.25 ? 0.25 : 1; return Object.assign({ type: "block", id, name, mtbf, mdt, maldt, mttr: +(mdt - maldt).toFixed(2), qty: qty || 1, k: k || qty || 1, saf: true, dist: "exp", ref: ILL }, extra || {}); };
  const S = (id, name, children, extra) => Object.assign({ type: "series", id, name, children }, extra || {});
  const rbdMEP = {
    name: "MEP-P2427 – service-affecting failures",
    desc: "P2427 MEP availability model: the 14 SBS systems of the MEP-P2427 sub-allocation in series, each with its redundancy from the FMECA. Budgets are the draft λ(SAF) sub-allocation; every failure rate is illustrative.",
    hoursPerYear: 19 * 365,
    missionTime: 19,
    targetA: 99.9945,
    targetMTBSAF: 31056,
    root: S("MEP", "MEP-P2427", [
      S("VAC", "Ventilation and Air Conditioning (S.22.1.5)", [
        B("TVSFAN", "Tunnel ventilation fan + VFD (N+1)", 40000, 9, 3, 2),
        B("TICS", "TICS logic solver (hot-standby pair)", 50000, 1.25, 2, 1),
        B("TICSNET", "TICS fibre ring paths", 100000, 3, 2, 1),
        B("SMKFAN", "Station smoke exhaust fans", 40000, 9, 4, 3),
        B("ERCOOL", "Equipment-room cooling unit (N+1)", 30000, 5.25, 2, 1)
      ], { lamBudget: 9.66e-6 }),
      S("FIRE", "Fire System (S.22.1.6)", [
        B("FACP", "Fire alarm control panel (networked)", 100000, 1.25, 2, 1),
        { type: "standby", id: "FPUMPS", name: "Fire pumps duty / standby", k: 1, children: [B("FP1", "Fire pump 1 (duty)", 20000, 9), B("FP2", "Fire pump 2 (standby)", 20000, 9)] },
        B("FMAIN", "Tunnel fire main fed from both ends", 200000, 25, 2, 1),
        B("FIFU", "Fire alarm interface unit to ICMS", 150000, 1.25, 2, 1)
      ], { lamBudget: 6.44e-6 }),
      S("LV", "LV Distribution (S.22.1.1)", [
        B("LVFDR", "Incoming LV feeders", 100000, 4, 2, 1),
        B("ATS", "Automatic transfer switch / bus coupler", 300000, 4),
        B("BUSBAR", "Main switchboard busbar sections", 1000000, 25, 2, 1)
      ], { lamBudget: 3.864e-6 }),
      S("EP", "Emergency Power (S.22.1.2)", [
        { type: "parallel", id: "EPSRC", name: "Emergency supply sources", children: [
          B("UPS", "UPS modules (N+1)", 50000, 4, 3, 2),
          B("GEN", "Standby generator (start found at monthly test)", 20000, 9, 1, 1, { dormant: true, ti: 720 })
        ] }
      ], { lamBudget: 2.576e-6 }),
      S("EL", "Emergency Lighting (S.22.1.4)", [B("CBS", "Central battery panels (interleaved circuits)", 80000, 2, 2, 1)], { lamBudget: 1.61e-6 }),
      S("NL", "Normal Lighting (S.22.1.3)", [B("LDB", "Lighting distribution boards (redundant supply)", 100000, 2, 2, 1)], { lamBudget: 9.66e-7 }),
      S("VT", "Vertical Transportation (S.22.1.7)", [
        B("LIFT", "Lifts (3 of 4 needed)", 3000, 5, 4, 3),
        B("ESC", "Escalators (4 of 6 needed)", 4000, 5, 6, 4)
      ], { lamBudget: 1.61e-6 }),
      S("HT", "Horizontal Transportation (S.22.1.8)", [B("TRAV", "Travelators", 5000, 5, 2, 1)], { lamBudget: 3.22e-7 }),
      S("BMS", "Building Management System (S.22.1.9)", [
        B("BMSSRV", "BMS servers (hot standby)", 40000, 1.25, 2, 1),
        B("BMSNET", "BMS fibre backbone", 100000, 3, 2, 1)
      ], { lamBudget: 1.932e-6 }),
      S("EB", "Earthing and Bonding (S.22.1.10)", [B("BOND", "Meshed bonding / parallel PEC", 1000000, 25, 2, 1)], { lamBudget: 3.22e-7 }),
      S("LPS", "Lightning Protection System (S.22.1.11)", [B("SPD", "Surge protective devices (no service effect until a surge)", 2000000, 4, 1, 1, { saf: false })], { lamBudget: 3.22e-7 }),
      S("WS", "Water Supply (S.22.1.12)", [B("BOOST", "Booster pumps duty / standby", 20000, 9, 2, 1)], { lamBudget: 9.66e-7 }),
      S("SEW", "Sewage (S.22.1.13)", [B("SEWP", "Sewage pumps duty / standby", 15000, 9, 2, 1)], { lamBudget: 3.22e-7 }),
      S("DRN", "Drainage pumping (S.20.6 / S.24.3)", [
        B("SUMP", "Sump pumps duty / standby", 15000, 9, 2, 1),
        { type: "parallel", id: "LEVEL", name: "Level sensing (diverse)", children: [
          B("LT", "Level transmitter", 100000, 2),
          B("FLOAT", "Independent high-level float (found at monthly test)", 200000, 2, 1, 1, { dormant: true, ti: 720 })
        ] }
      ], { lamBudget: 1.288e-6 })
    ])
  };

  const small = {
    name: "Blank fault tree",
    desc: "",
    top: "TOP", missionTime: 8760, thr: 1e-6,
    gates: [{ id: "TOP", type: "or", desc: "Top event", inputs: ["E1", "E2"] }],
    events: [{ id: "E1", desc: "Basic event 1", model: "repair", lambda: 1e-5, mdt: 4 }, { id: "E2", desc: "Basic event 2", model: "repair", lambda: 1e-5, mdt: 4 }],
    ccf: []
  };
  const smallRBD = { name: "Blank RBD", desc: "", hoursPerYear: 8760, missionTime: 24, targetA: 99.9, targetMTBSAF: 1000,
    root: S("SYS", "System", [B("B1", "Block 1", 10000, 4), B("B2", "Block 2 (1 of 2)", 10000, 4, 2, 1)]) };

  root.RailIQRWSamples = { ILL, fts: [ftTVS, ftFire], rbds: [rbdMEP], blankFT: small, blankRBD: smallRBD };
})(typeof window !== "undefined" ? window : globalThis);

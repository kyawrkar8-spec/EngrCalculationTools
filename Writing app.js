'use strict';

/* Simple kW/kWh solar sizing — Sigenergy style (no Ah, no DC bus voltage) */

function $(id) { return document.getElementById(id); }

function num(id) {
  var v = parseFloat($(id).value);
  return isFinite(v) ? v : 0;
}

function fmt(n, d) {
  if (d === undefined) d = 1;
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: d });
}

function rows(pairs) {
  return pairs.map(function (p) {
    var cls = p[2] ? 'row row-main' : 'row';
    return '<div class="' + cls + '"><span>' + p[0] + '</span><b>' + p[1] + '</b></div>';
  }).join('');
}

/* ---------- Tabs ---------- */
document.querySelectorAll('.tabbar button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.tabbar button').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    $(b.dataset.tab).classList.add('active');
  });
});

function goTab(id) {
  var b = document.querySelector('.tabbar button[data-tab="' + id + '"]');
  if (b) b.click();
}

/* ---------- Standards ---------- */
var BREAKER_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];
var TR_SIZES = [25, 50, 100, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];

/* Sigenergy SigenStor hybrid inverter ratings (kW) */
var SIGEN_INV = [3.6, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 48];
var SIGEN_MODULE_KWH = 8;

function nextStd(list, v) {
  for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i];
  return null;
}

/* ---------- Load list ---------- */
function loadRowData() {
  var out = [];
  document.querySelectorAll('#loadRows .load-row').forEach(function (r) {
    var name = (r.querySelector('.l-name').value || '').trim();
    var kw = parseFloat(r.querySelector('.l-kw').value) || 0;
    var qty = parseFloat(r.querySelector('.l-qty').value) || 0;
    var hr = parseFloat(r.querySelector('.l-hr').value) || 0;
    if (kw > 0 && qty > 0) {
      out.push({ name: name || ('Load ' + (out.length + 1)), kw: kw, qty: qty, hours: hr, peak: kw * qty, kwh: kw * qty * hr });
    }
  });
  return out;
}

function loadTotals() {
  var loads = loadRowData();
  var conn = 0, daily = 0;
  loads.forEach(function (l) { conn += l.peak; daily += l.kwh; });
  var div = Math.min(Math.max(num('lDiv') || 80, 1), 100) / 100;
  return { loads: loads, conn: conn, daily: daily, div: div, peak: conn * div };
}

function renderLoadTotals() {
  var t = loadTotals();
  $('loadTotals').innerHTML = rows([
    ['Connected Load', fmt(t.conn, 1) + ' kW'],
    ['Peak Demand (× ' + fmt(t.div * 100, 0) + '%)', fmt(t.peak, 1) + ' kW'],
    ['နေ့စဉ် သုံးစွဲမှု', fmt(t.daily, 1) + ' kWh/day'],
    ['Load အရေအတွက်', t.loads.length + ' ခု']
  ]) + '<p class="note">ဤဂဏန်းများကို "Sizing သို့ ပို့မည်" နှိပ်၍ System Sizing တွင် တိုက်ရိုက် အသုံးပြုနိုင်ပါသည်။</p>';
}

function addLoadRow(d) {
  d = d || {};
  var row = document.createElement('div');
  row.className = 'load-row';
  row.innerHTML =
    '<div><input class="l-name" type="text" placeholder="Load name" value="' + (d.name || '') + '"></div>' +
    '<div><input class="l-kw" type="number" step="0.1" min="0" value="' + (d.kw != null ? d.kw : 1) + '"></div>' +
    '<div><input class="l-qty" type="number" step="1" min="1" value="' + (d.qty || 1) + '"></div>' +
    '<div><input class="l-hr" type="number" step="0.5" min="0" value="' + (d.hours != null ? d.hours : 8) + '"></div>' +
    '<div><button type="button" class="btn ghost small l-del">✕</button></div>';
  row.querySelector('.l-del').addEventListener('click', function () { row.remove(); renderLoadTotals(); });
  row.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('input', renderLoadTotals); });
  $('loadRows').appendChild(row);
  renderLoadTotals();
}

$('addLoad').addEventListener('click', function () { addLoadRow(); });
addLoadRow({ name: 'Lighting', kw: 1.5, qty: 1, hours: 6 });
addLoadRow({ name: 'Air-con', kw: 1.2, qty: 2, hours: 8 });
addLoadRow({ name: 'Water Pump', kw: 1.5, qty: 1, hours: 3 });

$('lDiv').addEventListener('input', renderLoadTotals);

$('loadToSize').addEventListener('click', function () {
  var t = loadTotals();
  if (!t.loads.length) {
    $('loadTotals').innerHTML = '<p class="warn">Load အနည်းဆုံး တစ်ခု ထည့်ပါ။</p>';
    return;
  }
  $('sDaily').value = Math.round(t.daily * 10) / 10;
  $('sPeak').value = Math.round(t.peak * 10) / 10;
  goTab('tab-size');
  computeSizing();
});

/* ---------- Sizing ---------- */
var DESIGN = null;

function computeSizing() {
  var out = $('sizeOut');

  var daily = num('sDaily');
  var peak = num('sPeak');
  var backupH = num('sBackup');
  var sun = num('sSun');
  var panelW = num('sPanel');
  var derate = Math.min(Math.max(num('sDerate') || 80, 1), 100) / 100;
  var acV = parseFloat($('sAC').value) || 400;
  var hasTR = $('sTR').value === '1';
  var manual = $('sManual').value === '1';

  if (daily <= 0) { out.innerHTML = '<p class="warn">နေ့စဉ် သုံးစွဲမှု (kWh/day) ထည့်ပါ။</p>'; DESIGN = null; return; }
  if (sun <= 0 || panelW <= 0) { out.innerHTML = '<p class="warn">Sun hours နှင့် Panel W ကို စစ်ပါ။</p>'; DESIGN = null; return; }

  var pvKw, panels, battKwh, modules, invKw, invPick, invUnits, cov;

  if (manual) {
    pvKw = num('sManPv');
    battKwh = num('sManBatt');
    invKw = num('sManInv');
    panels = panelW > 0 ? Math.round((pvKw * 1000) / panelW) : 0;
    modules = SIGEN_MODULE_KWH > 0 ? Math.ceil(battKwh / SIGEN_MODULE_KWH) : 0;
    invPick = invKw;
    invUnits = invKw > 0 ? 1 : 0;
  } else {
    /* PV: daily energy ÷ (sun hours × derate) */
    var pvNeed = daily / (sun * derate);
    panels = Math.max(Math.ceil((pvNeed * 1000) / panelW), 1);
    pvKw = panels * panelW / 1000;

    /* Battery: average load × backup hours, built from 8 kWh modules */
    var avgKw = daily / 24;
    var battNeed = avgKw * backupH;
    modules = Math.max(Math.ceil(battNeed / SIGEN_MODULE_KWH), 1);
    battKwh = modules * SIGEN_MODULE_KWH;

    /* Inverter: peak load + 10% margin, nearest SigenStor rating */
    var invNeed = peak > 0 ? peak * 1.1 : 0;
    invPick = (nextStd(SIGEN_INV, invNeed) || SIGEN_INV[SIGEN_INV.length - 1]);
    invUnits = Math.max(Math.ceil(invNeed / invPick), 1);
    invKw = invPick * invUnits;
  }

  cov = daily > 0 ? (pvKw * sun * derate) / daily * 100 : 0;
  var dcac = invKw > 0 ? pvKw / invKw : 0;
  var backupGet = (peak > 0 || daily > 0) ? battKwh / (daily / 24) : 0;

  var kM = acV <= 250 ? 1 : Math.sqrt(3);
  var mainI = (peak * 1000) / (kM * acV * 0.9);
  var mainBrk = nextStd(BREAKER_SIZES, mainI * 1.25);
  var trKva = null;
  if (hasTR) trKva = nextStd(TR_SIZES, (peak / 0.9) * 1.25);

  DESIGN = {
    acV: acV, hasTR: hasTR, daily: daily, peak: peak,
    pvKw: pvKw, panels: panels, panelW: panelW,
    battKwh: battKwh, modules: modules,
    invKw: invKw, invPick: invPick, invUnits: invUnits,
    mainBrk: mainBrk, mainI: mainI, trKva: trKva,
    loads: loadRowData()
  };

  var rs = [
    ['PV Array', fmt(pvKw, 1) + ' kWp (' + panels + ' × ' + fmt(panelW, 0) + ' W)'],
    ['Battery', fmt(battKwh, 1) + ' kWh (' + modules + ' × ' + fmt(SIGEN_MODULE_KWH, 0) + ' kWh module)'],
    ['Inverter', fmt(invKw, 1) + ' kW' + (invUnits > 1 ? ' (' + invUnits + ' units)' : '') + ' — SigenStor ' + fmt(invPick, 1) + ' kW']
  ];
  rs.forEach(function (r) { r[2] = true; });

  rs.push(['နေ့စဉ် သုံးစွဲမှု', fmt(daily, 1) + ' kWh/day']);
  rs.push(['Peak Load', fmt(peak, 1) + ' kW']);
  rs.push(['PV Daily Coverage', fmt(cov, 0) + '% (sun ' + fmt(sun, 1) + ' h, loss ' + fmt(derate * 100, 0) + '%)']);
  rs.push(['DC / AC Ratio', fmt(dcac, 2)]);
  rs.push(['Battery Backup', fmt(backupGet, 1) + ' နာရီ (avg load ' + fmt(daily / 24, 2) + ' kW)']);
  rs.push(['Main Breaker', fmt(mainI, 0) + ' A → ' + (mainBrk || '—') + ' A']);
  if (hasTR) rs.push(['Transformer', (trKva || '—') + ' kVA']);
  rs.push(['Grid Voltage', acV + ' V']);

  out.innerHTML = rows(rs) +
    '<p class="note">တွက်နည်း — PV = kWh/day ÷ (sun × loss) • Battery = avg.load × backup နာရီ (8 kWh module ဖြင့်) • Inverter = peak × 1.1 (SigenStor rating အနီးဆုံး) • Main breaker = peak မှတွက် + 25% margin။</p>';
}

$('sizeBtn').addEventListener('click', computeSizing);

/* ---------- SLD auto-draw ---------- */
function drawSLD(d) {
  window.SLD.clear();

  var bus = window.SLD.addNode('busbar', 400, 400, 'Main AC Bus ' + d.acV + ' V');

  var prev = window.SLD.addNode('grid', 150, 110, 'Grid ' + d.acV + ' V');
  var y = 110;
  if (d.hasTR) {
    y += 110;
    var tr = window.SLD.addNode('transformer', 150, y, (d.trKva || '?') + ' kVA');
    window.SLD.connect(prev.id, 1, tr.id, 0);
    prev = tr;
  }
  y += 110;
  var mb = window.SLD.addNode('breaker', 150, y, 'Main ' + (d.mainBrk || '?') + ' A');
  window.SLD.connect(prev.id, 1, mb.id, 0);
  window.SLD.connect(mb.id, 1, bus.id, 0);

  var pv = window.SLD.addNode('pv', 900, 110, 'PV ' + fmt(d.pvKw, 1) + ' kWp');
  var inv = window.SLD.addNode('inverter', 900, 250,
    'SigenStor ' + (d.invUnits > 1 ? d.invUnits + ' × ' : '') + fmt(d.invPick || d.invKw, 1) + ' kW');
  window.SLD.connect(pv.id, 1, inv.id, 0);

  var bat = window.SLD.addNode('battery', 1090, 250, 'Battery ' + fmt(d.battKwh, 1) + ' kWh');
  window.SLD.connect(bat.id, 0, inv.id, 1);
  window.SLD.connect(inv.id, 1, bus.id, 1);

  d.loads.forEach(function (l, i) {
    var col = i % 6;
    var rowIdx = Math.floor(i / 6);
    var x = Math.min(130 + col * 175, 1080);
    var yB = Math.min(540 + rowIdx * 180, 700);
    var b = window.SLD.addNode('breaker', x, yB, l.name + ' — ' + fmt(l.peak, 1) + ' kW');
    var ln = window.SLD.addNode('lamp', x, yB + 120, l.name + ' ' + fmt(l.peak, 1) + ' kW');
    window.SLD.connect(bus.id, 3, b.id, 0);
    window.SLD.connect(b.id, 1, ln.id, 0);
  });

  goTab('tab-sld');
}

$('sizeDrawBtn').addEventListener('click', function () {
  if (!DESIGN) computeSizing();
  if (DESIGN) drawSLD(DESIGN);
});

$('loadDraw').addEventListener('click', function () {
  var t = loadTotals();
  if (!t.loads.length) {
    $('loadTotals').innerHTML = '<p class="warn">Load အနည်းဆုံး တစ်ခု ထည့်ပါ။</p>';
    return;
  }
  $('sDaily').value = Math.round(t.daily * 10) / 10;
  $('sPeak').value = Math.round(t.peak * 10) / 10;
  computeSizing();
  if (DESIGN) {
    DESIGN.loads = t.loads;
    drawSLD(DESIGN);
  }
});

/* ---------- Breaker Sizing ---------- */
$('brkBtn').addEventListener('click', function () {
  var P = num('brkP');
  var V = num('brkV') || 400;
  var pf = num('brkPF') || 0.8;
  var three = $('brkPhase').value === '3';
  var k = three ? Math.sqrt(3) : 1;

  if (P <= 0) { $('brkOut').innerHTML = '<p class="warn">Load power ဖြည့်ပါ။</p>'; return; }

  var flc = (P * 1000) / (k * V * pf);
  var pick = nextStd(BREAKER_SIZES, flc);

  $('brkOut').innerHTML = rows([
    ['Full Load Current', fmt(flc, 1) + ' A'],
    ['အကြံပြု Breaker', pick ? pick + ' A' : 'ဇယားပြင်ပ — အထူး protection လိုသည်'],
    ['Formula', three ? 'I = P / (√3 · V · PF)' : 'I = P / (V · PF)']
  ]);
});

/* ---------- Cable Sizing ---------- */
var CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500];

$('cableBtn').addEventListener('click', function () {
  var I = num('cabI');
  var V = num('cabV') || 400;
  var L = num('cabL');
  var maxDrop = num('cabDrop') || 5;
  var rho = $('cabMat').value === 'al' ? 0.028 : 0.0175;
  var three = $('cabPhase').value === '3';
  var k = three ? Math.sqrt(3) : 2;
  var limit = V * maxDrop / 100;

  if (I <= 0 || L <= 0) { $('cableOut').innerHTML = '<p class="warn">Current နှင့် Length ဖြည့်ပါ။</p>'; return; }

  var pick = null;
  for (var i = 0; i < CABLE_SIZES.length; i++) {
    var A = CABLE_SIZES[i];
    var vd = (k * I * L * rho) / A;
    if (vd <= limit) { pick = { a: A, vd: vd }; break; }
  }
  if (!pick) { $('cableOut').innerHTML = '<p class="warn">500 mm² အထိ မလုံလောက်ပါ။ Parallel cable သုံးပါ။</p>'; return; }

  $('cableOut').innerHTML = rows([
    ['အနည်းဆုံး Cable Size', pick.a + ' mm² (' + ($('cabMat').value === 'al' ? 'Aluminium' : 'Copper') + ')'],
    ['Voltage Drop', fmt(pick.vd, 2) + ' V (' + fmt(pick.vd / V * 100, 2) + '%)'],
    ['ခွင့်ပြု Limit', fmt(limit, 2) + ' V (' + fmt(maxDrop, 1) + '%)']
  ]) + '<p class="note">Voltage drop အပိုင်းသာ — ampacity နှင့် short-circuit withstand ကို သီးခြား စစ်ပါ။</p>';
});

/* ---------- Power P • S • Q ---------- */
$('pwBtn').addEventListener('click', function () {
  var V = num('pwV') || 400;
  var I = num('pwI');
  var pf = Math.min(Math.max(num('pwPF'), 0.01), 1);
  var k = $('pwPhase').value === '3' ? Math.sqrt(3) : 1;

  if (I <= 0) { $('pwOut').innerHTML = '<p class="warn">Current ဖြည့်ပါ။</p>'; return; }

  var sVA = k * V * I;
  var pW = sVA * pf;
  var qVar = Math.sqrt(Math.max(sVA * sVA - pW * pW, 0));

  $('pwOut').innerHTML = rows([
    ['Active Power P', fmt(pW / 1000, 2) + ' kW'],
    ['Apparent Power S', fmt(sVA / 1000, 2) + ' kVA'],
    ['Reactive Power Q', fmt(qVar / 1000, 2) + ' kVAr']
  ]);
});

/* ---------- PF Correction ---------- */
$('pfBtn').addEventListener('click', function () {
  var P = num('pfP');
  var pf1 = Math.min(Math.max(num('pfCur'), 0.01), 0.999);
  var pf2 = Math.min(Math.max(num('pfTar'), 0.01), 1);

  if (P <= 0 || pf2 <= pf1) { $('pfOut').innerHTML = '<p class="warn">P ဖြည့်ပါ သို့မဟုတ် ပန်းတိုင် PF ကို မြင့်အောင် ထည့်ပါ။</p>'; return; }

  var kvar = P * (Math.tan(Math.acos(pf1)) - Math.tan(Math.acos(pf2)));

  $('pfOut').innerHTML = rows([
    ['Capacitor Bank', fmt(kvar, 1) + ' kVAr'],
    ['PF တိုးတက်မှု', fmt(pf1, 2) + ' → ' + fmt(pf2, 2)],
    ['Formula', 'Qc = P · (tan φ₁ − tan φ₂)']
  ]);
});

/* ---------- Transformer ---------- */
$('trBtn').addEventListener('click', function () {
  var P = num('trP');
  var pf = Math.min(Math.max(num('trPF'), 0.1), 1);
  var g = num('trG') / 100;

  if (P <= 0) { $('trOut').innerHTML = '<p class="warn">Load (kW) ဖြည့်ပါ။</p>'; return; }

  var kva = (P / pf) * (1 + g);
  var pick = nextStd(TR_SIZES, kva);

  $('trOut').innerHTML = rows([
    ['လိုအပ်သော Capacity', fmt(kva, 1) + ' kVA'],
    ['Standard Size', pick ? pick + ' kVA' : 'ဇယားပြင်ပ'],
    ['Formula', 'kVA = Load / PF × (1 + growth ' + fmt(g * 100, 0) + '%)']
  ]);
});

/* ---------- Init ---------- */
computeSizing();
renderLoadTotals();

'use strict';

function $(id) { return document.getElementById(id); }

function num(id) {
  var v = parseFloat($(id).value);
  return isFinite(v) ? v : 0;
}

function fmt(n, d) {
  if (d === undefined) d = 2;
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: d });
}

function rows(pairs) {
  return pairs.map(function (p) {
    return '<div class="row"><span>' + p[0] + '</span><b>' + p[1] + '</b></div>';
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

/* ---------- Solar & Battery Sizing ---------- */
$('solarBtn').addEventListener('click', function () {
  var load = num('solLoad');            // kWh/day
  var sun = num('solSun');              // peak sun hours
  var panelW = num('solPanel');         // W per panel
  var derate = Math.min(Math.max(num('solDerate'), 1), 100) / 100;
  var sysV = num('solVolt') || 48;
  var battV = num('solBattV') || 12;
  var battAh = num('solBattAh');
  var dod = Math.min(Math.max(num('solDod'), 1), 100) / 100;
  var days = num('solDays') || 1;
  var peak = num('solPeak');            // kW

  if (load <= 0 || sun <= 0 || panelW <= 0 || dod <= 0 || sysV <= 0) {
    $('solarOut').innerHTML = '<p class="warn">တန်ဖိုးများကို ပြည့်စုံစွာ ဖြည့်သွင်းပါ။</p>';
    return;
  }

  // PV array: panels needed to cover daily load under sun hours and derate
  var panels = Math.ceil(load / (sun * (panelW / 1000) * derate));
  var arrayKw = panels * (panelW / 1000);

  // Battery bank
  var bankAh = Math.ceil((load * 1000 * days) / (sysV * dod));
  var bankKwh = load * days / dod;
  var series = battV > 0 ? Math.ceil(sysV / battV) : 0;
  var parallel = battAh > 0 ? Math.ceil(bankAh / battAh) : 0;
  var units = series * parallel;

  // Charge controller: array current with 25% safety factor
  var ccA = Math.ceil((arrayKw * 1000) / sysV * 1.25);

  // Inverter: peak load with 25% margin
  var invKw = peak > 0 ? Math.ceil(peak * 1.25) : 0;

  $('solarOut').innerHTML = rows([
    ['လိုအပ်သော Panel အရေအတွက်', panels + ' panels'],
    ['Total PV Array Size', fmt(arrayKw, 1) + ' kWp'],
    ['Battery Bank Capacity', fmt(bankAh, 0) + ' Ah @ ' + fmt(sysV, 0) + ' V'],
    ['Battery Bank Energy (usable ' + fmt(dod * 100, 0) + '% DoD)', fmt(bankKwh, 1) + ' kWh'],
    ['Battery Configuration', series + 'S × ' + parallel + 'P (' + fmt(units, 0) + ' units)'],
    ['Charge Controller အရွယ် (≥)', fmt(ccA, 0) + ' A'],
    ['Inverter အရွယ် (≥)', peak > 0 ? fmt(invKw, 1) + ' kW' : '—']
  ]) + '<p class="note">Design margin — PV: derate ' + fmt(derate * 100, 0) + '%, controller +25%, inverter +25% ပါဝင်ထားပါသည်။</p>';
});

/* ---------- Cable Sizing ---------- */
var CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500];

$('cableBtn').addEventListener('click', function () {
  var I = num('cabI');
  var V = num('cabV') || 400;
  var L = num('cabL');
  var maxDrop = num('cabDrop') || 5;
  var rho = $('cabMat').value === 'al' ? 0.028 : 0.0175; // Ω·mm²/m
  var three = $('cabPhase').value === '3';
  var k = three ? Math.sqrt(3) : 2;
  var limit = V * maxDrop / 100;

  if (I <= 0 || L <= 0) {
    $('cableOut').innerHTML = '<p class="warn">Current နှင့် Length ဖြည့်သွင်းပါ။</p>';
    return;
  }

  var pick = null;
  for (var i = 0; i < CABLE_SIZES.length; i++) {
    var A = CABLE_SIZES[i];
    var vd = (k * I * L * rho) / A;
    if (vd <= limit) { pick = { a: A, vd: vd }; break; }
  }

  if (!pick) {
    $('cableOut').innerHTML = '<p class="warn">ဇယားရှိ cable size များ (500 mm² အထိ) ဖြင့် မလုံလောက်ပါ။ Parallel cables သုံးပါ သို့မဟုတ် voltage / drop limit ပြန်စစ်ပါ။</p>';
    return;
  }

  $('cableOut').innerHTML = rows([
    ['အနည်းဆုံး Cable Size', pick.a + ' mm² (' + ($('cabMat').value === 'al' ? 'Aluminium' : 'Copper') + ')'],
    ['Voltage Drop @ ' + pick.a + ' mm²', fmt(pick.vd, 2) + ' V (' + fmt(pick.vd / V * 100, 2) + '%)'],
    ['ခွင့်ပြု Limit', fmt(limit, 2) + ' V (' + fmt(maxDrop, 1) + '%)'],
    ['Formula', (three ? 'ΔV = √3 · I · L · ρ / A' : 'ΔV = 2 · I · L · ρ / A') + ' , ρ = ' + rho + ' Ω·mm²/m']
  ]) + '<p class="note">Voltage drop အပိုင်းသာ ဖြစ်ပါသည် — current carrying capacity (ampacity) နှင့် short-circuit withstand ကို လည်း စစ်ဆေးပါ။</p>';
});

/* ---------- Breaker Sizing ---------- */
var BREAKER_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];

$('brkBtn').addEventListener('click', function () {
  var P = num('brkP');
  var V = num('brkV') || 400;
  var pf = num('brkPF') || 0.8;
  var three = $('brkPhase').value === '3';
  var k = three ? Math.sqrt(3) : 1;

  if (P <= 0) {
    $('brkOut').innerHTML = '<p class="warn">Load power ဖြည့်သွင်းပါ။</p>';
    return;
  }

  var flc = (P * 1000) / (k * V * pf);
  var pick = null;
  for (var i = 0; i < BREAKER_SIZES.length; i++) {
    if (BREAKER_SIZES[i] >= flc) { pick = BREAKER_SIZES[i]; break; }
  }

  $('brkOut').innerHTML = rows([
    ['Full Load Current', fmt(flc, 1) + ' A'],
    ['အကြံပြု Breaker Rating', pick ? pick + ' A' : 'ဇယားပြင်ပ — ထူးခြားသော protection လိုအပ်သည်'],
    ['Formula', (three ? 'I = P / (√3 · V · PF)' : 'I = P / (V · PF)')]
  ]);
});

/* ---------- Power P • S • Q ---------- */
$('pwBtn').addEventListener('click', function () {
  var V = num('pwV') || 400;
  var I = num('pwI');
  var pf = Math.min(Math.max(num('pwPF'), 0.01), 1);
  var three = $('pwPhase').value === '3';
  var k = three ? Math.sqrt(3) : 1;

  if (I <= 0) {
    $('pwOut').innerHTML = '<p class="warn">Current ဖြည့်သွင်းပါ။</p>';
    return;
  }

  var sVA = k * V * I;          // apparent power VA
  var pW = sVA * pf;            // real power W
  var qVar = Math.sqrt(Math.max(sVA * sVA - pW * pW, 0)); // reactive VA

  $('pwOut').innerHTML = rows([
    ['Active Power P', fmt(pW / 1000, 2) + ' kW'],
    ['Apparent Power S', fmt(sVA / 1000, 2) + ' kVA'],
    ['Reactive Power Q', fmt(qVar / 1000, 2) + ' kVAr'],
    ['Power Factor', fmt(pf, 2)]
  ]);
});

/* ---------- Power Factor Correction ---------- */
$('pfBtn').addEventListener('click', function () {
  var P = num('pfP');
  var pf1 = Math.min(Math.max(num('pfCur'), 0.01), 0.999);
  var pf2 = Math.min(Math.max(num('pfTar'), 0.01), 1);

  if (P <= 0 || pf2 <= pf1) {
    $('pfOut').innerHTML = '<p class="warn">P (kW) ဖြည့်ပါ သို့မဟုတ် ပန်းတိုင် PF ကို လက်ရှိ PF ထက် မြင့်အောင် ထည့်ပါ။</p>';
    return;
  }

  var kvar = P * (Math.tan(Math.acos(pf1)) - Math.tan(Math.acos(pf2)));

  $('pfOut').innerHTML = rows([
    ['လိုအပ်သော Capacitor Bank', fmt(kvar, 1) + ' kVAr'],
    ['PF ' + fmt(pf1, 2) + ' → ' + fmt(pf2, 2), 'tan φ ကွာဟချက်ဖြင့် တွက်ထားသည်'],
    ['Formula', 'Qc = P · (tan φ₁ − tan φ₂)']
  ]) + '<p class="note">Capacitor steps များအဖြစ် ခွဲ၍ ထိန်းချုပ်ရန် — ဥပမာ ' + fmt(kvar, 1) + ' kVAr ကို ' + Math.max(Math.ceil(kvar / 25), 1) + ' steps ခွဲနိုင်သည်။</p>';
});

/* ---------- Transformer Sizing ---------- */
var TR_SIZES = [25, 50, 100, 200, 315, 500, 630, 800, 1000, 1250, 1600, 2000, 2500];

$('trBtn').addEventListener('click', function () {
  var P = num('trP');
  var pf = Math.min(Math.max(num('trPF'), 0.1), 1);
  var g = num('trG') / 100;

  if (P <= 0) {
    $('trOut').innerHTML = '<p class="warn">Load (kW) ဖြည့်သွင်းပါ။</p>';
    return;
  }

  var kva = (P / pf) * (1 + g);
  var pick = null;
  for (var i = 0; i < TR_SIZES.length; i++) {
    if (TR_SIZES[i] >= kva) { pick = TR_SIZES[i]; break; }
  }

  $('trOut').innerHTML = rows([
    ['လိုအပ်သော Capacity', fmt(kva, 1) + ' kVA'],
    ['အကြံပြု Standard Size', pick ? pick + ' kVA' : 'ဇယားပြင်ပ — စက်ရုံမှ အထူးပြု တောင်းဆိုရမည်'],
    ['Formula', 'kVA = Load / PF × (1 + growth ' + fmt(g * 100, 0) + '%)']
  ]);
});

'use strict';

(function () {
  var svg = document.getElementById('sldSvg');
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- Symbol library ---------- */
  var SYM = {
    grid: {
      name: 'Grid Source (Main Incomer)', w: 76, h: 76,
      draw: function () {
        return '<circle r="26" class="sym"/>' +
               '<path d="M -14 6 Q -7 -8 0 6 T 14 6" class="sym"/>';
      }
    },
    pv: {
      name: 'Solar PV Array', w: 80, h: 64,
      draw: function () {
        return '<rect x="-28" y="-20" width="56" height="40" rx="3" class="box"/>' +
               '<path d="M -28 0 H 28 M -9 -20 V 20 M 9 -20 V 20" class="sym"/>';
      }
    },
    battery: {
      name: 'Battery Bank', w: 70, h: 44,
      draw: function () {
        return '<line x1="-22" y1="-12" x2="22" y2="-12" class="thick"/>' +
               '<line x1="-22" y1="-4" x2="22" y2="-4" class="sym"/>' +
               '<line x1="-8" y1="4" x2="8" y2="4" class="thick"/>' +
               '<line x1="-22" y1="12" x2="22" y2="12" class="sym"/>';
      }
    },
    inverter: {
      name: 'Inverter / PCS', w: 70, h: 76,
      draw: function () {
        return '<rect x="-26" y="-26" width="52" height="52" rx="4" class="box"/>' +
               '<line x1="-14" y1="-12" x2="14" y2="-12" class="sym"/>' +
               '<line x1="-14" y1="-6" x2="14" y2="-6" class="sym"/>' +
               '<path d="M -14 12 Q -7 0 0 12 T 14 12" class="sym"/>';
      }
    },
    transformer: {
      name: 'Transformer', w: 72, h: 52,
      draw: function () {
        return '<circle cx="-8" cy="0" r="18" class="sym"/>' +
               '<circle cx="8" cy="0" r="18" class="sym"/>';
      }
    },
    breaker: {
      name: 'Breaker (MCCB/ACB)', w: 56, h: 72,
      draw: function () {
        return '<rect x="-18" y="-24" width="36" height="48" rx="3" class="box"/>' +
               '<path d="M -12 14 L 12 -14" class="sym"/>';
      }
    },
    fuse: {
      name: 'Fuse', w: 48, h: 44,
      draw: function () {
        return '<rect x="-16" y="-9" width="32" height="18" class="box"/>' +
               '<line x1="-16" y1="0" x2="16" y2="0" class="sym"/>';
      }
    },
    busbar: {
      name: 'Busbar', w: 180, h: 24,
      ports: [{ x: -90, y: 0 }, { x: 90, y: 0 }, { x: 0, y: -14 }, { x: 0, y: 14 }],
      draw: function () {
        return '<line x1="-90" y1="0" x2="90" y2="0" class="thick"/>';
      }
    },
    motor: {
      name: 'Motor Load', w: 64, h: 68,
      draw: function () {
        return '<circle r="22" class="sym"/>' +
               '<text y="6" class="stext">M</text>';
      }
    },
    lamp: {
      name: 'Lighting Load', w: 60, h: 64,
      draw: function () {
        return '<circle r="20" class="sym"/>' +
               '<path d="M -14 -14 L 14 14 M 14 -14 L -14 14" class="sym"/>';
      }
    },
    cap: {
      name: 'Capacitor Bank', w: 64, h: 52,
      draw: function () {
        return '<line x1="-20" y1="-6" x2="20" y2="-6" class="thick"/>' +
               '<line x1="-20" y1="6" x2="20" y2="6" class="thick"/>';
      }
    },
    earth: {
      name: 'Earth / Ground', w: 48, h: 40,
      draw: function () {
        return '<line x1="0" y1="-16" x2="0" y2="-4" class="sym"/>' +
               '<line x1="-16" y1="-4" x2="16" y2="-4" class="sym"/>' +
               '<line x1="-10" y1="2" x2="10" y2="2" class="sym"/>' +
               '<line x1="-5" y1="8" x2="5" y2="8" class="sym"/>';
      }
    }
  };

  function portsOf(type) {
    var s = SYM[type];
    if (s.ports) return s.ports;
    return [{ x: 0, y: -s.h / 2 }, { x: 0, y: s.h / 2 }];
  }

  /* ---------- State ---------- */
  var S = { nodes: [], wires: [], nextId: 1, selected: null, pending: null, mouse: null, drag: null };

  function byId(id) {
    for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === id) return S.nodes[i];
    return null;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function portPoint(p) {
    var n = byId(p.node);
    if (!n) return { x: 0, y: 0 };
    var pp = portsOf(n.type)[p.port] || { x: 0, y: 0 };
    return { x: n.x + pp.x, y: n.y + pp.y };
  }

  function wirePath(a, b) {
    if (Math.abs(a.y - b.y) >= Math.abs(a.x - b.x)) {
      var m = (a.y + b.y) / 2;
      return 'M ' + a.x + ' ' + a.y + ' L ' + a.x + ' ' + m + ' L ' + b.x + ' ' + m + ' L ' + b.x + ' ' + b.y;
    }
    var mx = (a.x + b.x) / 2;
    return 'M ' + a.x + ' ' + a.y + ' L ' + mx + ' ' + a.y + ' L ' + mx + ' ' + b.y + ' L ' + b.x + ' ' + b.y;
  }

  /* ---------- Render ---------- */
  var SVG_STYLE =
    '<style>' +
    '.bg{fill:#0e1620}' +
    '.wire{fill:none;stroke:#e8b84b;stroke-width:2.5;stroke-linecap:round}' +
    '.wire.ghost{stroke:#4da3ff;stroke-dasharray:6 5;opacity:.7}' +
    '.node .sym{fill:none;stroke:#dbe7f3;stroke-width:2.2;stroke-linecap:round}' +
    '.node .box{fill:none;stroke:#dbe7f3;stroke-width:2.2}' +
    '.node .thick{fill:none;stroke:#dbe7f3;stroke-width:5;stroke-linecap:round}' +
    '.node .halo{fill:transparent;stroke:transparent;stroke-width:1.5;cursor:move}' +
    '.node.sel .halo{stroke:#4da3ff}' +
    '.node .stext{fill:#dbe7f3;font-size:17px;text-anchor:middle;font-family:sans-serif}' +
    '.nlabel{fill:#8fa7bf;font-size:12px;text-anchor:middle;font-family:sans-serif}' +
    '.port{fill:#0e1620;stroke:#e8b84b;stroke-width:2;cursor:crosshair}' +
    '.port.pend{fill:#e8b84b}' +
    '</style>';

  function render() {
    var out = SVG_STYLE;
    out += '<rect class="bg" x="0" y="0" width="1200" height="900"/>';

    out += '<g id="wireLayer">';
    S.wires.forEach(function (w) {
      out += '<path class="wire" d="' + wirePath(portPoint(w.a), portPoint(w.b)) + '"/>';
    });
    if (S.pending && S.mouse) {
      var a = portPoint(S.pending);
      out += '<path class="wire ghost" d="M ' + a.x + ' ' + a.y + ' L ' + S.mouse.x + ' ' + S.mouse.y + '"/>';
    }
    out += '</g>';

    out += '<g id="nodeLayer">';
    S.nodes.forEach(function (n) {
      var s = SYM[n.type];
      out += '<g class="node' + (S.selected === n.id ? ' sel' : '') + '" data-id="' + n.id + '" transform="translate(' + n.x + ',' + n.y + ')">';
      out += '<rect class="halo" x="' + (-s.w / 2 - 8) + '" y="' + (-s.h / 2 - 8) + '" width="' + (s.w + 16) + '" height="' + (s.h + 16) + '" rx="8"/>';
      out += s.draw();
      out += '<text class="nlabel" y="' + (s.h / 2 + 18) + '">' + esc(n.label) + '</text>';
      out += '</g>';
    });
    out += '</g>';

    out += '<g id="portLayer">';
    S.nodes.forEach(function (n) {
      portsOf(n.type).forEach(function (p, i) {
        var pend = S.pending && S.pending.node === n.id && S.pending.port === i;
        out += '<circle class="port' + (pend ? ' pend' : '') + '" data-node="' + n.id + '" data-port="' + i + '" cx="' + (n.x + p.x) + '" cy="' + (n.y + p.y) + '" r="6"/>';
      });
    });
    out += '</g>';

    svg.innerHTML = out;
  }

  /* ---------- Helpers ---------- */
  function svgPoint(e) {
    var ctm = svg.getScreenCTM();
    var p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    return p.matrixTransform(ctm.inverse());
  }

  function setStatus(msg) {
    document.getElementById('sldMsg').textContent = msg || '';
  }

  /* ---------- Palette ---------- */
  var palette = document.getElementById('palette');
  Object.keys(SYM).forEach(function (key) {
    var b = document.createElement('button');
    b.className = 'btn ghost small';
    b.textContent = SYM[key].name;
    b.addEventListener('click', function () {
      var i = S.nodes.length;
      var n = {
        id: S.nextId++,
        type: key,
        x: 600 + ((i % 6) - 3) * 60,
        y: 300 + Math.floor(i / 6) * 90,
        label: SYM[key].name
      };
      S.nodes.push(n);
      S.selected = n.id;
      render();
    });
    palette.appendChild(b);
  });

  /* ---------- Events ---------- */
  svg.addEventListener('pointerdown', function (e) {
    var portEl = e.target.closest('.port');
    if (portEl) {
      var nid = parseInt(portEl.dataset.node, 10);
      var pi = parseInt(portEl.dataset.port, 10);
      if (!S.pending) {
        S.pending = { node: nid, port: pi };
        setStatus('Wire start — ပုံရိပ် နောက် port တစ်ခု နှိပ်ပါ (ပယ်ဖျက်ရန် Esc)');
      } else if (S.pending.node === nid && S.pending.port === pi) {
        S.pending = null;
        setStatus('');
      } else {
        S.wires.push({ a: S.pending, b: { node: nid, port: pi } });
        S.pending = null;
        setStatus('');
      }
      render();
      return;
    }

    var nodeEl = e.target.closest('.node');
    if (nodeEl) {
      var id = parseInt(nodeEl.dataset.id, 10);
      var n = byId(id);
      if (!n) return;
      S.selected = id;
      var pt = svgPoint(e);
      S.drag = { id: id, dx: n.x - pt.x, dy: n.y - pt.y };
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      render();
    }
  });

  svg.addEventListener('pointermove', function (e) {
    var pt = svgPoint(e);
    if (S.drag) {
      var n = byId(S.drag.id);
      if (n) {
        n.x = Math.round(pt.x + S.drag.dx);
        n.y = Math.round(pt.y + S.drag.dy);
        render();
      }
    } else if (S.pending) {
      S.mouse = pt;
      render();
    }
  });

  svg.addEventListener('pointerup', function () { S.drag = null; });

  svg.addEventListener('dblclick', function (e) {
    var nodeEl = e.target.closest('.node');
    if (nodeEl) {
      var n = byId(parseInt(nodeEl.dataset.id, 10));
      if (!n) return;
      var v = prompt('Label:', n.label);
      if (v !== null && v.trim() !== '') { n.label = v.trim(); render(); }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      S.pending = null; S.selected = null; setStatus('');
      render();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected !== null) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      deleteSelected();
      e.preventDefault();
    }
  });

  function deleteSelected() {
    S.nodes = S.nodes.filter(function (n) { return n.id !== S.selected; });
    S.wires = S.wires.filter(function (w) { return w.a.node !== S.selected && w.b.node !== S.selected; });
    S.selected = null;
    render();
  }

  document.getElementById('delNode').addEventListener('click', deleteSelected);

  document.getElementById('clrAll').addEventListener('click', function () {
    if (S.nodes.length === 0) return;
    if (confirm('Diagram အားလုံး ဖျက်မှာလား?')) {
      S.nodes = []; S.wires = []; S.selected = null; S.pending = null; S.nextId = 1;
      render();
    }
  });

  /* ---------- Save / Load / Export ---------- */
  document.getElementById('saveSld').addEventListener('click', function () {
    try {
      localStorage.setItem('sld-diagram', JSON.stringify({ nodes: S.nodes, wires: S.wires, nextId: S.nextId }));
      setStatus('ဒီ browser ထဲတွင် save လုပ်ပြီးပါပြီ');
    } catch (err) {
      setStatus('Save မအောင်မြင်ပါ: ' + err.message);
    }
  });

  document.getElementById('loadSld').addEventListener('click', function () {
    try {
      var raw = localStorage.getItem('sld-diagram');
      if (!raw) { setStatus('Save လုပ်ထားသော diagram မရှိပါ'); return; }
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.nodes) && Array.isArray(d.wires)) {
        S.nodes = d.nodes;
        S.wires = d.wires;
        S.nextId = d.nextId || (d.nodes.length + 1);
        S.selected = null; S.pending = null;
        render();
        setStatus('Load ပြီးပါပြီ');
      }
    } catch (err) {
      setStatus('Load မအောင်မြင်ပါ: ' + err.message);
    }
  });

  document.getElementById('expSvg').addEventListener('click', function () {
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    var s = new XMLSerializer().serializeToString(clone);
    var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + s], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sld-diagram.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  render();

  /* ---------- Public API (for Auto Design) ---------- */
  window.SLD = {
    clear: function () {
      S.nodes = []; S.wires = []; S.selected = null; S.pending = null; S.nextId = 1;
      render();
    },
    addNode: function (type, x, y, label) {
      if (!SYM[type]) return null;
      var n = {
        id: S.nextId++,
        type: type,
        x: Math.max(60, Math.min(1140, Math.round(x))),
        y: Math.max(50, Math.min(860, Math.round(y))),
        label: label || SYM[type].name
      };
      S.nodes.push(n);
      render();
      return n;
    },
    connect: function (n1, p1, n2, p2) {
      if (!byId(n1) || !byId(n2)) return;
      S.wires.push({ a: { node: n1, port: p1 }, b: { node: n2, port: p2 } });
      render();
    },
    render: render
  };
})();

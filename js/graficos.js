/* SD Descontos — gráficos em SVG (sem bibliotecas externas).
   linha(): evolução no tempo · barras(): comparativo horizontal · rosca(): distribuição */
(function (root) {
  'use strict';
  var SD = root.SD = root.SD || {};
  var util = SD.util;
  var NS = 'http://www.w3.org/2000/svg';

  function el(nome, attrs, pai) {
    var e = document.createElementNS(NS, nome);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  // ---------- Dica flutuante (tooltip) ----------
  var dica;
  function mostrarDica(html, x, y) {
    if (!dica) { dica = document.createElement('div'); dica.className = 'dica'; dica.setAttribute('role', 'tooltip'); document.body.appendChild(dica); }
    dica.innerHTML = html;
    dica.style.display = 'block';
    var w = dica.offsetWidth, h = dica.offsetHeight;
    var px = x + 14, py = y - h - 10;
    if (px + w > window.innerWidth - 8) px = x - w - 14;
    if (px < 8) px = 8;
    if (py < 8) py = y + 16;
    dica.style.left = (px + window.scrollX) + 'px';
    dica.style.top = (py + window.scrollY) + 'px';
  }
  function esconderDica() { if (dica) dica.style.display = 'none'; }

  function escalaBonita(max) {
    if (!(max > 0)) return { max: 1, passo: 0.25 };
    var bruto = max / 4, pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    var passo = [1, 2, 2.5, 5, 10].map(function (m) { return m * pot; }).find(function (p) { return p >= bruto; });
    return { max: Math.ceil(max / passo) * passo, passo: passo };
  }

  function legenda(container, itens) {
    var lg = document.createElement('div');
    lg.className = 'legenda';
    itens.forEach(function (it) {
      var s = document.createElement('span');
      s.innerHTML = '<i style="background:' + it.cor + '"></i>' + util.escapar(it.nome);
      lg.appendChild(s);
    });
    container.appendChild(lg);
  }

  // ---------- Linha ----------
  // opcoes: { rotulos:[], rotuloX: fn(rotulo)->texto curto, rotuloDica: fn, series:[{nome,cor,valores}], formato: fn }
  function linha(container, op) {
    container.innerHTML = '';
    if (op.series.length > 1) legenda(container, op.series);
    var W = Math.max(container.clientWidth, 280), H = W < 520 ? 220 : 260;
    var m = { t: 12, r: 16, b: 28, l: W < 520 ? 52 : 68 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, role: 'img', 'aria-label': op.titulo || 'Gráfico de evolução' }, container);
    var n = op.rotulos.length;
    var max = 0;
    op.series.forEach(function (s) { s.valores.forEach(function (v) { if (v > max) max = v; }); });
    var esc = escalaBonita(max);
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    function x(i) { return m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1)); }
    function y(v) { return m.t + ih - (v / esc.max) * ih; }

    // grade e eixo Y
    for (var t = 0; t <= esc.max + 1e-9; t += esc.passo) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'eixo' : 'grade' }, svg);
      var tx = el('text', { x: m.l - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'rotulo-eixo' }, svg);
      tx.textContent = op.formatoEixo ? op.formatoEixo(t) : op.formato(t);
    }
    // eixo X (rótulos espaçados)
    var maxRot = Math.max(2, Math.floor(iw / 64));
    var salto = Math.max(1, Math.ceil(n / maxRot));
    for (var i = 0; i < n; i += salto) {
      var lx = el('text', { x: x(i), y: H - 8, 'text-anchor': n === 1 ? 'middle' : (i === 0 ? 'start' : 'middle'), class: 'rotulo-eixo' }, svg);
      lx.textContent = op.rotuloX(op.rotulos[i]);
    }
    // linhas
    op.series.forEach(function (s) {
      var d = s.valores.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v || 0).toFixed(1); }).join(' ');
      el('path', { d: d, fill: 'none', stroke: s.cor, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      if (n <= 1) el('circle', { cx: x(0), cy: y(s.valores[0] || 0), r: 4, fill: s.cor }, svg);
    });
    // camada de interação: mira vertical + pontos
    var mira = el('line', { y1: m.t, y2: m.t + ih, class: 'mira', visibility: 'hidden' }, svg);
    var pontos = op.series.map(function (s) { return el('circle', { r: 4.5, fill: s.cor, stroke: '#ffffff', 'stroke-width': 2, visibility: 'hidden' }, svg); });
    var area = el('rect', { x: m.l - 6, y: m.t, width: iw + 12, height: ih, fill: 'transparent' }, svg);
    function mover(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) * (W / r.width);
      var i = n === 1 ? 0 : Math.round(((px - m.l) / iw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      mira.setAttribute('x1', x(i)); mira.setAttribute('x2', x(i)); mira.setAttribute('visibility', 'visible');
      var html = '<strong>' + util.escapar(op.rotuloDica(op.rotulos[i])) + '</strong>';
      var total = 0;
      op.series.forEach(function (s, k) {
        var v = s.valores[i] || 0; total += v;
        pontos[k].setAttribute('cx', x(i)); pontos[k].setAttribute('cy', y(v)); pontos[k].setAttribute('visibility', 'visible');
        html += '<div class="dica-linha"><i style="background:' + s.cor + '"></i>' + util.escapar(s.nome) + '<b>' + op.formato(v) + '</b></div>';
      });
      if (op.series.length > 1) html += '<div class="dica-linha dica-total">Total<b>' + op.formato(total) + '</b></div>';
      mostrarDica(html, ev.clientX, ev.clientY);
    }
    function sair() { mira.setAttribute('visibility', 'hidden'); pontos.forEach(function (p) { p.setAttribute('visibility', 'hidden'); }); esconderDica(); }
    area.addEventListener('pointermove', mover);
    area.addEventListener('pointerdown', mover);
    area.addEventListener('pointerleave', sair);
  }

  // ---------- Barras horizontais ----------
  // itens: [{nome, cor, valor, rotulo?}]; valor null = não disponível
  function barras(container, itens, formato) {
    container.innerHTML = '';
    var max = 0;
    itens.forEach(function (it) { if (it.valor > max) max = it.valor; });
    itens.forEach(function (it) {
      var linhaEl = document.createElement('div');
      linhaEl.className = 'barra-linha';
      var larg = it.valor > 0 && max > 0 ? Math.max(1.5, (it.valor / max) * 100) : 0;
      var valorTxt = it.valor == null ? '<span class="nd">não informado</span>' : formato(it.valor);
      linhaEl.innerHTML = '<span class="barra-nome">' + util.escapar(it.nome) + '</span>' +
        '<span class="barra-trilho"><span class="barra" style="width:' + larg + '%;background:' + it.cor + '"></span></span>' +
        '<span class="barra-valor">' + valorTxt + '</span>';
      if (it.valor != null) {
        linhaEl.addEventListener('pointermove', function (ev) {
          mostrarDica('<strong>' + util.escapar(it.nome) + '</strong><div class="dica-linha">' + util.escapar(it.rotulo || '') + '<b>' + formato(it.valor) + '</b></div>' +
            (it.extra ? '<div class="dica-sub">' + util.escapar(it.extra) + '</div>' : ''), ev.clientX, ev.clientY);
        });
        linhaEl.addEventListener('pointerleave', esconderDica);
      }
      container.appendChild(linhaEl);
    });
  }

  // ---------- Rosca ----------
  function rosca(container, itens, formato, rotuloCentro) {
    container.innerHTML = '';
    var total = itens.reduce(function (a, it) { return a + Math.max(0, it.valor || 0); }, 0);
    var S = 200, c = S / 2, R = 88, r = 60;
    var envolve = document.createElement('div'); envolve.className = 'rosca';
    container.appendChild(envolve);
    var svg = el('svg', { viewBox: '0 0 ' + S + ' ' + S, width: S, height: S, role: 'img', 'aria-label': 'Distribuição das comissões por plataforma' }, envolve);
    if (total <= 0) {
      el('circle', { cx: c, cy: c, r: (R + r) / 2, fill: 'none', stroke: '#e6e8ec', 'stroke-width': R - r }, svg);
    } else {
      var ang = -Math.PI / 2;
      var ativos = itens.filter(function (it) { return it.valor > 0; });
      ativos.forEach(function (it) {
        var frac = it.valor / total, a2 = ang + frac * Math.PI * 2;
        var caminho;
        if (ativos.length === 1) {
          caminho = 'M' + c + ' ' + (c - R) + ' A' + R + ' ' + R + ' 0 1 1 ' + (c - 0.01) + ' ' + (c - R) + ' L' + (c - 0.01) + ' ' + (c - r) + ' A' + r + ' ' + r + ' 0 1 0 ' + c + ' ' + (c - r) + 'Z';
        } else {
          var g = frac > 0.02 ? 0.012 : 0; // pequeno espaço entre fatias
          var b1 = ang + g, b2 = a2 - g, grande = (b2 - b1) > Math.PI ? 1 : 0;
          caminho = 'M' + (c + R * Math.cos(b1)) + ' ' + (c + R * Math.sin(b1)) +
            ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + (c + R * Math.cos(b2)) + ' ' + (c + R * Math.sin(b2)) +
            ' L' + (c + r * Math.cos(b2)) + ' ' + (c + r * Math.sin(b2)) +
            ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + (c + r * Math.cos(b1)) + ' ' + (c + r * Math.sin(b1)) + 'Z';
        }
        var p = el('path', { d: caminho, fill: it.cor, class: 'fatia' }, svg);
        p.addEventListener('pointermove', function (ev) {
          mostrarDica('<strong>' + util.escapar(it.nome) + '</strong><div class="dica-linha">Comissões<b>' + formato(it.valor) + '</b></div><div class="dica-sub">' + util.pct(frac) + ' do total</div>', ev.clientX, ev.clientY);
        });
        p.addEventListener('pointerleave', esconderDica);
        ang = a2;
      });
    }
    var t1 = el('text', { x: c, y: c - 4, 'text-anchor': 'middle', class: 'rosca-valor' }, svg);
    t1.textContent = util.moedaCurta(total);
    var t2 = el('text', { x: c, y: c + 16, 'text-anchor': 'middle', class: 'rotulo-eixo' }, svg);
    t2.textContent = rotuloCentro || 'total';
    var lista = document.createElement('ul'); lista.className = 'rosca-lista';
    itens.forEach(function (it) {
      var li = document.createElement('li');
      var frac = total > 0 && it.valor > 0 ? it.valor / total : 0;
      li.innerHTML = '<i style="background:' + it.cor + '"></i><span>' + util.escapar(it.nome) + '</span>' +
        (it.valor == null ? '<b class="nd">não informado</b>' : '<b>' + util.pct(frac) + '</b><small>' + formato(it.valor) + '</small>');
      lista.appendChild(li);
    });
    envolve.appendChild(lista);
  }

  SD.graficos = { linha: linha, barras: barras, rosca: rosca, esconderDica: esconderDica };
})(typeof window !== 'undefined' ? window : globalThis);

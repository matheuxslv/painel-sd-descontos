/* SD Descontos — utilidades gerais (formatação, números, datas, hash) */
(function (root) {
  'use strict';
  var SD = root.SD = root.SD || {};

  // ---------- Texto ----------
  function normalizar(txt) {
    return String(txt == null ? '' : txt)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // ---------- Hash (cyrb53 duplo, rápido e determinístico) ----------
  function cyrb53(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }
  function hash(str) { return cyrb53(str, 7) + cyrb53(str, 1013).slice(0, 6); }
  function hashBytes(bytes) {
    // amostra completa em blocos para não estourar memória com strings gigantes
    var partes = [], passo = 65536;
    for (var i = 0; i < bytes.length; i += passo) {
      partes.push(hash(String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + passo, bytes.length)))));
    }
    return hash(partes.join('|') + ':' + bytes.length);
  }

  // ---------- Números ----------
  // Aceita 1234.56 | 1.234,56 | 1,234.56 | R$ 12,34 | (12,34) | -12,34
  function parseNumero(v) {
    if (v == null) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return null;
    var s = String(v).trim();
    if (!s || s === '-' || s === '--' || /^n\/?a$/i.test(s)) return null;
    var negativo = false;
    if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
    s = s.replace(/R\$|US\$|BRL|USD|\$| |\s/gi, '');
    if (s.charAt(0) === '-') { negativo = !negativo; s = s.slice(1); }
    if (s.charAt(s.length - 1) === '-') { negativo = !negativo; s = s.slice(0, -1); }
    if (!/^[0-9.,]+$/.test(s)) return null;
    var temPonto = s.indexOf('.') >= 0, temVirgula = s.indexOf(',') >= 0;
    if (temPonto && temVirgula) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (temVirgula) {
      if ((s.match(/,/g) || []).length > 1) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    } else if (temPonto) {
      var pontos = (s.match(/\./g) || []).length;
      if (pontos > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return negativo ? -n : n;
  }
  function arred(n) { return n == null ? null : Math.round(n * 100) / 100; }

  // ---------- Datas ----------
  var MESES = {
    jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7,
    ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12
  };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(a, m, d) {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
    var dt = new Date(Date.UTC(a, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return a + '-' + pad(m) + '-' + pad(d);
  }
  function serialExcelParaData(n) {
    if (!(n > 20000 && n < 80000)) return null;
    var dt = new Date(Math.round((n - 25569) * 86400000));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }
  // ordem: 'dmy' (padrão Brasil) ou 'mdy'
  function parseData(v, ordem) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
    if (typeof v === 'number') return serialExcelParaData(v);
    var s = String(v).trim();
    var m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/))) {
      var a = +m[1], b = +m[2];
      if (ordem === 'mdy') return ymd(+m[3], a, b);
      return ymd(+m[3], b, a);
    }
    if ((m = s.match(/^(\d{1,2})\s*(?:de\s*)?([a-zç]{3})[a-zç.]*\s*(?:de\s*)?(\d{4})/i))) {
      var mes = MESES[normalizar(m[2]).slice(0, 3)];
      return mes ? ymd(+m[3], mes, +m[1]) : null;
    }
    if ((m = s.match(/^([a-z]{3})[a-z.]*\s+(\d{1,2}),?\s+(\d{4})/i))) {
      var mes2 = MESES[normalizar(m[1]).slice(0, 3)];
      return mes2 ? ymd(+m[3], mes2, +m[2]) : null;
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) return serialExcelParaData(parseFloat(s));
    return null;
  }
  // Descobre se a coluna usa dia/mês ou mês/dia
  function detectarOrdemData(valores) {
    var dmy = 0, mdy = 0;
    for (var i = 0; i < valores.length; i++) {
      var m = String(valores[i] == null ? '' : valores[i]).trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    }
    return mdy > dmy ? 'mdy' : 'dmy';
  }
  function hojeISO() { return parseData(new Date()); }
  function addDias(iso, n) {
    var p = iso.split('-');
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
  }
  function diasEntre(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }

  // ---------- Formatação ----------
  var fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var fmtInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var fmtPct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });
  var NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var NOMES_MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function moeda(n) { return n == null ? '—' : fmtMoeda.format(n); }
  function moedaCurta(n) {
    if (n == null) return '—';
    var a = Math.abs(n);
    if (a >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (a >= 1e4) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return fmtMoeda.format(n);
  }
  function inteiro(n) { return n == null ? '—' : fmtInt.format(n); }
  function pct(n) { return n == null || !isFinite(n) ? '—' : fmtPct.format(n); }
  function dataBR(iso) {
    if (!iso) return '—';
    var p = iso.slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function mesBR(chave, longo) { // chave 'AAAA-MM'
    var p = chave.split('-');
    return (longo ? NOMES_MES_LONGO : NOMES_MES)[+p[1] - 1] + (longo ? ' de ' : '/') + (longo ? p[0] : p[0].slice(2));
  }
  function dataHoraBR(isoCompleto) {
    if (!isoCompleto) return '—';
    var d = new Date(isoCompleto);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  SD.util = {
    normalizar: normalizar, hash: hash, hashBytes: hashBytes,
    parseNumero: parseNumero, arred: arred,
    parseData: parseData, detectarOrdemData: detectarOrdemData,
    hojeISO: hojeISO, addDias: addDias, diasEntre: diasEntre, pad: pad,
    moeda: moeda, moedaCurta: moedaCurta, inteiro: inteiro, pct: pct,
    dataBR: dataBR, mesBR: mesBR, dataHoraBR: dataHoraBR, escapar: escapar
  };
})(typeof window !== 'undefined' ? window : globalThis);

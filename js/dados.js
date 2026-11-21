/* SD Descontos — base de dados consolidada (dados.json), mesclagem sem
   duplicidade e cálculo dos indicadores. */
(function (root) {
  'use strict';
  var SD = root.SD = root.SD || {};
  var util = SD.util;

  var CHAVE_RASCUNHO = 'sd-descontos-rascunho-v1';
  var ORDEM = ['s', 'a', 'm'];
  var INFO = {
    s: { chave: 'shopee', nome: 'Shopee', cor: '#eb6834' },
    a: { chave: 'amazon', nome: 'Amazon', cor: '#2a78d6' },
    m: { chave: 'mercadolivre', nome: 'Mercado Livre', cor: '#1baf7a' }
  };

  function vazio() {
    return { versao: 1, empresa: 'SD Descontos', atualizadoEm: null, importacoes: [], registros: [] };
  }
  function validar(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.registros)) throw new Error('Arquivo de dados inválido.');
    obj.importacoes = obj.importacoes || [];
    return obj;
  }

  // ---------- Carregamento ----------
  async function carregarPublicado(caminho) {
    var resp = await fetch((caminho || 'data/dados.json') + '?t=' + Date.now(), { cache: 'no-store' });
    if (!resp.ok) throw new Error('Não foi possível carregar data/dados.json (' + resp.status + ').');
    return validar(await resp.json());
  }
  function lerRascunho() {
    try { var t = localStorage.getItem(CHAVE_RASCUNHO); return t ? validar(JSON.parse(t)) : null; }
    catch (e) { return null; }
  }
  function salvarRascunho(dados) {
    try { localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(dados)); return true; }
    catch (e) { return false; }
  }
  function apagarRascunho() { try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) { /* ignora */ } }

  // ---------- Mesclagem (sem duplicar) ----------
  function iguais(a, b) { return a.d === b.d && a.v === b.v && a.c === b.c && a.q === b.q && a.s === b.s && a.o === b.o && a.p === b.p; }

  function simularMescla(dados, registros) {
    var idx = new Map();
    dados.registros.forEach(function (r) { idx.set(r.k, r); });
    var novos = 0, atualizados = 0, iguaisN = 0;
    registros.forEach(function (r) {
      var ex = idx.get(r.k);
      if (!ex) novos++;
      else if (iguais(ex, r)) iguaisN++;
      else atualizados++;
    });
    return { novos: novos, atualizados: atualizados, semAlteracao: iguaisN };
  }

  function mesclar(dados, resultado, meta) {
    var idx = new Map();
    dados.registros.forEach(function (r, i) { idx.set(r.k, i); });
    var idImp = 'imp-' + Date.now().toString(36);
    var cont = simularMescla(dados, resultado.registros);
    resultado.registros.forEach(function (r) {
      var reg = Object.assign({}, r, { i: idImp });
      if (idx.has(r.k)) {
        var pos = idx.get(r.k);
        if (!iguais(dados.registros[pos], r)) dados.registros[pos] = reg;
      } else { idx.set(r.k, dados.registros.length); dados.registros.push(reg); }
    });
    var agora = new Date().toISOString();
    dados.importacoes.unshift({
      id: idImp, arquivo: meta.arquivo, plataforma: resultado.plataforma, importadoEm: agora,
      hashArquivo: meta.hash, linhas: resultado.linhasLidas, validos: resultado.registros.length,
      novos: cont.novos, atualizados: cont.atualizados, semAlteracao: cont.semAlteracao,
      erros: resultado.erros.length, periodo: resultado.periodo, indisponiveis: resultado.indisponiveis
    });
    dados.atualizadoEm = agora;
    dados.registros.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    return cont;
  }

  function removerImportacao(dados, idImp) {
    var antes = dados.registros.length;
    dados.registros = dados.registros.filter(function (r) { return r.i !== idImp; });
    dados.importacoes = dados.importacoes.filter(function (m) { return m.id !== idImp; });
    dados.atualizadoEm = new Date().toISOString();
    return antes - dados.registros.length;
  }

  // ---------- Indicadores ----------
  // Quais indicadores cada plataforma informa (com base em todos os registros dela)
  function disponibilidade(dados) {
    var d = {};
    ORDEM.forEach(function (p) { d[p] = { existe: false, vendas: false, comissoes: false, pedidos: false, itens: false }; });
    dados.registros.forEach(function (r) {
      var x = d[r.p]; if (!x) return;
      x.existe = true;
      if (r.v != null) x.vendas = true;
      if (r.c != null) x.comissoes = true;
      if (r.o) x.pedidos = true;
      if (r.q != null) x.itens = true;
    });
    return d;
  }

  function filtrar(dados, f) {
    return dados.registros.filter(function (r) {
      return (!f.de || r.d >= f.de) && (!f.ate || r.d <= f.ate) && (!f.plataformas || f.plataformas.indexOf(r.p) >= 0);
    });
  }

  function novoAcumulado() { return { vendas: 0, comissoes: 0, comissaoPendente: 0, itens: 0, pedidosSet: new Set(), cancelados: 0, registros: 0 }; }
  function acumular(ac, r) {
    if (r.s === 'canc') { ac.cancelados++; return; }
    ac.registros++;
    if (r.v != null) ac.vendas += r.v;
    if (r.c != null) { ac.comissoes += r.c; if (r.s === 'pend') ac.comissaoPendente += r.c; }
    if (r.q != null) ac.itens += r.q;
    if (r.o) ac.pedidosSet.add(r.o);
  }
  function fechar(ac) {
    return {
      vendas: util.arred(ac.vendas), comissoes: util.arred(ac.comissoes), comissaoPendente: util.arred(ac.comissaoPendente),
      itens: ac.itens, pedidos: ac.pedidosSet.size, cancelados: ac.cancelados, registros: ac.registros
    };
  }

  // Totais gerais + por plataforma de um conjunto de registros
  function resumir(registros) {
    var total = novoAcumulado(), por = {};
    ORDEM.forEach(function (p) { por[p] = novoAcumulado(); });
    registros.forEach(function (r) { acumular(total, r); if (por[r.p]) acumular(por[r.p], r); });
    var out = { total: fechar(total), plataformas: {} };
    ORDEM.forEach(function (p) { out.plataformas[p] = fechar(por[p]); });
    return out;
  }

  // Série temporal: granularidade 'dia' ou 'mes'
  function serie(registros, de, ate, granularidade, metrica, plataformas) {
    var rotulos = [];
    if (granularidade === 'mes') {
      var a = +de.slice(0, 4), m = +de.slice(5, 7), fa = +ate.slice(0, 4), fm = +ate.slice(5, 7);
      while (a < fa || (a === fa && m <= fm)) { rotulos.push(a + '-' + util.pad(m)); m++; if (m > 12) { m = 1; a++; } }
    } else {
      for (var d = de; d <= ate; d = util.addDias(d, 1)) rotulos.push(d);
    }
    var pos = {}; rotulos.forEach(function (r, i) { pos[r] = i; });
    var acs = {};
    plataformas.forEach(function (p) { acs[p] = rotulos.map(novoAcumulado); });
    registros.forEach(function (r) {
      var chave = granularidade === 'mes' ? r.d.slice(0, 7) : r.d;
      if (!(chave in pos) || !acs[r.p]) return;
      acumular(acs[r.p][pos[chave]], r);
    });
    return {
      rotulos: rotulos,
      series: plataformas.map(function (p) {
        return { p: p, nome: INFO[p].nome, cor: INFO[p].cor, valores: acs[p].map(function (ac) { return fechar(ac)[metrica]; }) };
      })
    };
  }

  // Tabela por mês ou por dia
  function agrupar(registros, granularidade) {
    var grupos = {};
    registros.forEach(function (r) {
      var k = granularidade === 'mes' ? r.d.slice(0, 7) : r.d;
      (grupos[k] = grupos[k] || []).push(r);
    });
    return Object.keys(grupos).sort().reverse().map(function (k) { return { chave: k, resumo: resumir(grupos[k]) }; });
  }

  function limitesDatas(dados) {
    if (!dados.registros.length) return null;
    var min = dados.registros[0].d, max = min;
    dados.registros.forEach(function (r) { if (r.d < min) min = r.d; if (r.d > max) max = r.d; });
    return { de: min, ate: max };
  }

  function exportarJSON(dados) {
    var limpo = {
      versao: 1, empresa: dados.empresa || 'SD Descontos', atualizadoEm: dados.atualizadoEm,
      importacoes: dados.importacoes,
      registros: dados.registros.map(function (r) {
        return { k: r.k, p: r.p, d: r.d, o: r.o || null, v: r.v, c: r.c, q: r.q, s: r.s, i: r.i };
      })
    };
    return JSON.stringify(limpo);
  }

  SD.dados = {
    ORDEM: ORDEM, INFO: INFO, vazio: vazio, validar: validar,
    carregarPublicado: carregarPublicado, lerRascunho: lerRascunho, salvarRascunho: salvarRascunho, apagarRascunho: apagarRascunho,
    simularMescla: simularMescla, mesclar: mesclar, removerImportacao: removerImportacao,
    disponibilidade: disponibilidade, filtrar: filtrar, resumir: resumir, serie: serie, agrupar: agrupar,
    limitesDatas: limitesDatas, exportarJSON: exportarJSON
  };
})(typeof window !== 'undefined' ? window : globalThis);

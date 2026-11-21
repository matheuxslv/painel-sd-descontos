/* SD Descontos — painel público (index.html) */
(function () {
  'use strict';
  var U = SD.util, D = SD.dados, G = SD.graficos;
  var $ = function (id) { return document.getElementById(id); };

  var dados, disp, limites;
  var estado = { periodo: 'tudo', de: null, ate: null, comparar: 'anterior', plataforma: 'todas', metrica: 'comissoes', gran: null, hist: 'mes', histTodos: false };

  var METRICAS = {
    comissoes: { nome: 'Comissões', fmt: U.moeda, eixo: U.moedaCurta },
    vendas: { nome: 'Vendas', fmt: U.moeda, eixo: U.moedaCurta },
    pedidos: { nome: 'Pedidos', fmt: U.inteiro, eixo: U.inteiro },
    itens: { nome: 'Itens', fmt: U.inteiro, eixo: U.inteiro }
  };

  // ---------- Datas ----------
  function deslocarMeses(iso, n) {
    var a = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n, d = +iso.slice(8, 10);
    a += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
    return a + '-' + U.pad(m + 1) + '-' + U.pad(Math.min(d, ultimo));
  }
  function fimDoMes(iso) { var a = +iso.slice(0, 4), m = +iso.slice(5, 7); return iso.slice(0, 8) + U.pad(new Date(Date.UTC(a, m, 0)).getUTCDate()); }

  function intervalo() {
    var hoje = U.hojeISO(), p = estado.periodo;
    if (p === 'tudo') return limites ? { de: limites.de, ate: limites.ate } : { de: hoje, ate: hoje };
    if (p === 'personalizado') {
      var de = estado.de || (limites && limites.de) || hoje, ate = estado.ate || (limites && limites.ate) || hoje;
      return de <= ate ? { de: de, ate: ate } : { de: ate, ate: de };
    }
    if (p === 'mes') return { de: hoje.slice(0, 8) + '01', ate: hoje };
    if (p === 'mesAnterior') { var ini = deslocarMeses(hoje.slice(0, 8) + '01', -1); return { de: ini, ate: fimDoMes(ini) }; }
    if (p === 'ano') return { de: hoje.slice(0, 4) + '-01-01', ate: hoje };
    return { de: U.addDias(hoje, -(+p - 1)), ate: hoje };
  }
  function intervaloComparacao(iv) {
    if (estado.comparar === 'nao' || estado.periodo === 'tudo') return null;
    if (estado.comparar === 'ano') return { de: deslocarMeses(iv.de, -12), ate: deslocarMeses(iv.ate, -12), rotulo: 'mesmo período do ano anterior' };
    if (estado.periodo === 'mes' || estado.periodo === 'mesAnterior') {
      var de = deslocarMeses(iv.de, -1);
      return { de: de, ate: estado.periodo === 'mesAnterior' ? fimDoMes(de) : deslocarMeses(iv.ate, -1), rotulo: 'mês anterior' };
    }
    var len = U.diasEntre(iv.de, iv.ate) + 1;
    return { de: U.addDias(iv.de, -len), ate: U.addDias(iv.de, -1), rotulo: 'período anterior' };
  }

  function plataformasSelecionadas() {
    var existentes = D.ORDEM.filter(function (p) { return disp[p].existe; });
    if (estado.plataforma === 'todas') return existentes;
    return [estado.plataforma];
  }

  // ---------- Controles ----------
  function montarControles() {
    var seg = $('fPlataforma');
    var opcoes = [{ v: 'todas', nome: 'Todas' }].concat(D.ORDEM.filter(function (p) { return disp[p].existe; }).map(function (p) { return { v: p, nome: D.INFO[p].nome, cor: D.INFO[p].cor }; }));
    seg.innerHTML = opcoes.map(function (o) {
      return '<button type="button" data-v="' + o.v + '">' + (o.cor ? '<i style="background:' + o.cor + '"></i>' : '') + U.escapar(o.nome) + '</button>';
    }).join('');
    var met = $('fMetrica');
    met.innerHTML = Object.keys(METRICAS).map(function (k) { return '<button type="button" data-v="' + k + '">' + METRICAS[k].nome + '</button>'; }).join('');

    function segmentado(elm, chave) {
      elm.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        estado[chave] = b.dataset.v;
        if (chave === 'hist') estado.histTodos = false;
        render();
      });
    }
    segmentado(seg, 'plataforma'); segmentado(met, 'metrica'); segmentado($('fGranularidade'), 'gran'); segmentado($('fHistorico'), 'hist');

    $('fPeriodo').addEventListener('change', function () {
      estado.periodo = this.value; estado.gran = null;
      if (this.value === 'personalizado') {
        var iv = intervalo();
        $('fDe').value = estado.de || iv.de; $('fAte').value = estado.ate || iv.ate;
      }
      render();
    });
    $('fDe').addEventListener('change', function () { estado.de = this.value || null; estado.gran = null; render(); });
    $('fAte').addEventListener('change', function () { estado.ate = this.value || null; estado.gran = null; render(); });
    $('fComparar').addEventListener('change', function () { estado.comparar = this.value; render(); });
    $('bMaisHistorico').addEventListener('click', function () { estado.histTodos = true; renderHistorico(); });

    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(renderEvolucao, 150); });
  }

  function marcar(id, valor) {
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === valor)); });
  }

  // ---------- Indicadores ----------
  function variacao(atual, anterior, temComparacao) {
    if (!temComparacao) return '';
    if (!anterior) return '<span>sem base de comparação</span>';
    var v = (atual - anterior) / Math.abs(anterior);
    var cls = v > 0.0005 ? 'sobe' : v < -0.0005 ? 'desce' : '';
    var seta = v > 0.0005 ? '▲ ' : v < -0.0005 ? '▼ ' : '';
    return '<span class="variacao ' + cls + '">' + seta + U.pct(Math.abs(v)) + '</span> vs ' + temComparacao;
  }

  function kpi(rotulo, valorHtml, rodape, nd) {
    return '<article class="cartao kpi"><span class="kpi-rotulo">' + rotulo + '</span>' +
      '<span class="kpi-valor' + (nd ? ' nd' : '') + '">' + valorHtml + '</span>' +
      '<span class="kpi-rodape">' + (rodape || '&nbsp;') + '</span></article>';
  }

  function nomesSem(plats, campo) {
    return plats.filter(function (p) { return !disp[p][campo]; }).map(function (p) { return D.INFO[p].nome; });
  }

  var iv, ivc, resumo, resumoComp, regPeriodo;

  function renderKPIs() {
    var plats = plataformasSelecionadas();
    var t = resumo.total, tc = resumoComp ? resumoComp.total : null;
    var temComp = ivc ? (resumoComp.total.registros > 0 ? ivc.rotulo : 'semdados') : null;
    function varia(campo) {
      if (temComp === 'semdados') return '<span>sem dados no ' + ivc.rotulo + '</span>';
      return variacao(t[campo], tc && tc[campo], temComp);
    }
    function algum(campo) { return plats.some(function (p) { return disp[p][campo]; }); }
    function falta(campo, txt) { var f = nomesSem(plats, campo); return f.length && algum(campo) ? '<br>' + f.join(', ') + ' não ' + (f.length > 1 ? 'informam' : 'informa') + ' ' + txt : ''; }
    var html = '';
    html += algum('vendas') ? kpi('Faturamento em vendas', U.moeda(t.vendas), varia('vendas') + falta('vendas', 'vendas')) : kpi('Faturamento em vendas', 'Não disponível nos relatórios', '', true);
    html += algum('comissoes') ? kpi('Comissões geradas', U.moeda(t.comissoes), varia('comissoes') + (t.comissaoPendente > 0 ? '<br>' + U.moeda(t.comissaoPendente) + ' ainda pendente' : '')) : kpi('Comissões geradas', 'Não disponível nos relatórios', '', true);
    html += algum('pedidos') ? kpi('Pedidos realizados', U.inteiro(t.pedidos), varia('pedidos') + falta('pedidos', 'nº de pedidos')) : kpi('Pedidos realizados', 'Não disponível nos relatórios', '', true);
    html += algum('itens') ? kpi('Produtos vendidos', U.inteiro(t.itens), varia('itens') + falta('itens', 'quantidade')) : kpi('Produtos vendidos', 'Não disponível nos relatórios', '', true);
    // ticket médio: só com plataformas que têm vendas e pedidos
    var pt = plats.filter(function (p) { return disp[p].vendas && disp[p].pedidos; });
    if (pt.length) {
      var v = 0, n = 0, vc = 0, nc = 0;
      pt.forEach(function (p) { v += resumo.plataformas[p].vendas; n += resumo.plataformas[p].pedidos; if (resumoComp) { vc += resumoComp.plataformas[p].vendas; nc += resumoComp.plataformas[p].pedidos; } });
      var tm = n ? v / n : null, tmc = nc ? vc / nc : null;
      var rod = temComp === 'semdados' ? '<span>sem dados no ' + ivc.rotulo + '</span>' : (tm != null ? variacao(tm, tmc, temComp) : 'sem pedidos no período');
      if (pt.length < plats.length) rod += '<br>Considera apenas ' + pt.map(function (p) { return D.INFO[p].nome; }).join(', ');
      html += kpi('Ticket médio por pedido', tm == null ? '—' : U.moeda(tm), rod);
    }
    $('kpis').innerHTML = html;
  }

  // ---------- Gráfico de evolução ----------
  function renderEvolucao() {
    if (!resumo) return;
    var plats = plataformasSelecionadas().filter(function (p) { return disp[p][estado.metrica]; });
    var dias = U.diasEntre(iv.de, iv.ate) + 1;
    var gran = estado.gran || (dias > 62 ? 'mes' : 'dia');
    if (gran === 'dia' && dias > 400) gran = 'mes';
    marcar('fGranularidade', gran); marcar('fMetrica', estado.metrica);
    var m = METRICAS[estado.metrica];
    $('evolucaoSub').textContent = m.nome + ' por ' + (gran === 'mes' ? 'mês' : 'dia') + ' · ' + U.dataBR(iv.de) + ' a ' + U.dataBR(iv.ate);
    if (!plats.length) { $('gEvolucao').innerHTML = '<p class="nd" style="padding:40px 0;text-align:center">Este indicador não está disponível nos relatórios da plataforma selecionada.</p>'; return; }
    var s = D.serie(regPeriodo, iv.de, iv.ate, gran, estado.metrica, plats);
    G.linha($('gEvolucao'), {
      titulo: m.nome + ' por ' + gran,
      rotulos: s.rotulos, series: s.series, formato: m.fmt, formatoEixo: m.eixo,
      rotuloX: function (r) { return gran === 'mes' ? U.mesBR(r) : r.slice(8, 10) + '/' + r.slice(5, 7); },
      rotuloDica: function (r) { return gran === 'mes' ? U.mesBR(r, true) : U.dataBR(r); }
    });
  }

  // ---------- Comparativo / distribuição / tabela ----------
  function renderComparativo() {
    var todas = D.ORDEM.filter(function (p) { return disp[p].existe; });
    var r = D.resumir(D.filtrar(dados, { de: iv.de, ate: iv.ate }));
    function itens(campo, rotulo) {
      return todas.map(function (p) {
        return { nome: D.INFO[p].nome, cor: D.INFO[p].cor, valor: disp[p][campo] ? r.plataformas[p][campo] : null, rotulo: rotulo };
      });
    }
    G.barras($('gCompVendas'), itens('vendas', 'Vendas'), U.moeda);
    G.barras($('gCompComissoes'), itens('comissoes', 'Comissões'), U.moeda);
    G.barras($('gCompPedidos'), itens('pedidos', 'Pedidos'), U.inteiro);
    G.rosca($('gRosca'), todas.map(function (p) {
      return { nome: D.INFO[p].nome, cor: D.INFO[p].cor, valor: disp[p].comissoes ? r.plataformas[p].comissoes : null };
    }), U.moeda, 'em comissões');

    // tabela de desempenho
    var totalCom = r.total.comissoes;
    function cel(p, campo, fmt) { return disp[p][campo] ? fmt(r.plataformas[p][campo]) : '<span class="nd">n/d</span>'; }
    var linhas = todas.map(function (p) {
      var x = r.plataformas[p];
      var ticket = disp[p].vendas && disp[p].pedidos && x.pedidos ? U.moeda(x.vendas / x.pedidos) : '<span class="nd">n/d</span>';
      return '<tr><td><span class="plat"><i class="ponto" style="background:' + D.INFO[p].cor + '"></i>' + D.INFO[p].nome + '</span></td>' +
        '<td class="num">' + cel(p, 'vendas', U.moeda) + '</td><td class="num">' + cel(p, 'pedidos', U.inteiro) + '</td>' +
        '<td class="num">' + cel(p, 'itens', U.inteiro) + '</td><td class="num">' + ticket + '</td>' +
        '<td class="num">' + cel(p, 'comissoes', U.moeda) + '</td>' +
        '<td class="num">' + (disp[p].comissoes && totalCom > 0 ? U.pct(x.comissoes / totalCom) : '<span class="nd">—</span>') + '</td>' +
        '<td class="num">' + (disp[p].comissoes ? U.moeda(x.comissaoPendente) : '<span class="nd">n/d</span>') + '</td></tr>';
    }).join('');
    $('tPlataformas').innerHTML = '<thead><tr><th>Plataforma</th><th class="num">Vendas</th><th class="num">Pedidos</th><th class="num">Itens</th><th class="num">Ticket médio</th><th class="num">Comissões</th><th class="num">% comissões</th><th class="num">Pendente</th></tr></thead><tbody>' + linhas + '</tbody>' +
      (todas.length > 1 ? '<tfoot><tr><td>Total</td><td class="num">' + U.moeda(r.total.vendas) + '</td><td class="num">' + U.inteiro(r.total.pedidos) + '</td><td class="num">' + U.inteiro(r.total.itens) + '</td><td class="num">—</td><td class="num">' + U.moeda(r.total.comissoes) + '</td><td class="num">' + (totalCom > 0 ? '100%' : '—') + '</td><td class="num">' + U.moeda(r.total.comissaoPendente) + '</td></tr></tfoot>' : '');
    var notas = [];
    todas.forEach(function (p) {
      var f = ['vendas', 'pedidos', 'itens', 'comissoes'].filter(function (c) { return !disp[p][c]; });
      if (f.length) notas.push(D.INFO[p].nome + ' não informa: ' + f.map(function (c) { return { vendas: 'vendas', pedidos: 'nº de pedidos', itens: 'quantidade de itens', comissoes: 'comissões' }[c]; }).join(', '));
    });
    if (r.total.cancelados) notas.push(U.inteiro(r.total.cancelados) + ' registro(s) cancelado(s) no período não entram nos totais');
    $('notaPlataformas').innerHTML = notas.length ? 'n/d = não disponível no relatório. ' + notas.join(' · ') + '.' : '';
  }

  function renderHistorico() {
    marcar('fHistorico', estado.hist);
    var plats = plataformasSelecionadas();
    var grupos = D.agrupar(D.filtrar(dados, { plataformas: plats }), estado.hist);
    var limite = estado.histTodos ? grupos.length : (estado.hist === 'mes' ? 24 : 31);
    var algum = function (c) { return plats.some(function (p) { return disp[p][c]; }); };
    var colunas = [['vendas', 'Vendas', U.moeda], ['pedidos', 'Pedidos', U.inteiro], ['itens', 'Itens', U.inteiro], ['comissoes', 'Comissões', U.moeda]].filter(function (c) { return algum(c[0]); });
    var html = '<thead><tr><th>' + (estado.hist === 'mes' ? 'Mês' : 'Dia') + '</th>' + colunas.map(function (c) { return '<th class="num">' + c[1] + '</th>'; }).join('') + (algum('comissoes') ? '<th class="num">Variação comissões</th>' : '') + '</tr></thead><tbody>';
    html += grupos.slice(0, limite).map(function (g, i) {
      var t = g.resumo.total, ant = grupos[i + 1] ? grupos[i + 1].resumo.total : null;
      var v = '';
      if (algum('comissoes')) {
        if (ant && ant.comissoes) {
          var x = (t.comissoes - ant.comissoes) / Math.abs(ant.comissoes);
          v = '<span class="variacao ' + (x > 0 ? 'sobe' : x < 0 ? 'desce' : '') + '">' + (x > 0 ? '▲ ' : x < 0 ? '▼ ' : '') + U.pct(Math.abs(x)) + '</span>';
        } else v = '<span class="nd">—</span>';
        v = '<td class="num">' + v + '</td>';
      }
      var rot = estado.hist === 'mes' ? U.mesBR(g.chave, true) : U.dataBR(g.chave);
      return '<tr class="clicavel" data-k="' + g.chave + '" tabindex="0"><td>' + rot.charAt(0).toUpperCase() + rot.slice(1) + '</td>' +
        colunas.map(function (c) { return '<td class="num">' + c[2](t[c[0]]) + '</td>'; }).join('') + v + '</tr>';
    }).join('') + '</tbody>';
    $('tHistorico').innerHTML = html;
    $('bMaisHistorico').classList.toggle('oculto', grupos.length <= limite);
    $('bMaisHistorico').textContent = 'Mostrar tudo (' + grupos.length + ')';
    Array.prototype.forEach.call($('tHistorico').querySelectorAll('tr.clicavel'), function (tr) {
      function ir() {
        var k = tr.dataset.k;
        estado.periodo = 'personalizado';
        estado.de = k.length === 7 ? k + '-01' : k;
        estado.ate = k.length === 7 ? fimDoMes(k + '-01') : k;
        estado.gran = null;
        $('fPeriodo').value = 'personalizado'; $('fDe').value = estado.de; $('fAte').value = estado.ate;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      tr.addEventListener('click', ir);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') ir(); });
    });
  }

  // ---------- Render principal ----------
  function render() {
    G.esconderDica();
    var pers = estado.periodo === 'personalizado';
    $('cDe').classList.toggle('oculto', !pers); $('cAte').classList.toggle('oculto', !pers);
    $('fComparar').disabled = estado.periodo === 'tudo';
    marcar('fPlataforma', estado.plataforma);
    iv = intervalo(); ivc = intervaloComparacao(iv);
    var plats = plataformasSelecionadas();
    regPeriodo = D.filtrar(dados, { de: iv.de, ate: iv.ate, plataformas: plats });
    resumo = D.resumir(regPeriodo);
    resumoComp = ivc ? D.resumir(D.filtrar(dados, { de: ivc.de, ate: ivc.ate, plataformas: plats })) : null;
    var txt = 'Exibindo <strong>' + U.dataBR(iv.de) + '</strong> a <strong>' + U.dataBR(iv.ate) + '</strong>';
    if (ivc) txt += ' · comparado com ' + U.dataBR(ivc.de) + ' a ' + U.dataBR(ivc.ate);
    if (!regPeriodo.length) txt += ' · <span class="nd">nenhum registro neste período</span>';
    $('periodoTexto').innerHTML = txt;
    renderKPIs(); renderEvolucao(); renderComparativo(); renderHistorico();
  }

  // ---------- Inicialização ----------
  async function iniciar() {
    $('ano').textContent = new Date().getFullYear();
    var previa = /[?&]previa=1/.test(location.search);
    try {
      if (previa) {
        dados = D.lerRascunho();
        if (!dados) dados = await D.carregarPublicado();
        else $('avisoPrevia').classList.remove('oculto');
      } else {
        dados = await D.carregarPublicado();
      }
    } catch (e) {
      $('avisoErro').textContent = location.protocol === 'file:'
        ? 'Abra o painel pelo endereço do GitHub Pages (ou por um servidor local). Ao abrir o arquivo index.html direto do computador, o navegador bloqueia a leitura de data/dados.json.'
        : 'Não foi possível carregar os dados do painel. Tente atualizar a página. (' + e.message + ')';
      $('avisoErro').classList.remove('oculto');
      $('ultimaAtualizacao').textContent = 'Dados indisponíveis';
      return;
    }
    var ua = $('ultimaAtualizacao');
    ua.textContent = dados.atualizadoEm ? 'Dados atualizados em ' + U.dataHoraBR(dados.atualizadoEm) : 'Sem dados publicados';
    ua.classList.toggle('sem', !dados.atualizadoEm);
    if (!dados.registros.length) { $('estadoVazio').classList.remove('oculto'); return; }
    disp = D.disponibilidade(dados);
    limites = D.limitesDatas(dados);
    $('conteudo').classList.remove('oculto');
    montarControles();
    render();
  }
  iniciar();
})();

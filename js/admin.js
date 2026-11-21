/* SD Descontos — área administrativa (admin.html) */
(function () {
  'use strict';
  var U = SD.util, D = SD.dados, P = SD.plataformas, L = SD.leitores;
  var $ = function (id) { return document.getElementById(id); };
  var esc = U.escapar;
  var CHAVE_MAPAS = 'sd-descontos-mapas-v1';

  var atual = D.vazio(), publicado = null, temRascunho = false, previas = [], seq = 0;

  // ---------- Mapeamentos de colunas memorizados ----------
  function assinaturaCabecalho(plat, cabecalhos) { return plat + '|' + U.hash(cabecalhos.map(U.normalizar).join('|')); }
  function lerMapas() { try { return JSON.parse(localStorage.getItem(CHAVE_MAPAS)) || {}; } catch (e) { return {}; } }
  function salvarMapa(chave, mapa) { var m = lerMapas(); m[chave] = mapa; try { localStorage.setItem(CHAVE_MAPAS, JSON.stringify(m)); } catch (e) { /* ignora */ } }

  // ---------- Persistência ----------
  function persistir() {
    temRascunho = true;
    if (!D.salvarRascunho(atual)) aviso('erro', 'O navegador não conseguiu guardar os dados localmente (memória cheia ou modo anônimo). Baixe o dados.json agora para não perder a importação.');
    renderDados(); renderImportacoes();
  }
  var avisosTemp = [];
  function aviso(tipo, html) { avisosTemp.push({ tipo: tipo, html: html }); renderDados(); }

  // ---------- Situação ----------
  function renderDados() {
    var lim = D.limitesDatas(atual);
    var r = D.resumir(atual.registros).total;
    var porPlat = D.ORDEM.map(function (p) { return { p: p, n: atual.registros.filter(function (x) { return x.p === p; }).length }; }).filter(function (x) { return x.n; });
    $('fonteDados').innerHTML = temRascunho
      ? 'Usando os dados importados neste navegador · <strong>alterações ainda não publicadas</strong>'
      : (publicado ? 'Usando o dados.json publicado no site' : 'Nenhum dado publicado encontrado');
    var avs = avisosTemp.map(function (a) { return '<div class="aviso ' + a.tipo + '">' + a.html + '</div>'; });
    if (temRascunho) avs.push('<div class="aviso alerta">Há alterações que ainda não estão no painel público. Para publicá-las, clique em <strong>Baixar dados.json</strong> e envie o arquivo para a pasta <code>data</code> do repositório no GitHub.</div>');
    if (!publicado && location.protocol === 'file:') avs.push('<div class="aviso info">Você abriu esta página direto do computador, então o dados.json publicado não pôde ser lido. Se já existem dados publicados, use <strong>Abrir dados.json do computador</strong> antes de importar, para não começar do zero.</div>');
    $('avisosDados').innerHTML = avs.join('');
    $('bDescartar').classList.toggle('oculto', !temRascunho);
    $('numerosDados').innerHTML =
      '<div><span>Última atualização</span><b>' + (atual.atualizadoEm ? U.dataHoraBR(atual.atualizadoEm) : '—') + '</b></div>' +
      '<div><span>Período coberto</span><b>' + (lim ? U.dataBR(lim.de) + ' a ' + U.dataBR(lim.ate) : '—') + '</b></div>' +
      '<div><span>Registros</span><b>' + U.inteiro(atual.registros.length) + '</b></div>' +
      '<div><span>Por plataforma</span><b style="font-size:14px">' + (porPlat.length ? porPlat.map(function (x) { return D.INFO[x.p].nome + ': ' + U.inteiro(x.n); }).join('<br>') : '—') + '</b></div>' +
      '<div><span>Comissões (total)</span><b>' + U.moeda(r.comissoes) + '</b></div>';
    $('bBaixar').disabled = !atual.registros.length && !temRascunho;
  }

  function renderImportacoes() {
    var t = $('tImportacoes');
    if (!atual.importacoes.length) { t.innerHTML = '<tbody><tr><td class="nd" style="white-space:normal">Nenhum arquivo importado ainda.</td></tr></tbody>'; return; }
    t.innerHTML = '<thead><tr><th>Importado em</th><th>Arquivo</th><th>Plataforma</th><th>Período do relatório</th><th class="num">Linhas</th><th class="num">Novos</th><th class="num">Atualizados</th><th class="num">Sem alteração</th><th class="num">Erros</th><th></th></tr></thead><tbody>' +
      atual.importacoes.map(function (m) {
        var info = P.PLATAFORMAS[m.plataforma];
        return '<tr><td>' + U.dataHoraBR(m.importadoEm) + '</td><td style="white-space:normal;word-break:break-all;min-width:160px">' + esc(m.arquivo) + '</td>' +
          '<td>' + (info ? info.nome : esc(m.plataforma)) + '</td>' +
          '<td>' + (m.periodo && m.periodo.de ? U.dataBR(m.periodo.de) + ' a ' + U.dataBR(m.periodo.ate) : '—') + '</td>' +
          '<td class="num">' + U.inteiro(m.linhas) + '</td><td class="num">' + U.inteiro(m.novos) + '</td><td class="num">' + U.inteiro(m.atualizados) + '</td><td class="num">' + U.inteiro(m.semAlteracao) + '</td>' +
          '<td class="num">' + (m.erros ? '<span class="etiqueta alerta">' + m.erros + '</span>' : '<span class="etiqueta ok">0</span>') + '</td>' +
          '<td><button type="button" class="botao pequeno perigo" data-remover="' + esc(m.id) + '">Remover</button></td></tr>';
      }).join('') + '</tbody>';
  }

  $('tImportacoes').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-remover]'); if (!b) return;
    var m = atual.importacoes.find(function (x) { return x.id === b.dataset.remover; });
    if (!m || !confirm('Remover os registros importados pelo arquivo "' + m.arquivo + '"?\n\nRegistros que foram atualizados por importações posteriores continuam.')) return;
    var n = D.removerImportacao(atual, m.id);
    avisosTemp = [{ tipo: 'ok', html: U.inteiro(n) + ' registro(s) removido(s).' }];
    persistir();
  });

  // ---------- Prévia de importação ----------
  async function adicionarArquivos(lista) {
    for (var i = 0; i < lista.length; i++) {
      var arq = lista[i];
      var pv = { id: ++seq, arquivo: arq.name, plataformaForcada: $('fPlataforma').value || null };
      previas.unshift(pv);
      renderPrevias();
      try {
        pv.lido = await L.lerArquivo(arq);
        processar(pv);
      } catch (e) {
        pv.erroFatal = e.message || String(e);
      }
      renderPrevias();
    }
  }

  function processar(pv, mapa) {
    pv.erroFatal = null; pv.resultado = null;
    try {
      var id = P.identificar(pv.lido.planilhas, pv.arquivo, pv.plataformaForcada);
      if (!id) throw new Error('Não encontrei uma tabela com cabeçalho neste arquivo.');
      pv.identificacao = id;
      pv.plataforma = pv.plataformaForcada || id.plataforma;
      var cab = pv.lido.planilhas[id.planilha].linhas[id.linhaCabecalho].map(function (v) { return v == null ? '' : String(v); });
      pv.cabecalhos = cab;
      pv.assinatura = assinaturaCabecalho(pv.plataforma, cab);
      if (!mapa) mapa = lerMapas()[pv.assinatura] || P.mapearColunas(cab, pv.plataforma);
      pv.mapa = mapa;
      pv.resultado = P.interpretar(pv.lido.planilhas, { identificacao: id, plataforma: pv.plataforma, mapa: mapa, nomeArquivo: pv.arquivo });
      pv.simulacao = D.simularMescla(atual, pv.resultado.registros);
    } catch (e) { pv.erroFatal = e.message || String(e); }
  }

  function renderPrevias() {
    $('previas').innerHTML = previas.map(htmlPrevia).join('');
  }

  function htmlPrevia(pv) {
    var h = '<div class="previa" data-id="' + pv.id + '"><div class="previa-topo"><div><div class="previa-arquivo">' + esc(pv.arquivo) + '</div>';
    if (!pv.lido && !pv.erroFatal) return h + '<div class="previa-meta">Lendo arquivo…</div></div></div></div>';
    if (!pv.lido) return h + '</div><button type="button" class="botao pequeno" data-acao="descartar">Fechar</button></div><div class="aviso erro" style="margin-top:10px">' + esc(pv.erroFatal) + '</div></div>';
    var r = pv.resultado;
    h += '<div class="previa-meta">' + (pv.lido.formato === 'xlsx' ? 'Excel' : 'CSV') + (pv.identificacao && pv.lido.planilhas.length > 1 ? ' · aba "' + esc(pv.lido.planilhas[pv.identificacao.planilha].nome) + '"' : '') +
      (pv.identificacao ? ' · cabeçalho na linha ' + (pv.identificacao.linhaCabecalho + 1) : '') + '</div></div>';
    h += '<label class="campo"><span>Plataforma</span><select data-acao="plataforma">' +
      Object.keys(P.PLATAFORMAS).map(function (k) { return '<option value="' + k + '"' + (k === pv.plataforma ? ' selected' : '') + '>' + P.PLATAFORMAS[k].nome + '</option>'; }).join('') + '</select></label></div>';

    var avisos = [];
    var dup = atual.importacoes.find(function (m) { return m.hashArquivo === pv.lido.hash; });
    if (dup) avisos.push(['alerta', 'Este mesmo arquivo já foi importado em ' + U.dataHoraBR(dup.importadoEm) + '. Se importar de novo, nenhum registro será duplicado.']);
    if (pv.identificacao && !pv.identificacao.confiavel && !pv.plataformaForcada) avisos.push(['alerta', 'Não tenho certeza de qual plataforma é este relatório. Confira a plataforma acima e o mapeamento de colunas abaixo.']);
    if (pv.erroFatal) avisos.push(['erro', esc(pv.erroFatal)]);
    if (r) r.avisos.forEach(function (a) { avisos.push(['info', esc(a)]); });
    if (r && r.indisponiveis.length) avisos.push(['info', 'Indicadores não disponíveis neste relatório: ' + r.indisponiveis.map(function (c) { return { vendas: 'vendas', comissoes: 'comissões', pedidos: 'nº de pedidos', itens: 'quantidade de itens' }[c]; }).join(', ') + '. Eles não serão estimados.']);
    if (avisos.length) h += '<div style="margin-top:12px">' + avisos.map(function (a) { return '<div class="aviso ' + a[0] + '">' + a[1] + '</div>'; }).join('') + '</div>';

    if (r) {
      var s = D.resumir(r.registros).total;
      h += '<div class="numeros">' +
        '<div><span>Linhas lidas</span><b>' + U.inteiro(r.linhasLidas) + '</b></div>' +
        '<div><span>Registros válidos</span><b>' + U.inteiro(r.registros.length) + '</b></div>' +
        '<div><span>Linhas com erro</span><b>' + U.inteiro(r.erros.length) + '</b></div>' +
        '<div><span>Período</span><b style="font-size:14px">' + (r.periodo.de ? U.dataBR(r.periodo.de) + '<br>a ' + U.dataBR(r.periodo.ate) : '—') + '</b></div>' +
        '<div><span>Novos</span><b>' + U.inteiro(pv.simulacao.novos) + '</b></div>' +
        '<div><span>Atualizados</span><b>' + U.inteiro(pv.simulacao.atualizados) + '</b></div>' +
        '<div><span>Já existentes</span><b>' + U.inteiro(pv.simulacao.semAlteracao) + '</b></div>' +
        (r.indisponiveis.indexOf('vendas') < 0 ? '<div><span>Vendas no arquivo</span><b>' + U.moeda(s.vendas) + '</b></div>' : '') +
        (r.indisponiveis.indexOf('comissoes') < 0 ? '<div><span>Comissões no arquivo</span><b>' + U.moeda(s.comissoes) + '</b></div>' : '') +
        (r.indisponiveis.indexOf('pedidos') < 0 ? '<div><span>Pedidos</span><b>' + U.inteiro(s.pedidos) + '</b></div>' : '') +
        (s.cancelados ? '<div><span>Cancelados (fora dos totais)</span><b>' + U.inteiro(s.cancelados) + '</b></div>' : '') +
        '</div>';
    }
    if (pv.cabecalhos) {
      var exemplo = pv.lido.planilhas[pv.identificacao.planilha].linhas[pv.identificacao.linhaCabecalho + 1] || [];
      var abrir = pv.erroFatal || !pv.identificacao.confiavel;
      h += '<details' + (abrir ? ' open' : '') + '><summary>Mapeamento de colunas (como o sistema leu o arquivo)</summary><div class="mapeamento">' +
        Object.keys(P.CAMPOS).filter(function (c) { return P.PLATAFORMAS[pv.plataforma].colunas[c] || pv.mapa[c] >= 0; }).map(function (campo) {
          var idx = pv.mapa[campo];
          return '<label>' + P.CAMPOS[campo] + '<select data-acao="mapa" data-campo="' + campo + '"><option value="-1">— não usar —</option>' +
            pv.cabecalhos.map(function (c, i) { return c ? '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + esc(c) + '</option>' : ''; }).join('') +
            '</select><small>' + (idx >= 0 ? 'Ex.: ' + esc(exemplo[idx] == null || exemplo[idx] === '' ? '(vazio)' : exemplo[idx]) : '&nbsp;') + '</small></label>';
        }).join('') + '</div></details>';
    }
    if (r && r.erros.length) {
      h += '<details><summary>Ver linhas com erro (' + r.erros.length + ')</summary><ul class="lista-erros">' +
        r.erros.slice(0, 200).map(function (e) { return '<li>Linha ' + e.linha + ': ' + esc(e.motivo) + '</li>'; }).join('') +
        (r.erros.length > 200 ? '<li>… e mais ' + (r.erros.length - 200) + '</li>' : '') + '</ul></details>';
    }
    h += '<div class="acoes" style="margin-top:14px"><button type="button" class="botao primario" data-acao="importar"' + (!r || !r.registros.length ? ' disabled' : '') + '>Importar ' + (r ? U.inteiro(r.registros.length) + ' registro(s)' : '') + '</button>' +
      '<button type="button" class="botao" data-acao="descartar">Cancelar</button></div></div>';
    return h;
  }

  function previaDe(elm) {
    var box = elm.closest('.previa'); if (!box) return null;
    var id = +box.dataset.id;
    return previas.find(function (p) { return p.id === id; });
  }

  $('previas').addEventListener('change', function (ev) {
    var pv = previaDe(ev.target); if (!pv) return;
    var acao = ev.target.dataset.acao;
    if (acao === 'plataforma') { pv.plataformaForcada = ev.target.value; processar(pv); }
    if (acao === 'mapa') {
      var mapa = Object.assign({}, pv.mapa);
      mapa[ev.target.dataset.campo] = +ev.target.value;
      processar(pv, mapa);
    }
    renderPrevias();
  });
  $('previas').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-acao]'); if (!b) return;
    var pv = previaDe(b); if (!pv) return;
    if (b.dataset.acao === 'descartar') previas = previas.filter(function (p) { return p !== pv; });
    if (b.dataset.acao === 'importar' && pv.resultado) {
      salvarMapa(pv.assinatura, pv.mapa);
      var c = D.mesclar(atual, pv.resultado, { arquivo: pv.arquivo, hash: pv.lido.hash });
      previas = previas.filter(function (p) { return p !== pv; });
      previas.forEach(function (p) { if (p.resultado) p.simulacao = D.simularMescla(atual, p.resultado.registros); });
      avisosTemp = [{ tipo: 'ok', html: '<span><strong>' + esc(pv.arquivo) + '</strong> importado: ' + U.inteiro(c.novos) + ' novo(s), ' + U.inteiro(c.atualizados) + ' atualizado(s), ' + U.inteiro(c.semAlteracao) + ' já existente(s).</span>' }];
      persistir();
    }
    renderPrevias();
  });

  // ---------- Arquivos ----------
  var zona = $('zona');
  $('iArquivos').addEventListener('change', function () { adicionarArquivos(Array.prototype.slice.call(this.files)); this.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) { zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.add('arrastando'); }); });
  ['dragleave', 'drop'].forEach(function (t) { zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.remove('arrastando'); }); });
  zona.addEventListener('drop', function (e) { adicionarArquivos(Array.prototype.slice.call(e.dataTransfer.files)); });

  // ---------- Botões de dados ----------
  $('bBaixar').addEventListener('click', function () {
    var blob = new Blob([D.exportarJSON(atual)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'dados.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    avisosTemp = [{ tipo: 'ok', html: 'Arquivo <strong>dados.json</strong> baixado. Agora envie-o para a pasta <code>data</code> do repositório no GitHub (veja o passo a passo no fim da página).' }];
    renderDados();
  });
  $('iJson').addEventListener('change', async function () {
    var f = this.files[0]; this.value = '';
    if (!f) return;
    try {
      var obj = D.validar(JSON.parse(await f.text()));
      if (atual.registros.length && !confirm('Substituir os dados atuais deste navegador pelo conteúdo de "' + f.name + '"?')) return;
      atual = obj;
      avisosTemp = [{ tipo: 'ok', html: 'Dados carregados de <strong>' + esc(f.name) + '</strong>.' }];
      persistir();
      previas.forEach(function (p) { if (p.resultado) p.simulacao = D.simularMescla(atual, p.resultado.registros); });
      renderPrevias();
    } catch (e) { aviso('erro', 'Não foi possível abrir este arquivo: ' + esc(e.message)); }
  });
  $('bDescartar').addEventListener('click', function () {
    if (!confirm('Descartar todas as importações que ainda não foram publicadas e voltar aos dados do site?')) return;
    D.apagarRascunho(); temRascunho = false;
    atual = publicado ? JSON.parse(JSON.stringify(publicado)) : D.vazio();
    avisosTemp = [{ tipo: 'ok', html: 'Alterações locais descartadas.' }];
    renderDados(); renderImportacoes();
  });

  // ---------- Início ----------
  async function iniciar() {
    try { publicado = await D.carregarPublicado(); } catch (e) { publicado = null; }
    var rasc = D.lerRascunho();
    if (rasc && publicado && rasc.atualizadoEm === publicado.atualizadoEm) { D.apagarRascunho(); rasc = null; }
    if (rasc) {
      atual = rasc; temRascunho = true;
      if (publicado && publicado.atualizadoEm && rasc.atualizadoEm && publicado.atualizadoEm > rasc.atualizadoEm)
        avisosTemp.push({ tipo: 'alerta', html: 'O dados.json publicado no site é mais recente que os dados guardados neste navegador. Se você atualizou o site por outro computador, clique em <strong>Descartar alterações não publicadas</strong> antes de importar.' });
    } else atual = publicado ? JSON.parse(JSON.stringify(publicado)) : D.vazio();
    renderDados(); renderImportacoes();
  }
  iniciar();
})();

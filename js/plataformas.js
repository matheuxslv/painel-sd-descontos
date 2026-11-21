/* SD Descontos — interpretação dos relatórios de cada plataforma.
   Cada plataforma tem a sua lista de nomes de coluna conhecidos (em português
   e inglês). Os nomes são comparados sem acentos, espaços ou símbolos, então
   "Comissão líquida do afiliado(R$)" vira "comissaoliquidadoafiliador".
   Se o relatório mudar de formato, basta acrescentar o novo nome aqui. */
(function (root) {
  'use strict';
  var SD = root.SD = root.SD || {};
  var util = SD.util;
  var N = util.normalizar;

  // Campos que o sistema entende
  var CAMPOS = {
    data:       'Data do pedido/venda',
    pedido:     'Número do pedido',
    item:       'Identificador do item/produto',
    modelo:     'Variação do item',
    valor:      'Valor da venda (R$)',
    preco:      'Preço unitário (R$)',
    quantidade: 'Quantidade de itens',
    comissao:   'Comissão (R$)',
    status:     'Status',
    devolucoes: 'Itens devolvidos'
  };

  var PLATAFORMAS = {
    shopee: {
      nome: 'Shopee', sigla: 's',
      arquivo: /shopee|affiliatecommission|commissionreport/,
      assinatura: ['iddopedido', 'horariodopedido', 'comissaoliquidadoafiliado', 'netaffiliatecommission', 'valordecompra', 'purchasevalue', 'iddaloja', 'shopid', 'nomedaloja', 'shopname', 'horariodoclique', 'clicktime', 'subid1', 'statusdoitemdoafiliado'],
      colunas: {
        data:       { exatos: ['horariodopedido', 'datadopedido', 'ordertime', 'purchasetime', 'orderdate', 'horariodecompra', 'tempodopedido'], contem: ['horariodopedido', 'datadopedido'] },
        pedido:     { exatos: ['iddopedido', 'orderid', 'numerodopedido', 'idpedido'], contem: ['iddopedido', 'orderid'] },
        item:       { exatos: ['iddoitem', 'itemid', 'iddoproduto', 'productid'] },
        modelo:     { exatos: ['iddomodelo', 'modelid'] },
        valor:      { exatos: ['valordecomprar', 'valordecompra', 'purchasevalue', 'purchasevaluer', 'valordocompra', 'itemvalue'], contem: ['valordecompra', 'purchasevalue'] },
        preco:      { exatos: ['precor', 'preco', 'price', 'pricer', 'itemprice'] },
        quantidade: { exatos: ['qtd', 'quantidade', 'qty', 'quantity'] },
        comissao:   { exatos: ['comissaoliquidadoafiliador', 'comissaoliquidadoafiliado', 'netaffiliatecommission', 'netaffiliatecommissionr', 'comissaodoafiliador', 'comissaodoafiliado'],
                      contem: ['comissaoliquida', 'netcommission', 'netaffiliatecommission', 'comissaototaldoitem', 'itemtotalcommission'], exclui: ['dopedido', 'order', 'taxa', 'rate'] },
        status:     { exatos: ['statusdopedido', 'orderstatus'], contem: ['statusdopedido', 'orderstatus'] }
      },
      dataOrdem: 'dmy'
    },
    amazon: {
      nome: 'Amazon', sigla: 'a',
      arquivo: /amazon|associates|earnings|fee-?earnings|ganhos/,
      assinatura: ['asin', 'trackingid', 'iddorastreamento', 'iddeacompanhamento', 'adfees', 'adfeesr', 'taxasdepublicidade', 'itemsshipped', 'itensenviados', 'dateshipped', 'datadeenvio', 'devicetypegroup', 'linktype', 'tipodelink'],
      colunas: {
        data:       { exatos: ['dateshipped', 'datadeenvio', 'dataenvio', 'datadoenvio', 'date', 'data', 'datadopedido', 'orderdate'], contem: ['dateshipped', 'datadeenvio', 'data'] , exclui: ['hora'] },
        item:       { exatos: ['asin'] },
        valor:      { exatos: ['revenue', 'revenuer', 'receita', 'receitar', 'receitabrl', 'revenuebrl', 'valordasvendas'], contem: ['revenue', 'receita'] },
        preco:      { exatos: ['price', 'pricer', 'preco', 'precor', 'pricebrl', 'precobrl'] },
        quantidade: { exatos: ['itemsshipped', 'itensenviados', 'qty', 'quantidade', 'quantity', 'itens', 'unidades', 'itensencomendados', 'itemsordered'], contem: ['itemsshipped', 'itensenviados'] },
        comissao:   { exatos: ['adfees', 'adfeesr', 'adfeesbrl', 'taxasdepublicidade', 'taxasdepublicidader', 'taxadepublicidade', 'comissao', 'comissaor', 'ganhos', 'earnings', 'fees'], contem: ['adfee', 'taxasdepublicidade', 'taxadepublicidade', 'comissao'], exclui: ['taxade comissao', 'rate'] },
        devolucoes: { exatos: ['returns', 'devolucoes', 'itensdevolvidos', 'returneditems'] }
      },
      dataOrdem: 'auto'
    },
    mercadolivre: {
      nome: 'Mercado Livre', sigla: 'm',
      arquivo: /mercado|meli|livre|\bml\b/,
      assinatura: ['iddavenda', 'numerodavenda', 'mlb', 'iddoanuncio', 'anuncio', 'comissaogerada', 'valordacomissao', 'suacomissao', 'ganhos', 'fecha', 'datadavenda', 'linkdeafiliado'],
      colunas: {
        data:       { exatos: ['datadavenda', 'datadacompra', 'datadopedido', 'data', 'fecha', 'date', 'fechadecompra', 'datadaconversao'], contem: ['datadavenda', 'datadacompra', 'datadopedido', 'data'], exclui: ['pagamento', 'liberacao', 'atualizacao'] },
        pedido:     { exatos: ['iddavenda', 'numerodavenda', 'iddopedido', 'idpedido', 'idvenda', 'numerodopedido', 'venda', 'orderid', 'ndavenda', 'nodavenda'], contem: ['iddavenda', 'numerodavenda', 'iddopedido', 'numerodopedido'] },
        item:       { exatos: ['iddoproduto', 'iddoanuncio', 'mlb', 'itemid', 'codigodoproduto', 'iddoitem', 'anuncio'], contem: ['iddoanuncio', 'iddoproduto'] },
        valor:      { exatos: ['valordavenda', 'valordacompra', 'valordoproduto', 'valortotal', 'totalvendido', 'valorvendido', 'faturamento', 'valordopedido', 'valor', 'preco', 'precototal'], contem: ['valordavenda', 'valordacompra', 'valortotal', 'valordopedido'], exclui: ['comissao', 'reembolso', 'frete'] },
        quantidade: { exatos: ['quantidade', 'unidades', 'qtd', 'quantity', 'itensvendidos'] },
        comissao:   { exatos: ['comissao', 'comissaor', 'comissaogerada', 'valordacomissao', 'suacomissao', 'ganhos', 'ganho', 'comissaototal', 'ganhosr'], contem: ['comissao', 'ganho'], exclui: ['taxa', 'percentual', 'porcentagem', 'rate'] },
        status:     { exatos: ['status', 'statusdavenda', 'estado', 'situacao', 'statusdacomissao', 'statusdopedido'], contem: ['status', 'situacao'], exclui: ['comprador'] }
      },
      dataOrdem: 'dmy'
    }
  };

  // ---------- Localização de colunas ----------
  function acharColuna(cabecalhosNorm, regra, usadas) {
    if (!regra) return -1;
    var exclui = (regra.exclui || []).map(N);
    function ok(i) { return usadas.indexOf(i) < 0 && !exclui.some(function (e) { return e && cabecalhosNorm[i].indexOf(e) >= 0; }); }
    var i, j;
    for (j = 0; j < (regra.exatos || []).length; j++)
      for (i = 0; i < cabecalhosNorm.length; i++)
        if (cabecalhosNorm[i] === regra.exatos[j] && usadas.indexOf(i) < 0) return i;
    for (j = 0; j < (regra.contem || []).length; j++)
      for (i = 0; i < cabecalhosNorm.length; i++)
        if (cabecalhosNorm[i] && cabecalhosNorm[i].indexOf(regra.contem[j]) >= 0 && ok(i)) return i;
    return -1;
  }

  function mapearColunas(cabecalhos, chavePlataforma) {
    var plat = PLATAFORMAS[chavePlataforma];
    var norm = cabecalhos.map(N), usadas = [], mapa = {};
    // ordem importa: campos mais específicos primeiro
    ['pedido', 'modelo', 'item', 'comissao', 'valor', 'preco', 'quantidade', 'devolucoes', 'status', 'data'].forEach(function (campo) {
      var idx = acharColuna(norm, plat.colunas[campo], usadas);
      mapa[campo] = idx;
      if (idx >= 0) usadas.push(idx);
    });
    return mapa;
  }

  // ---------- Identificação da plataforma e da linha de cabeçalho ----------
  function pontuarCabecalho(linha, chave) {
    var norm = linha.map(N).filter(Boolean);
    var plat = PLATAFORMAS[chave], pts = 0;
    plat.assinatura.forEach(function (a) { if (norm.indexOf(a) >= 0) pts += 2; });
    var mapa = mapearColunas(linha.map(String), chave);
    Object.keys(mapa).forEach(function (c) { if (mapa[c] >= 0) pts += 1; });
    return pts;
  }

  // Analisa todas as planilhas e retorna a melhor combinação planilha/cabeçalho/plataforma
  function identificar(planilhas, nomeArquivo, plataformaForcada) {
    var nomeNorm = String(nomeArquivo || '').toLowerCase();
    var melhor = null;
    planilhas.forEach(function (pl, ip) {
      var limite = Math.min(pl.linhas.length, 25);
      for (var l = 0; l < limite; l++) {
        var linha = pl.linhas[l].map(function (v) { return v == null ? '' : String(v); });
        if (linha.filter(Boolean).length < 2) continue;
        Object.keys(PLATAFORMAS).forEach(function (chave) {
          if (plataformaForcada && chave !== plataformaForcada) return;
          var pts = pontuarCabecalho(linha, chave);
          if (PLATAFORMAS[chave].arquivo.test(nomeNorm)) pts += 3;
          if (!melhor || pts > melhor.pontos) melhor = { pontos: pts, planilha: ip, linhaCabecalho: l, plataforma: chave };
        });
      }
    });
    if (!melhor) return null;
    melhor.confiavel = melhor.pontos >= 5;
    return melhor;
  }

  // ---------- Status ----------
  function classificarStatus(txt) {
    var s = N(txt);
    if (!s) return 'ok';
    if (/cancel|naopago|unpaid|invalid|fraud|recusad|rejeitad|rejected|estornad|devolvid|reembols|refund|expirad/.test(s)) return 'canc';
    if (/pend|aguard|process|andamento|pending|waiting|emanalise|analise|retid|aberto|inprogress/.test(s)) return 'pend';
    return 'ok';
  }

  // ---------- Interpretação completa ----------
  /* Retorna:
     { plataforma, mapa, cabecalhos, registros:[...], erros:[{linha,motivo}], avisos:[...],
       linhasLidas, periodo:{de,ate}, indisponiveis:[campos] } */
  function interpretar(planilhas, opcoes) {
    opcoes = opcoes || {};
    var id = opcoes.identificacao || identificar(planilhas, opcoes.nomeArquivo, opcoes.plataforma);
    if (!id) throw new Error('Não foi possível encontrar uma tabela neste arquivo.');
    var chave = opcoes.plataforma || id.plataforma;
    var plat = PLATAFORMAS[chave];
    var linhas = planilhas[id.planilha].linhas;
    var cabecalhos = linhas[id.linhaCabecalho].map(function (v) { return v == null ? '' : String(v).trim(); });
    var mapa = opcoes.mapa || mapearColunas(cabecalhos, chave);
    var corpo = linhas.slice(id.linhaCabecalho + 1);
    var avisos = [], erros = [];

    function cel(linha, campo) { var i = mapa[campo]; return i >= 0 ? linha[i] : undefined; }

    var ordemData = plat.dataOrdem;
    if (mapa.data >= 0) {
      var amostra = corpo.map(function (l) { return l[mapa.data]; });
      ordemData = util.detectarOrdemData(amostra);
    }

    if (mapa.data < 0) throw new Error('Não encontrei a coluna de data no relatório. Indique-a manualmente no mapeamento de colunas.');
    if (mapa.valor < 0 && mapa.preco < 0 && mapa.comissao < 0)
      throw new Error('Não encontrei colunas de valor de venda nem de comissão. Indique-as manualmente no mapeamento de colunas.');

    // 1ª passada: lê linhas
    var brutos = [];
    corpo.forEach(function (linha, i) {
      var numLinha = id.linhaCabecalho + i + 2; // número da linha como aparece no Excel
      var primeira = N(linha.find(function (v) { return v !== '' && v != null; }));
      if (/^(total|totais|subtotal|somatotal|grandtotal)/.test(primeira)) return;
      var bruto = cel(linha, 'data');
      var data = util.parseData(bruto, ordemData);
      if (!data) { erros.push({ linha: numLinha, motivo: 'Data inválida ou vazia: "' + (bruto == null ? '' : bruto) + '"' }); return; }

      var qtd = mapa.quantidade >= 0 ? util.parseNumero(cel(linha, 'quantidade')) : null;
      var devol = mapa.devolucoes >= 0 ? util.parseNumero(cel(linha, 'devolucoes')) : null;
      var valor = mapa.valor >= 0 ? util.parseNumero(cel(linha, 'valor')) : null;
      if (valor == null && mapa.preco >= 0) {
        var preco = util.parseNumero(cel(linha, 'preco'));
        if (preco != null) valor = preco * (qtd == null ? 1 : qtd);
      }
      var comissao = mapa.comissao >= 0 ? util.parseNumero(cel(linha, 'comissao')) : null;
      if (valor == null && comissao == null) {
        erros.push({ linha: numLinha, motivo: 'Linha sem valor de venda e sem comissão' });
        return;
      }
      if (qtd != null && devol != null) qtd = qtd - devol;
      var pedido = mapa.pedido >= 0 ? String(cel(linha, 'pedido') == null ? '' : cel(linha, 'pedido')).trim() : '';
      brutos.push({
        linhaOriginal: linha, numLinha: numLinha, data: data, pedido: pedido,
        item: mapa.item >= 0 ? String(cel(linha, 'item') || '') : '',
        modelo: mapa.modelo >= 0 ? String(cel(linha, 'modelo') || '') : '',
        valor: valor, comissao: comissao, qtd: qtd,
        status: mapa.status >= 0 ? classificarStatus(cel(linha, 'status')) : 'ok'
      });
    });

    // 2ª passada: valores que se repetem por pedido (relatórios com 1 linha por item
    // mas com o total do pedido repetido em todas as linhas) — contar uma vez só.
    ['valor', 'comissao'].forEach(function (campo) {
      if (mapa.pedido < 0) return;
      var grupos = {};
      brutos.forEach(function (b) { if (b.pedido) (grupos[b.pedido] = grupos[b.pedido] || []).push(b); });
      var multi = Object.keys(grupos).map(function (k) { return grupos[k]; }).filter(function (g) { return g.length > 1; });
      if (multi.length < 2) return;
      var constantes = multi.filter(function (g) {
        return g.every(function (b) { return b[campo] === g[0][campo]; });
      }).length;
      var itensDiferem = multi.filter(function (g) {
        return g.some(function (b) { return b.item !== g[0].item || b.modelo !== g[0].modelo; });
      }).length;
      // se em todos os pedidos com vários itens o valor é idêntico, é um valor por pedido
      var outroCampo = campo === 'valor' ? 'comissao' : 'valor';
      var outroVaria = multi.some(function (g) { return g.some(function (b) { return b[outroCampo] !== g[0][outroCampo]; }); });
      if (constantes === multi.length && itensDiferem > 0 && outroVaria) {
        Object.keys(grupos).forEach(function (k) {
          grupos[k].forEach(function (b, i) { if (i > 0) b[campo] = b[campo] == null ? null : 0; });
        });
        avisos.push('A coluna "' + cabecalhos[mapa[campo]] + '" repete o mesmo valor em todos os itens de um mesmo pedido. Ela foi contada uma única vez por pedido para não duplicar o total.');
      }
    });

    // 3ª passada: chaves únicas (deduplicação)
    var ocorrencias = {}, registros = [];
    brutos.forEach(function (b) {
      var base;
      if (b.pedido) base = chave + '|' + b.pedido + '|' + b.item + '|' + b.modelo;
      else base = chave + '|' + b.linhaOriginal.map(function (v) { return N(v); }).join('|');
      var n = ocorrencias[base] = (ocorrencias[base] || 0) + 1;
      registros.push({
        k: util.hash(base + '#' + n),
        p: plat.sigla,
        d: b.data,
        o: b.pedido ? util.hash(chave + '|pedido|' + b.pedido) : null,
        v: util.arred(b.valor),
        c: util.arred(b.comissao),
        q: b.qtd == null ? null : Math.round(b.qtd),
        s: b.status
      });
    });

    var datas = registros.map(function (r) { return r.d; }).sort();
    var indisponiveis = [];
    if (mapa.valor < 0 && mapa.preco < 0) indisponiveis.push('vendas');
    if (mapa.comissao < 0) indisponiveis.push('comissoes');
    if (mapa.pedido < 0) indisponiveis.push('pedidos');
    if (mapa.quantidade < 0) indisponiveis.push('itens');
    if (mapa.status < 0) avisos.push('O relatório não tem coluna de status: todos os registros foram considerados válidos.');

    return {
      plataforma: chave, nomePlataforma: plat.nome, identificacao: id,
      planilha: planilhas[id.planilha].nome, cabecalhos: cabecalhos, mapa: mapa,
      exemplo: corpo[0] || [], registros: registros, erros: erros, avisos: avisos,
      linhasLidas: corpo.length, periodo: { de: datas[0] || null, ate: datas[datas.length - 1] || null },
      indisponiveis: indisponiveis, ordemData: ordemData
    };
  }

  var SIGLAS = { s: 'shopee', a: 'amazon', m: 'mercadolivre' };

  SD.plataformas = {
    CAMPOS: CAMPOS, PLATAFORMAS: PLATAFORMAS, SIGLAS: SIGLAS,
    identificar: identificar, mapearColunas: mapearColunas, interpretar: interpretar,
    classificarStatus: classificarStatus
  };
})(typeof window !== 'undefined' ? window : globalThis);

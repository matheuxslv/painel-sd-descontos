/* SD Descontos — leitura de arquivos CSV e Excel (XLSX) direto no navegador.
   Não depende de bibliotecas externas: o XLSX é um arquivo ZIP com XML,
   descompactado com a API nativa DecompressionStream. */
(function (root) {
  'use strict';
  var SD = root.SD = root.SD || {};
  var util = SD.util;

  // ================= CSV =================
  function decodificarTexto(bytes) {
    var texto;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { texto = new TextDecoder('windows-1252').decode(bytes); }
    return texto.replace(/^﻿/, '');
  }

  function detectarSeparador(texto) {
    var linhas = texto.split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 15);
    var melhor = ',', melhorPont = -1;
    [',', ';', '\t', '|'].forEach(function (sep) {
      var contagens = linhas.map(function (l) {
        var n = 0, aspas = false;
        for (var i = 0; i < l.length; i++) {
          if (l[i] === '"') aspas = !aspas;
          else if (!aspas && l[i] === sep) n++;
        }
        return n;
      });
      var max = Math.max.apply(null, contagens.concat([0]));
      var iguais = contagens.filter(function (c) { return c === max; }).length;
      var pont = max > 0 ? max * iguais : 0;
      if (pont > melhorPont) { melhorPont = pont; melhor = sep; }
    });
    return melhor;
  }

  function lerCSV(texto) {
    var primeira = texto.split(/\r?\n/, 1)[0];
    var sep;
    var m = primeira.match(/^sep=(.)\s*$/i);
    if (m) { sep = m[1]; texto = texto.slice(primeira.length).replace(/^\r?\n/, ''); }
    else sep = detectarSeparador(texto);
    var linhas = [], linha = [], campo = '', aspas = false, i = 0, c;
    while (i < texto.length) {
      c = texto[i];
      if (aspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; }
          aspas = false; i++; continue;
        }
        campo += c; i++; continue;
      }
      if (c === '"' && campo === '') { aspas = true; i++; continue; }
      if (c === sep) { linha.push(campo); campo = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        linha.push(campo); campo = '';
        linhas.push(linha); linha = [];
        if (c === '\r' && texto[i + 1] === '\n') i++;
        i++; continue;
      }
      campo += c; i++;
    }
    if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas.map(function (l) { return l.map(function (v) { return v.trim(); }); })
      .filter(function (l) { return l.some(function (v) { return v !== ''; }); });
  }

  // ================= XLSX =================
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function lerZip(bytes) {
    var fim = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) {
      if (u32(bytes, i) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error('Arquivo Excel inválido ou corrompido (não é um XLSX).');
    var total = u16(bytes, fim + 10), pos = u32(bytes, fim + 16), entradas = {};
    for (var n = 0; n < total; n++) {
      if (u32(bytes, pos) !== 0x02014b50) break;
      var metodo = u16(bytes, pos + 10), tamComp = u32(bytes, pos + 20);
      var lenNome = u16(bytes, pos + 28), lenExtra = u16(bytes, pos + 30), lenCom = u16(bytes, pos + 32);
      var offLocal = u32(bytes, pos + 42);
      var nome = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + lenNome));
      entradas[nome.replace(/^\//, '')] = { metodo: metodo, tamComp: tamComp, offLocal: offLocal };
      pos += 46 + lenNome + lenExtra + lenCom;
    }
    return entradas;
  }

  async function extrair(bytes, entrada) {
    var o = entrada.offLocal;
    var ini = o + 30 + u16(bytes, o + 26) + u16(bytes, o + 28);
    var dados = bytes.subarray(ini, ini + entrada.tamComp);
    if (entrada.metodo === 0) return new TextDecoder().decode(dados);
    if (entrada.metodo !== 8) throw new Error('Compressão não suportada no arquivo Excel.');
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir Excel. Atualize o navegador ou salve o arquivo como CSV.');
    var fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    var buf = await new Response(fluxo).arrayBuffer();
    return new TextDecoder().decode(new Uint8Array(buf));
  }

  function desescaparXML(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, function (_, e) {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
    });
  }
  function atributo(tag, nome) {
    var m = tag.match(new RegExp('\\s' + nome + '="([^"]*)"'));
    return m ? desescaparXML(m[1]) : null;
  }
  function textoDe(xml) { // junta todos os <t>…</t>
    var out = '', re = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g, m;
    while ((m = re.exec(xml))) out += m[1];
    return desescaparXML(out);
  }
  function colunaIndice(ref) {
    var letras = ref.replace(/\d+/g, ''), n = 0;
    for (var i = 0; i < letras.length; i++) n = n * 26 + (letras.charCodeAt(i) - 64);
    return n - 1;
  }
  var FORMATOS_DATA = { 14: 1, 15: 1, 16: 1, 17: 1, 18: 0, 19: 0, 20: 0, 21: 0, 22: 1, 27: 1, 30: 1, 36: 1, 45: 0, 46: 0, 47: 0, 50: 1, 57: 1 };
  function formatoEhData(codigo) {
    var limpo = codigo.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
    return /[dy]/i.test(limpo) || /m{3,}/i.test(limpo);
  }

  function excelParaTexto(n, data1904) {
    var dias = n + (data1904 ? 1462 : 0);
    var ms = Math.round((dias - 25569) * 86400000);
    var d = new Date(ms), p = util.pad;
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
      ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
  }

  async function lerXLSX(bytes) {
    var zip = lerZip(bytes);
    if (!zip['xl/workbook.xml']) throw new Error('Arquivo Excel sem planilhas reconhecíveis.');
    var wb = await extrair(bytes, zip['xl/workbook.xml']);
    var data1904 = /date1904="(1|true)"/.test(wb);
    var rels = zip['xl/_rels/workbook.xml.rels'] ? await extrair(bytes, zip['xl/_rels/workbook.xml.rels']) : '';
    var alvos = {};
    (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(function (t) {
      alvos[atributo(t, 'Id')] = atributo(t, 'Target');
    });

    // textos compartilhados
    var compartilhados = [];
    if (zip['xl/sharedStrings.xml']) {
      var ss = await extrair(bytes, zip['xl/sharedStrings.xml']);
      var reSi = /<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>|<(?:\w+:)?si\/>/g, m;
      while ((m = reSi.exec(ss))) compartilhados.push(m[1] ? textoDe(m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')) : '');
    }
    // estilos → quais células são datas
    var estiloData = [];
    if (zip['xl/styles.xml']) {
      var st = await extrair(bytes, zip['xl/styles.xml']);
      var custom = {};
      (st.match(/<(?:\w+:)?numFmt\b[^>]*>/g) || []).forEach(function (t) {
        custom[atributo(t, 'numFmtId')] = atributo(t, 'formatCode') || '';
      });
      var xfs = st.match(/<(?:\w+:)?cellXfs\b[\s\S]*?<\/(?:\w+:)?cellXfs>/);
      if (xfs) (xfs[0].match(/<(?:\w+:)?xf\b[^>]*>/g) || []).forEach(function (t) {
        var id = +(atributo(t, 'numFmtId') || 0);
        estiloData.push(id in FORMATOS_DATA || (custom[id] != null && formatoEhData(custom[id])));
      });
    }

    var planilhas = [];
    var tags = wb.match(/<(?:\w+:)?sheet\b[^>]*>/g) || [];
    for (var s = 0; s < tags.length; s++) {
      var nome = atributo(tags[s], 'name');
      var rid = atributo(tags[s], 'r:id') || atributo(tags[s], 'id');
      var alvo = alvos[rid] || ('worksheets/sheet' + (s + 1) + '.xml');
      var caminho = alvo.charAt(0) === '/' ? alvo.slice(1) : ('xl/' + alvo).replace(/xl\/\.\.\//, '');
      if (!zip[caminho]) continue;
      var xml = await extrair(bytes, zip[caminho]);
      planilhas.push({ nome: nome, linhas: lerPlanilhaXML(xml, compartilhados, estiloData, data1904) });
    }
    return planilhas;
  }

  function lerPlanilhaXML(xml, compartilhados, estiloData, data1904) {
    var linhas = [];
    var reLinha = /<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g, mL, proxLinha = 0;
    while ((mL = reLinha.exec(xml))) {
      var rAttr = atributo(mL[1], 'r');
      var idxLinha = rAttr ? +rAttr - 1 : proxLinha;
      proxLinha = idxLinha + 1;
      var linha = [], proxCol = 0;
      var reCel = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g, mC;
      while ((mC = reCel.exec(mL[2]))) {
        var attrs = mC[1], corpo = mC[2] || '';
        var ref = atributo(attrs, 'r');
        var col = ref ? colunaIndice(ref) : proxCol;
        proxCol = col + 1;
        var tipo = atributo(attrs, 't') || 'n';
        var estilo = +(atributo(attrs, 's') || 0);
        var mv = corpo.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/);
        var bruto = mv ? desescaparXML(mv[1]) : null, valor = '';
        if (tipo === 's') valor = bruto != null ? (compartilhados[+bruto] || '') : '';
        else if (tipo === 'inlineStr') valor = textoDe(corpo);
        else if (tipo === 'str' || tipo === 'e') valor = bruto || '';
        else if (tipo === 'b') valor = bruto === '1' ? 'VERDADEIRO' : 'FALSO';
        else if (bruto != null && bruto !== '') {
          var num = parseFloat(bruto);
          valor = estiloData[estilo] && isFinite(num) ? excelParaTexto(num, data1904) : num;
        }
        linha[col] = typeof valor === 'string' ? valor.trim() : valor;
      }
      for (var k = 0; k < linha.length; k++) if (linha[k] === undefined) linha[k] = '';
      linhas[idxLinha] = linha;
    }
    var out = [];
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i];
      if (l && l.some(function (v) { return v !== '' && v != null; })) out.push(l);
    }
    return out;
  }

  // ================= Entrada única =================
  // Retorna { formato, hash, planilhas: [{ nome, linhas: [[...]] }] }
  async function lerBytes(bytes, nomeArquivo) {
    var nome = String(nomeArquivo || '').toLowerCase();
    var ehZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    var resultado = { hash: util.hashBytes(bytes) };
    if (ehZip) {
      resultado.formato = 'xlsx';
      resultado.planilhas = await lerXLSX(bytes);
    } else if (/\.xls$/.test(nome) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
      throw new Error('Formato .xls (Excel antigo) não é suportado. Abra o arquivo no Excel e salve como .xlsx ou .csv.');
    } else {
      resultado.formato = 'csv';
      resultado.planilhas = [{ nome: 'CSV', linhas: lerCSV(decodificarTexto(bytes)) }];
    }
    if (!resultado.planilhas.length || !resultado.planilhas.some(function (p) { return p.linhas.length; }))
      throw new Error('O arquivo está vazio ou não contém tabelas.');
    return resultado;
  }

  async function lerArquivo(arquivo) {
    var buf = await arquivo.arrayBuffer();
    return lerBytes(new Uint8Array(buf), arquivo.name);
  }

  SD.leitores = { lerArquivo: lerArquivo, lerBytes: lerBytes, lerCSV: lerCSV, decodificarTexto: decodificarTexto };
})(typeof window !== 'undefined' ? window : globalThis);

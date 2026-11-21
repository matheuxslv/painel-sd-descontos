# SD Descontos — Painel de Resultados

Painel para acompanhar os resultados da SD Descontos nas plataformas de afiliados **Shopee**, **Amazon** e **Mercado Livre**.

- **Painel público** (`index.html`): vendas, pedidos, comissões, produtos vendidos, ticket médio, evolução no tempo, comparativo entre plataformas, distribuição das comissões e histórico por mês ou por dia.
- **Área administrativa** (`admin.html`): importação dos relatórios em CSV ou Excel (.xlsx), conferência antes de importar, histórico dos arquivos processados, erros de importação e geração do arquivo `dados.json` para publicação.

O site é 100% estático (HTML, CSS e JavaScript), roda de graça no **GitHub Pages** e **não depende de nenhuma biblioteca externa nem de servidor**. Os relatórios são lidos dentro do seu navegador e nunca são enviados para a internet.

---

## 1. Estrutura dos arquivos

```
├── index.html          → painel público (dashboard)
├── admin.html          → área administrativa (importação)
├── css/style.css       → estilos
├── js/
│   ├── util.js         → formatação de valores, datas e números
│   ├── leitores.js     → leitura de arquivos CSV e Excel (.xlsx)
│   ├── plataformas.js  → interpretação dos relatórios de cada plataforma
│   ├── dados.js        → base consolidada, anti-duplicidade e cálculo dos indicadores
│   ├── graficos.js     → gráficos
│   ├── painel.js       → lógica do painel público
│   └── admin.js        → lógica da área administrativa
├── data/dados.json     → dados consolidados exibidos no painel (o único arquivo que você atualiza)
├── img/favicon.svg     → ícone do site
├── .gitignore          → impede que relatórios .csv/.xlsx sejam enviados por engano
└── .nojekyll           → instrução técnica para o GitHub Pages
```

O `data/dados.json` vem **vazio**. O painel só mostra números depois que você importa relatórios reais.

---

## 2. Publicar o site no GitHub Pages (somente na primeira vez)

1. Crie uma conta em <https://github.com> (se ainda não tiver).
2. Clique em **New repository** (botão verde "New").
   - Nome sugerido: `painel-sd-descontos`.
   - Marque **Public** (o GitHub Pages gratuito exige repositório público).
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file** (ou **Add file → Upload files**).
4. Descompacte o `.zip` do projeto no seu computador e **arraste todo o conteúdo da pasta** (os arquivos `index.html`, `admin.html`, `README.md` e as pastas `css`, `js`, `data`, `img`) para a página do GitHub.
   - Arquivos que começam com ponto (`.gitignore`, `.nojekyll`) podem ficar ocultos no seu computador. Eles são úteis, mas o site funciona mesmo sem eles.
5. Clique em **Commit changes**.
6. Vá em **Settings → Pages**. Em **Branch**, escolha `main` e a pasta `/ (root)`, e clique em **Save**.
7. Em 1 a 2 minutos o endereço aparece no topo dessa mesma página, por exemplo:
   `https://seu-usuario.github.io/painel-sd-descontos/`

Esse é o link público do painel. A área administrativa fica em `.../admin.html`.

---

## 3. Baixar os relatórios nas plataformas

| Plataforma | Onde baixar | Formato |
|---|---|---|
| **Shopee** | Painel de Afiliados → Relatórios → **Relatório de Comissões** (Conversões) → Exportar | CSV |
| **Amazon** | Associados Amazon → Relatórios → **Relatório de ganhos** (*Fee-Earnings*) → Baixar relatório | CSV ou XLSX |
| **Mercado Livre** | Programa de Afiliados → Relatórios/Desempenho → Exportar | XLSX ou CSV |

> Os nomes dos menus podem mudar com o tempo. O que importa é baixar o relatório **detalhado por pedido/venda** (uma linha por venda), e não apenas o resumo.

Dicas:
- Pode baixar períodos que se sobrepõem (ex.: "últimos 30 dias" toda semana). O sistema **não duplica** registros: o que já existe é ignorado e o que mudou (ex.: um pedido que passou de *pendente* para *concluído*) é atualizado.
- Guarde os relatórios originais **no seu computador**, nunca no repositório público.

---

## 4. Importar os relatórios e atualizar o painel público

### Passo a passo

1. Abra `https://seu-usuario.github.io/painel-sd-descontos/admin.html`.
2. Em **Importar relatórios**, deixe a plataforma em *Identificar automaticamente* (ou escolha a plataforma) e **arraste os arquivos** para a área pontilhada. Pode enviar vários de uma vez.
3. Para cada arquivo aparece um **resumo para conferência**:
   - plataforma identificada, período do relatório, linhas lidas, registros válidos e linhas com erro;
   - quantos registros são **novos**, **atualizados** ou **já existentes**;
   - totais de vendas, comissões e pedidos que o arquivo contém;
   - avisos (ex.: arquivo já importado antes, coluna que não existe no relatório).
4. Se estiver tudo certo, clique em **Importar**.
5. Clique em **Pré-visualizar painel** para ver como o painel ficará com os novos dados.
6. Clique em **Baixar dados.json**.
7. No GitHub, abra a pasta **`data`** do repositório → **Add file → Upload files** → arraste o `dados.json` baixado → **Commit changes**.
   - Ele substitui o arquivo antigo automaticamente (mesmo nome).
8. Em 1 a 2 minutos o GitHub Pages publica a nova versão e qualquer pessoa que abrir o link vê os dados atualizados, com a data da última atualização no topo.

### Se o sistema não reconhecer alguma coluna

Abra **Mapeamento de colunas** no resumo do arquivo. Para cada informação (data, número do pedido, valor da venda, comissão, quantidade, status) há uma lista com as colunas do seu relatório e um exemplo do valor lido. Corrija a escolha e o resumo é recalculado na hora. O sistema **memoriza** essa correção e a aplica sozinho nas próximas importações do mesmo formato de relatório.

### Importando em outro computador

As importações ficam guardadas no navegador até você publicar. Ao abrir a área administrativa, o sistema carrega automaticamente o `dados.json` publicado e soma as novas importações a ele, então dá para usar qualquer computador, desde que você publique antes de trocar de máquina.

- **Descartar alterações não publicadas**: volta aos dados que estão no site.
- **Abrir dados.json do computador**: carrega um `dados.json` salvo (útil como backup).
- **Remover** (em *Arquivos processados*): desfaz uma importação feita por engano.

---

## 5. Como os indicadores são calculados

| Indicador | Cálculo |
|---|---|
| Faturamento em vendas | Soma do valor das vendas (valor de compra / receita / valor da venda) |
| Comissões geradas | Soma das comissões. O cartão também mostra quanto ainda está **pendente** |
| Pedidos realizados | Quantidade de números de pedido diferentes |
| Produtos vendidos | Soma das quantidades (na Amazon, itens enviados menos devoluções) |
| Ticket médio | Vendas ÷ pedidos, apenas das plataformas que informam as duas coisas |
| Variação | Comparação com o período anterior (ou com o mesmo período do ano anterior) |

Regras importantes:
- **Pedidos cancelados** (ou não pagos/devolvidos) aparecem no resumo de importação, mas **não entram nos totais**. Pedidos **pendentes** entram e são sinalizados.
- **Nada é estimado.** Se um relatório não tem uma informação, ela aparece como *não disponível*. Por exemplo, o relatório de ganhos da Amazon não traz número de pedido, então a Amazon não entra na contagem de pedidos nem no ticket médio, e o painel avisa isso.
- Na Shopee, quando o relatório repete o valor total do pedido em todas as linhas de itens, o sistema percebe e conta esse valor **uma única vez**, avisando no resumo da importação.

---

## 6. Privacidade

- Os relatórios são processados **somente no seu navegador**.
- O `dados.json` publicado contém só o necessário para o painel: data, plataforma, valor, comissão, quantidade e status de cada venda. Os números de pedido viram **códigos irreversíveis** (usados apenas para evitar duplicidade), e nomes de produtos, lojas, compradores e links **não são incluídos**.
- O `.gitignore` impede que arquivos `.csv`/`.xlsx` sejam enviados pelo Git. Se você usa o upload pelo site do GitHub, simplesmente não envie os relatórios.
- A área administrativa não tem senha (não é necessária): ela não altera nada no site sozinha. Só quem tem acesso à sua conta do GitHub consegue publicar dados. O endereço `admin.html` não aparece em buscadores.

---

## 7. Testar no computador (opcional)

Ao abrir o `index.html` com dois cliques, o navegador bloqueia a leitura do `data/dados.json`. Para testar localmente, rode um servidor simples na pasta do projeto:

```bash
python -m http.server 8000
```

e acesse <http://localhost:8000>. A área administrativa funciona mesmo aberta com dois cliques (use **Abrir dados.json do computador** para partir dos dados existentes).

---

## 8. Ajustar para novos formatos de relatório

Se uma plataforma mudar os nomes das colunas, há duas saídas:

1. **Sem mexer em código:** use o *Mapeamento de colunas* na importação (fica memorizado).
2. **Definitivo:** em `js/plataformas.js`, acrescente o novo nome na lista da plataforma (`colunas → campo → exatos`). Os nomes são escritos sem acentos, espaços ou símbolos e em minúsculas, por exemplo `"Comissão líquida do afiliado(R$)"` → `comissaoliquidadoafiliador`.

Navegadores compatíveis: Chrome, Edge, Firefox e Safari atualizados (computador e celular). Arquivos `.xls` (Excel antigo) devem ser salvos como `.xlsx` ou `.csv`.

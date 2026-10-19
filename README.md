# Etiquetas Rede ANCORA

Impressão de etiquetas de código de barras das filiais da Rede ANCORA nas impressoras Argox
(OS-2140 e OS-214plus). A filial digita ou bipa o CNA (ou o EAN), escolhe a quantidade e clica em
**Imprimir**: cada página impressa é uma linha do rolo, com 2 etiquetas de 50 × 30 mm.

Etiqueta: código alternativo em destaque, "CNA 921173 - DESCRIÇÃO DO PRODUTO" abaixo (até 2 linhas;
descrição longa termina com "…") e o código de barras do EAN.

## Atualizar a base de produtos (sem gastar crédito do Lovable)

A base fica no arquivo [`public/base_produtos.csv.gz`](public/base_produtos.csv.gz): um CSV
compactado (gzip, ~4× menor), no formato:

```
cna;ean;alternativo;descricao
921173;7898590390969;106002;TAMPA PROTECAO CORREIA EXTERNA
```

1. No app, clique em **Abrir arquivo da base** e escolha a exportação do sistema (CSV ou Excel)
   com CNA, código de barras, código alternativo e descrição.
2. Confira as colunas e clique em **Baixar arquivo para publicar**. Sai o `base_produtos.csv.gz`.
3. No GitHub, abra a pasta `public`, clique em **Add file › Upload files**, envie o
   `base_produtos.csv.gz` (substitui o anterior) e confirme em **Commit changes**.
4. No Lovable, clique em **Publish › Update** para o site publicado usar a base nova.

Cuidado com o Excel: salvar EAN como número pode virar `7,89E+12`. Formate a coluna EAN como
Texto antes de salvar o CSV, ou use o `.xlsx` direto no passo 1.

## Preparar cada computador com Argox (uma vez)

1. Instale o driver da Argox para Windows.
2. Em _Preferências de impressão_, crie o papel **Etiqueta 105x30**: tipo _Etiquetas cortadas com
   molde_, largura 105 mm, altura 30 mm. Deixe como padrão.
3. Calibre a impressora (em geral, segurar FEED até ela puxar algumas etiquetas e parar).
4. Na hora de imprimir, escolha o papel **Etiqueta 105x30** e escala **100%**.

Outro rolo? Ajuste em **Como imprimir › Medidas do rolo** no próprio app (fica salvo no computador).

## Onde está o código

- `src/components/etiquetas/` — tela (`EtiquetasApp.tsx`), cabeçalho e desenho da etiqueta.
- `src/lib/etiquetas/` — códigos de barras e layout em mm (`codigos.ts`), medidas do rolo
  (`rolo.ts`), leitura de CSV/Excel e da base (`planilha.ts`).
- `src/etiquetas.css` — estilos da tela e da impressão (cores do manual da marca).
- `src/test/etiquetas.test.ts` — testes do layout, dos códigos e da leitura da base (`bun run test`).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/406d2b3d-7276-4bce-b658-29fcdc1d89ad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

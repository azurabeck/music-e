# MUSIC-E

Aplicativo desktop (Windows) para organizar cifras e partituras, consultar acordes de violão e piano e treinar leitura de partitura.

## Desenvolvimento

```bash
npm install
npm start
```

`npm test` confere as notas de todos os acordes do dicionário.

## Gerar o instalador

```bash
npm run dist
```

Sobe a versão automaticamente (0.1.001 → 0.1.002) e gera `dist/MUSIC-E-Setup-<versão>.exe`.

## Publicar uma versão (atualização automática)

O botão **Atualizar versão** (Configurações → Aplicativo) procura a última versão publicada em
[Releases](https://github.com/azurabeck/music-e/releases). Para publicar:

1. Crie um token no GitHub com permissão de escrita no repositório e guarde-o na variável de ambiente `GH_TOKEN`.
2. Rode `npm run release`. Ele gera o instalador e envia os arquivos para um rascunho de release.
3. No GitHub, abra o rascunho e clique em **Publish release**.

Sem token, dá para publicar à mão: rode `npm run dist`, crie uma release com a tag `v<versão do package.json>`
(ex.: `v0.1.2`) e anexe os três arquivos de `dist`: `latest.yml`, o `.exe` e o `.exe.blockmap`.

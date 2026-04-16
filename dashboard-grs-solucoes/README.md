# Dashboard GRS Solucoes

Dashboard de vendas conectado a uma planilha Excel do SharePoint/OneDrive.

## Como funciona

- A tela busca os dados em `/api/vendas`.
- A API baixa a planilha XLSX configurada nas variaveis de ambiente.
- Os dados da aba `CONSOLIDADO` sao lidos pelas colunas `DATA`, `COLABORADOR`, `NOME_CLIENTE`, `META` e `EQUIPE`.
- O dashboard calcula totais, ranking mensal, ranking semanal e faturamento por dia.

## Importante

A planilha real nao deve ser enviada para o GitHub, porque contem CPF e dados de clientes. Configure o acesso pela Vercel usando variaveis de ambiente.

## Variaveis de ambiente

Copie `.env.example` para `.env.local` no desenvolvimento ou configure as mesmas variaveis na Vercel.

### Caminho simples

Use `EXCEL_DOWNLOAD_URL` se voce tiver um link direto que baixa o arquivo `.xlsx`.

### Caminho recomendado para SharePoint privado

Configure:

- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `GRAPH_FILE_DOWNLOAD_URL`

`GRAPH_FILE_DOWNLOAD_URL` deve ser um endpoint Microsoft Graph que baixa o arquivo, por exemplo:

```txt
https://graph.microsoft.com/v1.0/drives/{drive-id}/root:/PLANEJAMENTO/BASE%20DE%20VENDAS.xlsx:/content
```

Tambem e possivel usar:

- `GRAPH_DRIVE_ID`
- `GRAPH_FILE_PATH`

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Publicar na Vercel

1. Crie o projeto na Vercel a partir deste repositorio.
2. Configure as variaveis de ambiente.
3. Faça deploy.
4. Sempre que a planilha mudar no SharePoint, recarregue o dashboard ou aguarde o refresh automatico da tela.

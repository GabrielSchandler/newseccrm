# Copia so a ESTRUTURA (nenhum dado de cliente) do banco de producao do CRM
# para o banco novo de homologacao usado pelo newseccrm.
#
# Como usar: da duplo-clique em "copiar-schema-producao.bat" nesta mesma
# pasta (ele chama este script sozinho). Nao precisa abrir nada antes.
#
# As duas "Connection string" pedidas abaixo ficam em:
#   Supabase > (o projeto certo) > Project Settings > Database >
#   Connection string > aba "URI"
# Cole a string inteira, incluindo a senha que ja vem nela ou substituindo
# o trecho [YOUR-PASSWORD] pela senha do banco daquele projeto.
#
# Nada do que voce colar aqui e enviado pra lugar nenhum alem do seu
# proprio computador conversando com o Supabase.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Copiar estrutura do banco: PRODUCAO -> HOMOLOGACAO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Isso NAO copia nenhum dado de cliente, so a estrutura das tabelas." -ForegroundColor Yellow
Write-Host ""

$origemUrl = Read-Host "Cole a Connection String do banco de PRODUCAO do CRM"
if ([string]::IsNullOrWhiteSpace($origemUrl)) {
    Write-Host "Nada colado, cancelando." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

$destinoUrl = Read-Host "Cole a Connection String do banco NOVO de homologacao"
if ([string]::IsNullOrWhiteSpace($destinoUrl)) {
    Write-Host "Nada colado, cancelando." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

$saida = Join-Path $PSScriptRoot "schema-producao.sql"

Write-Host ""
Write-Host "Passo 1 de 2: baixando a estrutura da producao..." -ForegroundColor Cyan
npx --yes supabase db dump --db-url "$origemUrl" --schema public -f "$saida"

if (-not (Test-Path $saida) -or (Get-Item $saida).Length -eq 0) {
    Write-Host ""
    Write-Host "Nao consegui gerar o arquivo. Copia a mensagem de erro acima e me manda." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

Write-Host "OK, estrutura salva em: $saida" -ForegroundColor Green
Write-Host ""
Write-Host "Passo 2 de 2: aplicando no banco de homologacao..." -ForegroundColor Cyan

npx --yes supabase db push --db-url "$destinoUrl" --include-all --file "$saida" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "O comando automatico do passo 2 nao funcionou nesta versao do supabase." -ForegroundColor Yellow
    Write-Host "Sem problema — faz assim, e mais visual mesmo:" -ForegroundColor Yellow
    Write-Host "  1. Abre o Supabase, entra no projeto NOVO (o de homologacao)." -ForegroundColor Yellow
    Write-Host "  2. No menu da esquerda, clica em 'SQL Editor'." -ForegroundColor Yellow
    Write-Host "  3. Abre o arquivo abaixo num editor de texto, copia tudo:" -ForegroundColor Yellow
    Write-Host "       $saida" -ForegroundColor White
    Write-Host "  4. Cola no SQL Editor do Supabase e clica em 'Run'." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Aperte Enter para fechar"
    exit 0
}

Write-Host ""
Write-Host "Pronto! Estrutura copiada pro banco de homologacao." -ForegroundColor Green
Read-Host "Aperte Enter para fechar"

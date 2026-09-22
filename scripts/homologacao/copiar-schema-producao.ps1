# Copia so a ESTRUTURA (nenhum dado de cliente) do banco de producao do CRM
# para o banco novo de homologacao usado pelo newseccrm.
#
# Como usar: da duplo-clique em "copiar-schema-producao.bat" nesta mesma
# pasta (ele chama este script sozinho). Nao precisa abrir nada antes.
#
# As duas "Connection string" pedidas abaixo ficam em:
#   Supabase > (o projeto certo) > Project Settings > Database >
#   Connection string > aba "URI"
# ATENCAO: o Supabase mostra o texto com [YOUR-PASSWORD] no lugar da
# senha de verdade. Voce precisa trocar esse trecho pela senha real do
# banco daquele projeto antes de colar aqui (Project Settings > Database >
# "Reset database password" se voce nao lembra ou nunca guardou a senha).
#
# Nada do que voce colar aqui e enviado pra lugar nenhum alem do seu
# proprio computador conversando com o Supabase.
#
# Precisa ter o "pg_dump" e o "psql" instalados (ferramentas de linha de
# comando do PostgreSQL, bem leves, sem precisar de Docker). Se nao tiver,
# este script avisa e te da o link certo pra instalar.

$ErrorActionPreference = "Stop"

function Encontrar-Ferramenta {
    param([string]$Nome)

    $comando = Get-Command $Nome -ErrorAction SilentlyContinue
    if ($comando) { return $comando.Source }

    $candidatos = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Nome.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($candidatos) { return $candidatos[0].FullName }

    return $null
}

$pgDump = Encontrar-Ferramenta "pg_dump"
$psql = Encontrar-Ferramenta "psql"

if (-not $pgDump -or -not $psql) {
    Write-Host ""
    Write-Host "Falta instalar as ferramentas de linha de comando do PostgreSQL." -ForegroundColor Yellow
    Write-Host "(NAO precisa de Docker, e um instalador leve.)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Abre: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Clica no link do instalador (EDB), baixa e roda." -ForegroundColor Cyan
    Write-Host "3. Na tela 'Select Components', DESMARCA 'PostgreSQL Server'," -ForegroundColor Cyan
    Write-Host "   'pgAdmin 4' e 'Stack Builder' - deixa marcado so 'Command Line Tools'." -ForegroundColor Cyan
    Write-Host "4. Segue clicando Next ate Finish. Nao precisa criar senha de servidor." -ForegroundColor Cyan
    Write-Host "5. Depois disso, roda este script de novo." -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Aperte Enter para fechar"
    exit 1
}

Write-Host ""
Write-Host "=== Copiar estrutura do banco: PRODUCAO -> HOMOLOGACAO ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Isso NAO copia nenhum dado de cliente, so a estrutura das tabelas." -ForegroundColor Yellow
Write-Host ""

function Ler-ConnectionString {
    param([string]$Pergunta)

    while ($true) {
        $valor = Read-Host $Pergunta
        if ([string]::IsNullOrWhiteSpace($valor)) {
            Write-Host "Nada colado, cancelando." -ForegroundColor Red
            Read-Host "Aperte Enter para fechar"
            exit 1
        }
        if ($valor -match "\[YOUR-PASSWORD\]") {
            Write-Host ""
            Write-Host "Essa string ainda tem [YOUR-PASSWORD] no lugar da senha de verdade." -ForegroundColor Red
            Write-Host "Troca esse trecho pela senha real do banco (Supabase > esse projeto >" -ForegroundColor Red
            Write-Host "Project Settings > Database > 'Reset database password' se nao souber)" -ForegroundColor Red
            Write-Host "e cola de novo." -ForegroundColor Red
            Write-Host ""
            continue
        }
        return $valor
    }
}

$origemUrl = Ler-ConnectionString "Cole a Connection String do banco de PRODUCAO do CRM"
$destinoUrl = Ler-ConnectionString "Cole a Connection String do banco NOVO de homologacao"

$saida = Join-Path $PSScriptRoot "schema-producao.sql"

Write-Host ""
Write-Host "Passo 1 de 2: baixando a estrutura da producao..." -ForegroundColor Cyan
& $pgDump $origemUrl --schema=public --schema-only --no-owner --no-privileges -f $saida

if (-not (Test-Path $saida) -or (Get-Item $saida).Length -eq 0) {
    Write-Host ""
    Write-Host "Nao consegui gerar o arquivo. Copia a mensagem de erro acima e me manda." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

Write-Host "OK, estrutura salva em: $saida" -ForegroundColor Green
Write-Host ""
Write-Host "Passo 2 de 2: aplicando no banco de homologacao..." -ForegroundColor Cyan

& $psql $destinoUrl -f $saida
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Deu algum erro nesse passo. Copia a mensagem acima e me manda." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

Write-Host ""
Write-Host "Pronto! Estrutura copiada pro banco de homologacao." -ForegroundColor Green
Read-Host "Aperte Enter para fechar"

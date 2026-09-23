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
# proprio computador conversando com o Supabase. O script nunca imprime a
# connection string inteira (com senha) na tela nem em arquivo de log.
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

function Sair-ComErro {
    param([string]$Mensagem)
    Write-Host ""
    Write-Host $Mensagem -ForegroundColor Red
    Write-Host "Nada foi aplicado no banco de homologacao." -ForegroundColor Red
    Read-Host "Aperte Enter para fechar"
    exit 1
}

# Extrai só o identificador do projeto (ex.: "postgres.thnnwevctnpvshyhndnz")
# da connection string, pra poder mostrar e comparar sem nunca imprimir a
# senha. Funciona tanto pra connection string direta (db.<ref>.supabase.co)
# quanto pooler (postgres.<ref>@aws-...pooler.supabase.com).
function Obter-IdentificadorProjeto {
    param([string]$ConnectionString)

    if ($ConnectionString -match "postgres(?:\.([a-z0-9]+))?:[^@]*@([^/:]+)") {
        $refPooler = $Matches[1]
        $host_ = $Matches[2]
        if ($refPooler) { return $refPooler }
        if ($host_ -match "^db\.([a-z0-9]+)\.supabase\.co$") { return $Matches[1] }
        return $host_
    }
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
            Sair-ComErro "Nada colado, cancelando."
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

# --- Confirmacao de destino: nunca seguir sem o humano confirmar visualmente
# que origem e destino sao projetos diferentes. Comparar so a string inteira
# nao basta (o mesmo host pooler pode hospedar varios projetos Supabase) —
# comparamos o identificador do projeto extraido de cada uma.
$refOrigem = Obter-IdentificadorProjeto $origemUrl
$refDestino = Obter-IdentificadorProjeto $destinoUrl

if (-not $refOrigem -or -not $refDestino) {
    Sair-ComErro "Nao consegui identificar o projeto a partir de uma das connection strings. Confere se colou o formato certo (comeca com postgresql://)."
}

if ($refOrigem -eq $refDestino) {
    Sair-ComErro "Origem e destino parecem ser o MESMO projeto ($refOrigem). Cancelando por seguranca - isso nao pode rodar contra o proprio banco de producao."
}

Write-Host ""
Write-Host "Projeto de ORIGEM (producao):    $refOrigem" -ForegroundColor White
Write-Host "Projeto de DESTINO (homologacao): $refDestino" -ForegroundColor White
Write-Host ""
$confirmacao = Read-Host "Confirma que o projeto de DESTINO acima e mesmo o de homologacao? (digite sim)"
if ($confirmacao.Trim().ToLower() -ne "sim") {
    Sair-ComErro "Nao confirmado, cancelando."
}

# Arquivo de saida exclusivo desta execucao (nunca reaproveita um dump
# antigo/parcial de uma tentativa anterior que tenha falhado no meio).
$carimbo = Get-Date -Format "yyyyMMdd-HHmmss"
$saida = Join-Path $PSScriptRoot "schema-producao-$carimbo.sql"
if (Test-Path $saida) { Remove-Item $saida -Force }

Write-Host ""
Write-Host "Passo 1 de 2: baixando a estrutura da producao..." -ForegroundColor Cyan
& $pgDump $origemUrl --schema=public --schema-only --no-owner --no-privileges -f $saida
$exitDump = $LASTEXITCODE

if ($exitDump -ne 0) {
    Sair-ComErro "pg_dump terminou com erro (codigo $exitDump). Copia a mensagem acima e me manda - nao contem senha."
}

if (-not (Test-Path $saida) -or (Get-Item $saida).Length -eq 0) {
    Sair-ComErro "pg_dump nao reportou erro, mas o arquivo de saida ficou vazio ou nao foi criado. Copia qualquer mensagem acima e me manda."
}

Write-Host "OK, estrutura salva em: $saida" -ForegroundColor Green
Write-Host ""
Write-Host "Passo 2 de 2: aplicando no banco de homologacao..." -ForegroundColor Cyan

# -X ignora .psqlrc pessoal (evita comportamento inesperado de configuracao
# local); ON_ERROR_STOP faz o psql parar e retornar erro no primeiro
# comando SQL que falhar, em vez de seguir e reportar sucesso no final.
& $psql $destinoUrl -X -v "ON_ERROR_STOP=1" -f $saida
$exitPsql = $LASTEXITCODE

if ($exitPsql -ne 0) {
    Sair-ComErro "psql terminou com erro (codigo $exitPsql) ao aplicar a estrutura. Copia a mensagem acima e me manda - nao contem senha. O dump ficou salvo em $saida caso precise tentar de novo depois de eu ajustar algo."
}

Write-Host ""
Write-Host "Pronto! Estrutura copiada pro banco de homologacao." -ForegroundColor Green
Write-Host "(O que este script NAO copia: buckets/politicas de Storage, usuarios" -ForegroundColor Yellow
Write-Host "de Authentication, extensoes/funcoes fora do schema public, jobs" -ForegroundColor Yellow
Write-Host "agendados e integracoes externas. Me avisa que confiro o que falta.)" -ForegroundColor Yellow
Read-Host "Aperte Enter para fechar"

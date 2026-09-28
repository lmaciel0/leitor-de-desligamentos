@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0.."
set "PROJ_ROOT=%CD%"

:: 1. Localizar Java
where java >nul 2>&1
if errorlevel 1 (
    if defined JAVA_HOME (
        set "CLEAN_JAVA_HOME=%JAVA_HOME%"
        if "!CLEAN_JAVA_HOME:~-1!"=="\" set "CLEAN_JAVA_HOME=!CLEAN_JAVA_HOME:~0,-1!"
        if exist "!CLEAN_JAVA_HOME!\bin\java.exe" set "PATH=!CLEAN_JAVA_HOME!\bin;!PATH!"
    )
)
where java >nul 2>&1
if errorlevel 1 (
    for /d %%J in ("C:\Program Files\Microsoft\jdk-*" "%LOCALAPPDATA%\Programs\Eclipse Adoptium\jdk-*" "C:\Program Files\Eclipse Adoptium\jdk-*" "C:\Program Files\Java\jdk-*") do (
        if exist "%%J\bin\java.exe" (
            set "JAVA_HOME=%%J"
            set "PATH=%%J\bin;!PATH!"
        )
    )
)
where java >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Java 21 ou superior nao foi encontrado.
    echo Instale o JDK e certifique-se de configurar o PATH ou JAVA_HOME.
    pause
    exit /b 1
)

:: 2. Localizar Maven ou Maven Wrapper
set "MVN_CMD="
where mvn >nul 2>&1
if not errorlevel 1 (
    set "MVN_CMD=mvn"
) else if exist "%PROJ_ROOT%\backend\mvnw.cmd" (
    set "MVN_CMD=call .\mvnw.cmd"
) else if exist "%USERPROFILE%\Downloads\apache-maven-3.9.16\bin\mvn.cmd" (
    set "MVN_CMD="%USERPROFILE%\Downloads\apache-maven-3.9.16\bin\mvn.cmd""
)

if not defined MVN_CMD (
    echo [ERRO] Maven nao encontrado e mvnw.cmd nao disponivel.
    pause
    exit /b 1
)

title Leitor de Desligamentos

:: 3. Se o projeto ja estiver aberto, apenas abrir o navegador
curl.exe -s -f -o nul http://localhost:8080/api/saude >nul 2>&1
if not errorlevel 1 (
    echo O Leitor ja esta em execucao. Abrindo o navegador...
    start "" http://localhost:8080
    exit /b 0
)

:: 4. Gerar a versao final do frontend (servida pelo proprio backend)
echo Gerando o frontend...
cd /d "%PROJ_ROOT%\frontend"
if not exist "node_modules" call npm install
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro

:: 5. Abrir o navegador assim que a aplicacao responder (em segundo plano)
start "" powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 180; $i++) { try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:8080/api/saude).Content -eq 'ok') { Start-Process 'http://localhost:8080'; break } } catch {}; Start-Sleep 2 }"

:: 6. Iniciar o backend nesta janela (recompila o codigo alterado a cada inicializacao)
echo.
echo ==========================================================
echo  Leitor de Desligamentos iniciando em http://localhost:8080
echo  O navegador abrira automaticamente.
echo  Para encerrar, feche esta janela.
echo ==========================================================
echo.
cd /d "%PROJ_ROOT%\backend"
set "SPRING_WEB_RESOURCES_STATICLOCATIONS=file:../frontend/dist/"
%MVN_CMD% -q spring-boot:run
if errorlevel 1 goto erro
endlocal
exit /b 0

:erro
echo.
echo [ERRO] Nao foi possivel iniciar o Leitor. Veja as mensagens acima.
pause
exit /b 1

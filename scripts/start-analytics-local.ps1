$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$backend = docker inspect sarva-backend | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Start the existing local SARVA backend/database first.' }
$apiName = 'sarva-analytics-api'
$webName = 'sarva-analytics-web'
$existing = @(docker ps -a --format '{{.Names}}')
if ($apiName -notin $existing) {
  $argsList = @('run', '-d', '--name', $apiName, '--network', 'sarva_default', '-p', '127.0.0.1:5061:5050')
  foreach ($line in $backend[0].Config.Env) {
    if ($line -match '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|AUTH_SECRET)=') { $argsList += @('--env', $line) }
  }
  $argsList += @('--env', 'CATALOGUE_SYNC_ENABLED=false', '--mount', "type=bind,source=$projectRoot\backend\src,target=/app/src,readonly", '--mount', "type=bind,source=$projectRoot\backend\package.json,target=/app/package.json,readonly", '--mount', "type=bind,source=$projectRoot\backend\package-lock.json,target=/app/package-lock.json,readonly", '--entrypoint', 'sh', 'sarva-backend', '-c', 'npm ci --omit=dev --ignore-scripts --no-audit --no-fund && node src/server.js')
  & docker @argsList
} else { docker start $apiName }
if ($LASTEXITCODE -ne 0) { throw 'Could not start the analytics API.' }
if ($webName -notin $existing) {
  docker run -d --name $webName --network sarva_default -p 127.0.0.1:5174:5174 --env DEV_API_TARGET=http://sarva-analytics-api:5050 --env DEV_TILE_TARGET=http://host.docker.internal:3010 --mount "type=bind,source=$projectRoot\frontend,target=/source,readonly" --entrypoint sh sarva-backend -c 'mkdir -p /tmp/frontend; cp /source/package.json /source/package-lock.json /tmp/frontend/; cd /tmp/frontend; npm ci --include=dev --ignore-scripts --no-audit --no-fund && cp /source/index.html /source/vite.config.js . && ln -sfn /source/src src && ln -sfn /source/public public && node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5174 --strictPort'
} else { docker start $webName }
if ($LASTEXITCODE -ne 0) { throw 'Could not start the analytics frontend.' }
Write-Output 'Local analytics: http://127.0.0.1:5174/analytics (allow a few seconds for initial dependency installation).'
Write-Output 'Stop with: docker stop sarva-analytics-api sarva-analytics-web'

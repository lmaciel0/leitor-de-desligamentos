#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:5173"

MVN_CMD="mvn"
if ! command -v mvn &> /dev/null; then
  if [ -f "$ROOT/backend/mvnw" ]; then
    chmod +x "$ROOT/backend/mvnw"
    MVN_CMD="./mvnw"
  fi
fi

(cd "$ROOT/backend" && ([ -f target/leitor-desligamentos-1.0.0.jar ] || $MVN_CMD -q -DskipTests package) && java -jar target/leitor-desligamentos-1.0.0.jar) &
(cd "$ROOT/frontend" && ([ -d node_modules ] || npm install) && npm run dev) &
wait

#!/usr/bin/env bash
# Compila as extensões pedidas e sobe o emulador do Owlbear (hospedeiro em :8001, extensões em :8002).
# Uso: tools/emulador/run.sh gatilhos [arsenal ...]
set -e
D="$(cd "$(dirname "$0")" && pwd)"
for n in "$@"; do
  (cd "$D/../../extensoes/$n" && { [ -d node_modules ] || npm install --silent; } && BASE="/$n/" npx vite build --outDir "$D/.ext/$n" --emptyOutDir >/dev/null)
  echo "compilado: $n"
done
exec python3 "$D/serve.py" "$D"

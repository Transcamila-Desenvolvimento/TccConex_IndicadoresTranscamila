#!/bin/bash
# Azure App Service (Linux) — deps no container (GLIBC compatível), cache persistente.
# Portal / CLI: Startup Command = bash startup.sh
set -e

echo "== TccConex ERP startup.sh v8 =="
export PYTHONUNBUFFERED=1
cd "$(dirname "$0")"

rm -rf "$(pwd)/antenv" "$(pwd)/.python_packages" "$(pwd)/vendor" 2>/dev/null || true
unset VIRTUAL_ENV PYTHONPATH
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

CACHE_ROOT="/home/site/python_packages"
CACHE_DIR="${CACHE_ROOT}/lib/site-packages"
REQ_HASH_FILE="${CACHE_ROOT}/.requirements_sha256"
PORT="${WEBSITES_PORT:-8000}"

verify_python_deps() {
  local target_dir="$1"
  PYTHONPATH="$target_dir" python -c "import django, asgiref, gunicorn, rest_framework, cryptography, xlrd; from cryptography.hazmat.bindings._rust import exceptions"
}

python_deps_ok() {
  [ -d "$CACHE_DIR" ] || return 1
  [ -f "$REQ_HASH_FILE" ] || return 1
  verify_python_deps "$CACHE_DIR" 2>/dev/null
}

requirements_changed() {
  [ ! -f "$REQ_HASH_FILE" ] && return 0
  local current
  current=$(sha256sum requirements.txt | awk '{print $1}')
  [ "$(cat "$REQ_HASH_FILE")" != "$current" ]
}

# Remove leftovers de installs interrompidos (evita encher /home/site).
rm -rf "${CACHE_ROOT}".tmp.* 2>/dev/null || true

if python_deps_ok && ! requirements_changed; then
  echo "== TccConex ERP: deps em cache (/home/site/python_packages) =="
else
  echo "== TccConex ERP: instalando deps no container (GLIBC do Azure) =="
  CACHE_TMP="${CACHE_ROOT}.tmp.$$"
  rm -rf "$CACHE_TMP" 2>/dev/null || true
  mkdir -p "${CACHE_TMP}/lib/site-packages"
  python -m pip install --no-cache-dir -r requirements.txt --target "${CACHE_TMP}/lib/site-packages"
  echo "== TccConex ERP: validando deps no cache temporario =="
  verify_python_deps "${CACHE_TMP}/lib/site-packages"
  echo "== TccConex ERP: promovendo cache de deps =="
  rm -rf "$CACHE_ROOT" 2>/dev/null || true
  mv "$CACHE_TMP" "$CACHE_ROOT"
  sha256sum requirements.txt | awk '{print $1}' > "$REQ_HASH_FILE"
  echo "== TccConex ERP: deps instaladas em cache =="
fi

export PYTHONPATH="$CACHE_DIR"
echo "== TccConex ERP: PYTHONPATH=$PYTHONPATH =="

if [ "$RUN_STARTUP_MIGRATE" = "True" ]; then
  echo "== TccConex ERP: aplicando migrations =="
  python manage.py migrate --noinput || echo "== AVISO: migrate falhou; seguindo com gunicorn =="
else
  echo "== TccConex ERP: migrate ignorado (padrao producao) =="
fi

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: worker Celery em background =="
  python -m celery -A prothon worker -l warning --concurrency=1 &
fi

echo "== TccConex ERP: iniciando gunicorn na porta ${PORT} =="
exec python -m gunicorn prothon.wsgi:application \
  --bind="0.0.0.0:${PORT}" \
  --timeout 600 \
  --workers 1 \
  --access-logfile - \
  --error-logfile -

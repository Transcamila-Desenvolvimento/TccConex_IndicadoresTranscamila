#!/bin/bash
# Azure App Service (Linux) — boot rápido e estável.
# Portal: Configuration > General settings > Startup Command = bash startup.sh
set -e

export PYTHONUNBUFFERED=1
cd "$(dirname "$0")"

rm -rf "$(pwd)/antenv" "$(pwd)/.python_packages" 2>/dev/null || true
unset VIRTUAL_ENV PYTHONPATH
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

VENDOR_DIR="$(pwd)/vendor/site-packages"
CACHE_DIR="/home/site/python_packages/lib/site-packages"

pick_pythonpath() {
  if [ -d "$VENDOR_DIR" ] && PYTHONPATH="$VENDOR_DIR" python -c "import django, asgiref, gunicorn, rest_framework" 2>/dev/null; then
    export PYTHONPATH="$VENDOR_DIR"
    echo "== TccConex ERP: deps do pacote (vendor) =="
    return 0
  fi
  if [ -d "$CACHE_DIR" ] && PYTHONPATH="$CACHE_DIR" python -c "import django, asgiref, gunicorn, rest_framework" 2>/dev/null; then
    export PYTHONPATH="$CACHE_DIR"
    echo "== TccConex ERP: deps em cache (/home/site/python_packages) =="
    return 0
  fi
  return 1
}

if ! pick_pythonpath; then
  echo "== TccConex ERP: fallback — instalando deps (1ª vez ou pacote incompleto) =="
  mkdir -p "$CACHE_DIR"
  python -m pip install --no-cache-dir -r requirements.txt --target "$CACHE_DIR"
  export PYTHONPATH="$CACHE_DIR"
  PYTHONPATH="$CACHE_DIR" python -c "import django, asgiref, gunicorn, rest_framework"
  echo "== TccConex ERP: deps instaladas em cache =="
fi

echo "== TccConex ERP: PYTHONPATH=$PYTHONPATH =="

# Schema já aplicado no Postgres via SSH. Só rode migrate manualmente quando houver migration nova.
if [ "$RUN_STARTUP_MIGRATE" = "True" ]; then
  echo "== TccConex ERP: aplicando migrations =="
  python manage.py migrate --noinput || echo "== AVISO: migrate falhou; seguindo com gunicorn =="
else
  echo "== TccConex ERP: migrate ignorado (padrão produção) =="
fi

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: worker Celery em background =="
  python -m celery -A prothon worker -l warning --concurrency=1 &
fi

echo "== TccConex ERP: iniciando gunicorn =="
exec python -m gunicorn prothon.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --workers 1 \
  --access-logfile - \
  --error-logfile -

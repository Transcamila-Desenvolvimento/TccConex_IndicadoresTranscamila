#!/bin/bash
# Comando de inicialização do Azure App Service (Linux, runtime Python).
# Configurar em: App Service > Configuration > General settings > Startup Command
#   bash startup.sh
set -e

# Venv antigo (antenv) gerado no CI quebra no container Azure (GLIBC/symlinks).
rm -rf "$(pwd)/antenv" 2>/dev/null || true
unset VIRTUAL_ENV
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

PACKAGES_DIR="$(pwd)/.python_packages/lib/site-packages"
DEPS_MARKER="$(pwd)/.python_packages/.deps_ok"

python_deps_ok() {
  [ -f "$DEPS_MARKER" ] || return 1
  PYTHONPATH="$PACKAGES_DIR" python -c "import django, asgiref, gunicorn, rest_framework" 2>/dev/null
}

if ! python_deps_ok; then
  echo "== TccConex ERP: instalando dependências Python =="
  rm -rf "$(pwd)/.python_packages"
  mkdir -p "$PACKAGES_DIR"
  python -m pip install --no-cache-dir -r requirements.txt --target "$PACKAGES_DIR"
  PYTHONPATH="$PACKAGES_DIR" python -c "import django, asgiref, gunicorn, rest_framework"
  touch "$DEPS_MARKER"
  echo "== TccConex ERP: dependências Python OK =="
fi

export PYTHONPATH="${PACKAGES_DIR}:${PYTHONPATH:-}"

echo "== TccConex ERP: aplicando migrations =="
python manage.py migrate --noinput

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: iniciando worker Celery em background =="
  python -m celery -A prothon worker -l info --concurrency=2 &
fi

echo "== TccConex ERP: iniciando gunicorn =="
exec python -m gunicorn prothon.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --workers 3

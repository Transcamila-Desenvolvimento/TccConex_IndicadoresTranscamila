#!/bin/bash
# Comando de inicialização do Azure App Service (Linux, runtime Python).
# Configurar em: App Service > Configuration > General settings > Startup Command
#   bash startup.sh
set -e

export PYTHONUNBUFFERED=1

# Venv antigo (antenv) gerado no CI quebra no container Azure (GLIBC/symlinks).
rm -rf "$(pwd)/antenv" 2>/dev/null || true
# Oryx/deploys antigos deixam pacotes quebrados aqui — remover sempre.
rm -rf "$(pwd)/.python_packages" 2>/dev/null || true
unset VIRTUAL_ENV
unset PYTHONPATH
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

# Fora do wwwroot: sobrevive a zip deploy com clean:true (só wwwroot é substituído).
PACKAGES_ROOT="/home/site/python_packages"
PACKAGES_DIR="${PACKAGES_ROOT}/lib/site-packages"
DEPS_MARKER="${PACKAGES_ROOT}/.deps_ok"
REQ_HASH_FILE="${PACKAGES_ROOT}/.requirements_sha256"
MIGRATIONS_MARKER="/home/site/.migrations_ok"

python_deps_ok() {
  [ -f "$DEPS_MARKER" ] || return 1
  PYTHONPATH="$PACKAGES_DIR" python -c "import django, asgiref, gunicorn, rest_framework" 2>/dev/null
}

requirements_changed() {
  [ ! -f "$REQ_HASH_FILE" ] && return 0
  local current
  current=$(sha256sum requirements.txt | awk '{print $1}')
  [ "$(cat "$REQ_HASH_FILE")" != "$current" ]
}

if ! python_deps_ok || requirements_changed; then
  echo "== TccConex ERP: instalando dependências Python =="
  rm -rf "$PACKAGES_ROOT" "$(pwd)/.python_packages"
  mkdir -p "$PACKAGES_DIR"
  python -m pip install --no-cache-dir -r requirements.txt --target "$PACKAGES_DIR"
  PYTHONPATH="$PACKAGES_DIR" python -c "import django, asgiref, gunicorn, rest_framework"
  sha256sum requirements.txt | awk '{print $1}' > "$REQ_HASH_FILE"
  touch "$DEPS_MARKER"
  echo "== TccConex ERP: dependências Python OK =="
else
  echo "== TccConex ERP: dependências Python em cache =="
fi

# Nunca herdar PYTHONPATH do Oryx (aponta para wwwroot/.python_packages quebrado).
unset PYTHONPATH
export PYTHONPATH="$PACKAGES_DIR"

echo "== TccConex ERP: PYTHONPATH=$PYTHONPATH =="

# migrate bloqueia o gunicorn. No Azure o schema já foi aplicado via SSH;
# pule com SKIP_STARTUP_MIGRATE=True ou deixe o marker após a 1ª execução bem-sucedida.
if [ "$SKIP_STARTUP_MIGRATE" = "True" ] || [ -f "$MIGRATIONS_MARKER" ]; then
  echo "== TccConex ERP: migrate ignorado (schema já aplicado) =="
else
  echo "== TccConex ERP: aplicando migrations =="
  if python manage.py migrate --noinput; then
    touch "$MIGRATIONS_MARKER"
    echo "== TccConex ERP: migrations OK =="
  else
    echo "== TccConex ERP: AVISO — migrate falhou; subindo gunicorn mesmo assim =="
  fi
fi

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: iniciando worker Celery em background =="
  python -m celery -A prothon worker -l info --concurrency=2 &
fi

echo "== TccConex ERP: iniciando gunicorn =="
exec python -m gunicorn prothon.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --workers 2 \
  --access-logfile - \
  --error-logfile -

#!/bin/bash
# Azure App Service (Linux) — deps no container (GLIBC compatível), cache persistente.
# Portal / CLI: Startup Command = bash startup.sh
set -e

echo "== TccConex ERP startup.sh v10 =="
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
  PYTHONPATH="$target_dir" python -c "import django, asgiref, channels, daphne, rest_framework, cryptography, xlrd; from cryptography.hazmat.bindings._rust import exceptions"
}

requirements_changed() {
  [ ! -f "$REQ_HASH_FILE" ] && return 0
  local current
  current=$(sha256sum requirements.txt | awk '{print $1}')
  [ "$(cat "$REQ_HASH_FILE")" != "$current" ]
}

write_requirements_hash() {
  sha256sum requirements.txt | awk '{print $1}' > "$REQ_HASH_FILE"
}

# Dois boots ao mesmo tempo apagavam o cache um do outro. O lock serializa a troca.
exec 9>/home/site/tccconex-startup.lock
if command -v flock >/dev/null 2>&1; then
  echo "== TccConex ERP: aguardando lock de startup =="
  flock 9
fi

# Reaproveita uma instalação já pronta (irmã ou aninhada por um promote antigo).
pick_ready_install() {
  shopt -s nullglob
  local dirs=(/home/site/python_packages.tmp.* /home/site/python_packages/python_packages.tmp.*)
  shopt -u nullglob
  [ "${#dirs[@]}" -eq 0 ] && return 1
  local d
  while IFS= read -r d; do
    [ -n "$d" ] || continue
    [ -d "${d}/lib/site-packages" ] || continue
    if verify_python_deps "${d}/lib/site-packages" 2>/dev/null; then
      printf '%s\n' "$d"
      return 0
    fi
  done < <(ls -td "${dirs[@]}")
  return 1
}

# Renomeia o cache antigo para fora do caminho. rm -rf + mv aninhava a instalação
# nova dentro da pasta que o Azure Files não tinha apagado, e o migrate subia sem Django.
promote_tree() {
  local src="$1"
  local bak="${CACHE_ROOT}.bak.$$"
  local staged="$src"

  case "$src" in
    "$CACHE_ROOT"|"$CACHE_ROOT"/*)
      staged="/home/site/python_packages.promote.$$"
      rm -rf "$staged"
      mv "$src" "$staged"
      ;;
  esac

  if [ -d "$CACHE_ROOT" ]; then
    rm -rf "$bak"
    if ! mv "$CACHE_ROOT" "$bak"; then
      echo "== TccConex ERP: nao consegui afastar o cache antigo =="
      exit 1
    fi
  fi
  if [ -e "$CACHE_ROOT" ]; then
    echo "== TccConex ERP: cache de destino ainda existe; abortando =="
    exit 1
  fi
  if ! mv "$staged" "$CACHE_ROOT"; then
    echo "== TccConex ERP: falha ao promover o cache =="
    if [ -d "$bak" ]; then
      mv "$bak" "$CACHE_ROOT" || true
    fi
    exit 1
  fi
  if [ -d "$bak" ]; then
    nohup rm -rf "$bak" >/dev/null 2>&1 &
  fi
}

if [ -d "$CACHE_DIR" ] && ! requirements_changed && verify_python_deps "$CACHE_DIR" 2>/dev/null; then
  echo "== TccConex ERP: deps em cache (/home/site/python_packages) =="
else
  ready="$(pick_ready_install || true)"
  if [ -n "$ready" ]; then
    echo "== TccConex ERP: reaproveitando instalacao pronta em ${ready} =="
  else
    echo "== TccConex ERP: instalando deps no container (GLIBC do Azure) =="
    ready="${CACHE_ROOT}.tmp.$$"
    rm -rf "$ready"
    mkdir -p "${ready}/lib/site-packages"
    python -m pip install --no-cache-dir -r requirements.txt --target "${ready}/lib/site-packages"
    echo "== TccConex ERP: validando deps no cache temporario =="
    verify_python_deps "${ready}/lib/site-packages"
  fi
  echo "== TccConex ERP: promovendo cache de deps =="
  promote_tree "$ready"
  if ! verify_python_deps "$CACHE_DIR"; then
    echo "== TccConex ERP: django ausente depois de promover o cache =="
    ls "$CACHE_DIR" 2>/dev/null | head || true
    exit 1
  fi
  write_requirements_hash
  echo "== TccConex ERP: deps instaladas em cache =="
  shopt -s nullglob
  leftovers=(/home/site/python_packages.tmp.* /home/site/python_packages.promote.*)
  shopt -u nullglob
  if [ "${#leftovers[@]}" -gt 0 ]; then
    nohup rm -rf "${leftovers[@]}" >/dev/null 2>&1 &
  fi
fi

if command -v flock >/dev/null 2>&1; then
  flock -u 9 || true
fi
exec 9>&-

export PYTHONPATH="$CACHE_DIR"
echo "== TccConex ERP: PYTHONPATH=$PYTHONPATH =="

# Por padrão aplica migrations no boot (deploy Azure). Desative com RUN_STARTUP_MIGRATE=False.
if [ "${RUN_STARTUP_MIGRATE:-True}" = "True" ]; then
  echo "== TccConex ERP: aplicando migrations =="
  python manage.py migrate --noinput
else
  echo "== TccConex ERP: migrate ignorado (RUN_STARTUP_MIGRATE=False) =="
fi

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: worker Celery em background =="
  python -m celery -A prothon worker -l warning --concurrency=1 &
fi

echo "== TccConex ERP: iniciando daphne (ASGI + WebSocket) na porta ${PORT} =="
exec python -m daphne -b 0.0.0.0 -p "${PORT}" prothon.asgi:application

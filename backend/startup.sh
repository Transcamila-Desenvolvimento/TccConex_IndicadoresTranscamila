#!/bin/bash
# Comando de inicialização do Azure App Service (Linux, runtime Python).
# Configurar em: App Service > Configuration > General settings > Startup Command
#   bash startup.sh
#
# Roda o worker do Celery em background (mesmo container/filesystem do web,
# necessário porque as importações usam arquivos temporários em backend/tmp/imports)
# e o gunicorn em foreground (processo observado pelo App Service).
set -e

# Usa o venv empacotado no deploy (antenv); cria se ausente (ex.: deploy antigo).
if [ ! -x "./antenv/bin/python" ]; then
  echo "== TccConex ERP: antenv ausente, instalando dependências =="
  python -m venv antenv
  ./antenv/bin/pip install --upgrade pip
  ./antenv/bin/pip install -r requirements.txt
fi

if [ -x "./antenv/bin/python" ]; then
  PYTHON="./antenv/bin/python"
  GUNICORN="./antenv/bin/gunicorn"
  CELERY="./antenv/bin/celery"
else
  PYTHON="python"
  GUNICORN="gunicorn"
  CELERY="celery"
fi

echo "== TccConex ERP: aplicando migrations =="
"$PYTHON" manage.py migrate --noinput

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: iniciando worker Celery em background =="
  "$CELERY" -A prothon worker -l info --concurrency=2 &
fi

echo "== TccConex ERP: iniciando gunicorn =="
exec "$GUNICORN" prothon.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --workers 3

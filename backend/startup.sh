#!/bin/bash
# Comando de inicialização do Azure App Service (Linux, runtime Python).
# Configurar em: App Service > Configuration > General settings > Startup Command
#   bash startup.sh
#
# Roda o worker do Celery em background (mesmo container/filesystem do web,
# necessário porque as importações usam arquivos temporários em backend/tmp/imports)
# e o gunicorn em foreground (processo observado pelo App Service).
set -e

echo "== TccConex ERP: aplicando migrations =="
python manage.py migrate --noinput

if [ "$USE_CELERY" = "True" ]; then
  echo "== TccConex ERP: iniciando worker Celery em background =="
  celery -A prothon worker -l info --concurrency=2 &
fi

echo "== TccConex ERP: iniciando gunicorn =="
exec gunicorn prothon.wsgi:application \
  --bind=0.0.0.0:8000 \
  --timeout 600 \
  --workers 3

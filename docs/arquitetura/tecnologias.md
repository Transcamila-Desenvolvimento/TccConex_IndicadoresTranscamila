# Tecnologias

Versões declaradas nos manifestos, não as resolvidas no lock além do que o arquivo pede.

## Frontend (`frontend/package.json`)

React 19, TypeScript, Vite, React Router 7, Axios, TanStack Query 5, Chart.js e react-chartjs-2, Bootstrap 5, ExcelJS, jsPDF e html2canvas. O script `build` é `tsc -b && vite build`. Node no workflow de deploy: 20.

## Backend (`backend/requirements.txt`)

Django 5, Django REST Framework, PyJWT, psycopg2, django-cors-headers, Channels, Daphne, WhiteNoise, Celery com Redis, openpyxl, xlrd, pypdf, python-docx, xhtml2pdf, reportlab, Pillow, pywebpush, cryptography e gunicorn. Python no workflow: 3.12. O processo de produção usado pelo `startup.sh` é o Daphne, não o gunicorn.

## Banco

SQLite quando não há `USE_POSTGRES=True` nem `DB_HOST`. Com qualquer um dos dois, PostgreSQL. O guia de implantação cita Azure Database for PostgreSQL e Azure Cache for Redis.

## Ferramenta desta central

MkDocs e MkDocs Material ficam em `docs/requirements.txt`. Esse arquivo não entra em `backend/requirements.txt`.

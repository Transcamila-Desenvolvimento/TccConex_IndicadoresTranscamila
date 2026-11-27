# Ambiente local

Fonte: `start.ps1`, `backend/requirements.txt`, `frontend/package.json` e `backend/.env.example`.

## Pré-requisitos

Python 3.12, Node 20 e npm. Redis só é necessário com `USE_CELERY=True`. PostgreSQL local só é necessário se `DB_HOST` ou `USE_POSTGRES` estiverem definidos. Sem isso, o Django usa SQLite.

## Instalação

```powershell
python -m virtualenv backend\venv_local
backend\venv_local\Scripts\pip install -r backend\requirements.txt
cd frontend
npm ci
```

Copie `backend/.env.example` para `backend/.env` e preencha só o que for usar. O arquivo `.env` não entra no Git.

Migrations do banco local:

```powershell
cd backend
.\venv_local\Scripts\python.exe manage.py migrate
```

## Execução

Na raiz, `.\start.ps1` sobe o Django em `0.0.0.0:8001` e o Vite em `http://localhost:5173`.

Testes existentes:

```powershell
cd backend
.\venv_local\Scripts\python.exe manage.py test
```

Documentação, com um ambiente que tenha o MkDocs instalado a partir de `docs/requirements.txt`:

```powershell
mkdocs build --strict
```

O HTML sai em `site/`, que o Git ignora.

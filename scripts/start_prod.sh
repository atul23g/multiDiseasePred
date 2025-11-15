#!/usr/bin/env bash

set -euo pipefail

echo "==> Starting Disease AI API (production)"

# Load .env if present (Railway provides env via platform, so .env is optional)
if [ -f .env ]; then
  echo "ℹ️ Loading .env"
  # shellcheck disable=SC1090
  set -a; source .env; set +a
else
  echo "ℹ️ .env not found; relying on platform environment variables"
fi

# Activate venv if available
if [ -z "${VIRTUAL_ENV:-}" ] && [ -d "venv" ]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

# Minimal runtime checks (uses platform env; .env loaded above if present)
python - <<'PY'
import os
required = [
  ("DATABASE_URL", False),
]
missing = [k for k,allow_empty in required if not os.getenv(k) and not allow_empty]
if missing:
  raise SystemExit(f"Missing required env vars: {', '.join(missing)}")
print("✅ Env check passed")
PY

# Bind to Railway PORT if provided
if [ -n "${PORT:-}" ]; then
  export GUNICORN_BIND="0.0.0.0:${PORT}"
else
  export GUNICORN_BIND=${GUNICORN_BIND:-0.0.0.0:8000}
fi
export GUNICORN_WORKERS=${GUNICORN_WORKERS:-$(python - <<'PY'
import multiprocessing
print(multiprocessing.cpu_count()*2+1)
PY
)}
export GUNICORN_WORKER_CLASS=${GUNICORN_WORKER_CLASS:-uvicorn.workers.UvicornWorker}

# Launch
exec gunicorn -c scripts/gunicorn_conf.py src.api.main:app

.PHONY: build start stop restart local_start local_stop local_restart

build:
	@docker compose build

start:
	@docker compose up -d

stop:
	@docker compose down

restart:
	@docker compose restart

local_start:
	@mkdir -p .run
	@nohup env PYTHONPATH=backend backend/.venv/bin/python -m app.main </dev/null > .run/backend.log 2>&1 &
	@nohup npm run --prefix frontend dev -- --port 5173 </dev/null > .run/frontend.log 2>&1 &
	@echo "Started: http://localhost:5173 (front), http://localhost:8000 (api)"

local_stop:
	@-pkill -f '[a]pp.main' || true
	@-pkill -f '[v]ite --port 5173' || true

local_restart: local_stop local_start
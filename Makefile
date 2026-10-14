# Xpektrum Laser on Ghost 6 – run from the repo root.
#   make up && make import        local site at GHOST_URL (default http://localhost:2368)
#   make help                     all targets
# ENV_FILE selects another env file in ghost-migration/ (e.g. a throwaway stack with its own COMPOSE_PROJECT_NAME).

ENV_FILE ?= .env
STACK    := ghost-migration
COMPOSE  := cd $(STACK) && docker compose --env-file $(ENV_FILE)
BACKUPS  := $(STACK)/backups
STAMP    := $(shell date +%Y%m%d-%H%M%S)

.DEFAULT_GOAL := help
.PHONY: help env up import reimport sync-settings down reset backup restore logs ps theme check

help: ## List targets
	@grep -hE '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create ghost-migration/.env from .env.example (edit the passwords before `make up`)
	@cd $(STACK) && { test -f $(ENV_FILE) && echo "$(ENV_FILE) exists – not touched" || \
		{ cp .env.example $(ENV_FILE) && chmod 600 $(ENV_FILE) && echo "Created $(STACK)/$(ENV_FILE) – set the passwords and admin email"; }; }

up: ## Start MySQL + Ghost and wait until both are healthy
	@cd $(STACK) && test -f $(ENV_FILE) || { echo "Missing $(ENV_FILE) in $(STACK)/ – run 'make env' first"; exit 1; }
	$(COMPOSE) up -d --wait

import: ## First run: owner, theme, content, routes, redirects, settings. Re-runs: checks only (idempotent)
	cd $(STACK) && ENV_FILE=$(ENV_FILE) scripts/bootstrap.sh

reimport: ## Wipe posts/pages/tags, import again and re-apply routes/redirects/settings (keeps staff)
	cd $(STACK) && ENV_FILE=$(ENV_FILE) FORCE_IMPORT=1 scripts/bootstrap.sh

sync-settings: ## Re-apply routes, redirects, navigation/site settings and theme settings from content-export/ and .env (overwrites Admin edits)
	cd $(STACK) && ENV_FILE=$(ENV_FILE) SYNC_SETTINGS=1 scripts/bootstrap.sh

down: ## Stop the stack (data kept)
	$(COMPOSE) down

reset: ## DESTROY the database and content volumes, then reinstall from scratch (asks first)
	@printf 'This deletes the MySQL and Ghost content volumes for $(ENV_FILE). Type "reset" to continue: '; \
		read ans; [ "$$ans" = "reset" ] || { echo "Aborted"; exit 1; }
	$(COMPOSE) down -v
	$(MAKE) up import ENV_FILE=$(ENV_FILE)

backup: ## Dump MySQL and archive content/ (images, settings files) to ghost-migration/backups/<timestamp>/
	@mkdir -p $(BACKUPS)/$(STAMP)
	$(COMPOSE) exec -T db sh -c 'MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --no-tablespaces -uroot "$$MYSQL_DATABASE"' \
		| gzip > $(CURDIR)/$(BACKUPS)/$(STAMP)/ghost-db.sql.gz
	$(COMPOSE) exec -T ghost tar -C /var/lib/ghost/content --exclude=./themes/xpektrum-laser -czf - . \
		> $(CURDIR)/$(BACKUPS)/$(STAMP)/ghost-content.tar.gz
	@ls -lh $(BACKUPS)/$(STAMP)

restore: ## Restore a backup: make restore BACKUP=ghost-migration/backups/<timestamp>
	@test -n "$(BACKUP)" -a -f "$(BACKUP)/ghost-db.sql.gz" -a -f "$(BACKUP)/ghost-content.tar.gz" || \
		{ echo "Usage: make restore BACKUP=$(BACKUPS)/<timestamp>"; exit 1; }
	$(COMPOSE) up -d --wait db
	$(COMPOSE) stop ghost
	gunzip -c $(CURDIR)/$(BACKUP)/ghost-db.sql.gz | ($(COMPOSE) exec -T db sh -c 'MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$$MYSQL_DATABASE"')
	$(COMPOSE) run --rm --no-deps -T --entrypoint tar ghost -C /var/lib/ghost/content -xzf - < $(CURDIR)/$(BACKUP)/ghost-content.tar.gz
	$(COMPOSE) up -d --wait

logs: ## Follow Ghost logs
	$(COMPOSE) logs -f ghost

ps: ## Show stack status
	$(COMPOSE) ps

theme: ## Build theme assets and package theme/xpektrum-laser.zip (for uploading to another Ghost)
	npm run zip

check: ## gscan the theme and validate compose + scripts
	npx gscan theme/xpektrum-laser
	$(COMPOSE) config -q && echo "compose OK"
	bash -n $(STACK)/scripts/bootstrap.sh && echo "bootstrap OK"

.DEFAULT_GOAL := help
.PHONY: build check install update uninstall clean help

PACKAGE := fractal-grid.kwinscript
SCRIPTS := scripts/common scripts/install.sh scripts/update.sh scripts/uninstall.sh scripts/release.sh scripts/debug.sh

build: ## Package fractal-grid.kwinscript
	./scripts/release.sh

check: ## JS syntax, JSON validity, shell syntax
	node --check contents/code/main.js
	python3 -m json.tool metadata.json > /dev/null
	sh -n $(SCRIPTS)
	@echo "check: ok"

install: ## Install the KWin script (uninstall, package, install, reload)
	./scripts/install.sh

update: ## Reinstall the KWin script
	./scripts/update.sh

uninstall: ## Remove the KWin script and its shortcuts
	./scripts/uninstall.sh

clean: ## Remove the built package
	rm -f $(PACKAGE)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
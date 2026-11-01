# Godhuli Shop — build orchestration
SHELL       := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

APP         := godhuli-shop
VERSION     ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
REGISTRY    ?= ghcr.io/godhuli
IMAGE       := $(REGISTRY)/$(APP):$(VERSION)
BUILD_DIR   := build
SRCS        := $(wildcard src/*.c)
OBJS        := $(patsubst src/%.c,$(BUILD_DIR)/%.o,$(SRCS))
CFLAGS      += -Wall -Wextra -O2 -DVERSION=\"$(VERSION)\"

UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  OPEN := open
else ifeq ($(OS),Windows_NT)
  OPEN := start
else
  OPEN := xdg-open
endif

ifdef CI
  PNPM_FLAGS := --frozen-lockfile --reporter=append-only
endif

.PHONY: help install dev test lint docker clean report

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[33m%-12s\033[0m %s\n", $$1, $$2}'

install: node_modules ## Install dependencies

node_modules: package.json pnpm-lock.yaml
	pnpm install $(PNPM_FLAGS)
	@touch $@

dev: install ## Run dev server
	pnpm dev --port $${PORT:-3000}

test: install ## Run tests with coverage
	pnpm vitest run --coverage

lint: install
	pnpm eslint . --max-warnings=0

$(BUILD_DIR)/%.o: src/%.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD_DIR)/report: $(OBJS)
	$(CC) $(LDFLAGS) $^ -o $@

$(BUILD_DIR):
	mkdir -p $@

report: $(BUILD_DIR)/report ## Build native report tool
	@echo "Built $(notdir $<) for $(UNAME_S)"

docker: ## Build container image
	docker build -f tooling/Dockerfile -t $(IMAGE) .
	@echo "Built $(IMAGE)"

clean: ## Remove build outputs
	$(RM) -r $(BUILD_DIR) dist coverage

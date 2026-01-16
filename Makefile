# Makefile para Contador Virtual

.PHONY: help install dev build up down logs test clean

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ==================== DESARROLLO ====================

install: ## Instala todas las dependencias
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev-backend: ## Inicia el backend en modo desarrollo
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Inicia el frontend en modo desarrollo
	cd frontend && npm run dev

# ==================== DOCKER ====================

up: ## Levanta todos los servicios con Docker
	docker-compose up -d

down: ## Detiene todos los servicios
	docker-compose down

logs: ## Muestra los logs de los servicios
	docker-compose logs -f

build: ## Construye las imágenes Docker
	docker-compose build

# ==================== BASE DE DATOS ====================

db-migrate: ## Crea una nueva migración de Alembic
	cd backend && alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Aplica las migraciones pendientes
	cd backend && alembic upgrade head

db-downgrade: ## Revierte la última migración
	cd backend && alembic downgrade -1

# ==================== TESTS ====================

test: ## Ejecuta los tests del backend
	cd backend && pytest tests/ -v

test-cov: ## Ejecuta tests con cobertura
	cd backend && pytest tests/ -v --cov=app --cov-report=html

# ==================== LINTING ====================

lint-backend: ## Ejecuta linting en el backend
	cd backend && black app/ tests/ --check
	cd backend && isort app/ tests/ --check-only

lint-frontend: ## Ejecuta linting en el frontend
	cd frontend && npm run lint

format: ## Formatea el código
	cd backend && black app/ tests/
	cd backend && isort app/ tests/

# ==================== UTILIDADES ====================

clean: ## Limpia archivos temporales
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name node_modules -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

shell: ## Abre una shell en el contenedor backend
	docker-compose exec backend /bin/bash

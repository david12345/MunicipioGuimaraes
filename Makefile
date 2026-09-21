.PHONY: help setup setup-parse check-acesso fontes fetch etl quem-governa empresas contratos mapa-pessoal populacao limpar-venv

# O Python do sistema é gerido externamente (PEP 668) e recusa `pip install`.
# Todo o pipeline corre no venv local, que é criado por `make setup`.
VENV := .venv
PY   := $(VENV)/bin/python
PIP  := $(VENV)/bin/pip

help:
	@echo "make setup        - cria .venv e instala as dependências de download"
	@echo "make setup-parse  - acrescenta as dependências de extração (Fase 2)"
	@echo "make check-acesso - testa que fontes estão alcançáveis neste ambiente"
	@echo "make fetch        - descarrega os originais para data/raw/ (inclui descoberta)"
	@echo "make fontes       - gera data/processed/fontes.json"
	@echo "make quem-governa - extrai a secção 2: executivo.json + orgaos_eleitos.json"
	@echo "make empresas     - extrai a secção 9: empresas_municipais.json (resolve os NIF)"
	@echo "make contratos    - extrai a secção 8: contratos_<ano>.json (exige empresas)"
	@echo "make mapa-pessoal - extrai a secção 4: mapa_pessoal.json (só agregados)"
	@echo "make populacao    - extrai populacao.json (denominador das métricas per capita)"
	@echo "make etl          - fetch + fontes + parsers existentes"

$(PY):
	python3 -m venv $(VENV)
	$(PIP) install --quiet --upgrade pip

setup: $(PY)
	$(PIP) install -r requirements.txt

setup-parse: $(PY)
	$(PIP) install -r requirements-parse.txt

check-acesso: $(PY)
	$(PY) -m etl.run --check-acesso

fetch: $(PY)
	$(PY) -m etl.run --fase fetch

fontes: $(PY)
	$(PY) -m etl.run --fase fontes

quem-governa: $(PY)
	$(PY) -m etl.quem_governa

empresas: $(PY)
	$(PY) -m etl.empresas_participadas

# Depende de empresas: é de lá que vêm os NIF do perímetro de consolidação,
# sem os quais o dataset nacional não pode ser filtrado.
contratos: empresas
	$(PY) -m etl.contratos

mapa-pessoal: $(PY)
	$(PY) -m etl.mapa_pessoal

populacao: $(PY)
	$(PY) -m etl.populacao

etl: fetch fontes quem-governa empresas contratos mapa-pessoal populacao
	@echo ""
	@echo "Originais em data/raw/, normalizados em data/processed/."
	@echo "Parsers por implementar: orçamento e estrutura orgânica"
	@echo "(ver docs/qualidade_dados.md)."

limpar-venv:
	rm -rf $(VENV)

.PHONY: help setup setup-parse check-acesso fontes fetch etl

help:
	@echo "make setup        - dependências mínimas (fetch + fontes)"
	@echo "make setup-parse  - dependências de extração (Fase 2; exige ghostscript)"
	@echo "make check-acesso - testa que fontes estão alcançáveis neste ambiente"
	@echo "make fetch        - descarrega os originais para data/raw/"
	@echo "make fontes       - gera data/processed/fontes.json"
	@echo "make etl          - fetch + fontes (parsers: Fase 2, por implementar)"

setup:
	python3 -m pip install -r requirements.txt

setup-parse:
	python3 -m pip install -r requirements-parse.txt

check-acesso:
	python3 -m etl.run --check-acesso

fetch:
	python3 -m etl.run --fase fetch

fontes:
	python3 -m etl.run --fase fontes

etl: fetch fontes
	@echo ""
	@echo "Originais em data/raw/. Parsers por implementar (Fase 2)."
	@echo "Commita data/raw/ e o trabalho continua a partir daí."

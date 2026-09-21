.PHONY: help setup check-acesso fontes fetch etl clean-raw

help:
	@echo "make setup        - instala dependências Python"
	@echo "make check-acesso - testa que fontes estão alcançáveis neste ambiente"
	@echo "make fontes       - gera data/processed/fontes.json a partir de etl/sources.yaml"
	@echo "make fetch        - descarrega os originais para data/raw/"
	@echo "make etl          - pipeline completo (fetch + parse + validate)"

setup:
	python3 -m pip install -r requirements.txt

check-acesso:
	python3 -m etl.run --check-acesso

fontes:
	python3 -m etl.run --fase fontes

fetch:
	python3 -m etl.run --fase fetch

etl: fetch fontes
	@echo "Parsers por implementar na Fase 2 (bloqueados por L1 - ver docs/qualidade_dados.md)"

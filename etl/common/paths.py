"""Caminhos do projeto. Único sítio onde a estrutura de diretórios é definida."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
DOCS = ROOT / "docs"
SOURCES_YAML = ROOT / "etl" / "sources.yaml"

for _d in (RAW, PROCESSED):
    _d.mkdir(parents=True, exist_ok=True)

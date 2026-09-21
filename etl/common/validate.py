"""Validações bloqueantes (V1–V8 de docs/qualidade_dados.md).

Princípio: uma extração que falhe uma validação NÃO é publicada. As funções
levantam `ValidationError`; o `run.py` apanha, regista a discrepância e deixa o
indicador a `null` em vez de publicar um número errado.
"""
from __future__ import annotations

from dataclasses import dataclass, field

TOLERANCIA_EUR = 0.01  # V1: tolerância de arredondamento


class ValidationError(Exception):
    """Falha bloqueante: o dado não pode ser publicado."""


@dataclass
class Relatorio:
    """Acumula o resultado das validações para escrever em qualidade_dados.md."""

    ok: list[str] = field(default_factory=list)
    falhas: list[str] = field(default_factory=list)

    def check(self, nome: str, condicao: bool, detalhe: str = "") -> bool:
        if condicao:
            self.ok.append(nome)
        else:
            self.falhas.append(f"{nome}: {detalhe}")
        return condicao

    @property
    def passou(self) -> bool:
        return not self.falhas


def v1_soma_bate_total(soma: float, total_declarado: float, rotulo: str) -> None:
    """Soma das rubricas == total declarado no documento (±0,01 €)."""
    if total_declarado is None:
        raise ValidationError(f"V1 {rotulo}: total declarado ausente, impossível validar")
    if abs(soma - total_declarado) > TOLERANCIA_EUR:
        raise ValidationError(
            f"V1 {rotulo}: soma extraída {soma:.2f} € != total declarado "
            f"{total_declarado:.2f} € (dif. {soma - total_declarado:+.2f} €)"
        )


def v2_orcamento_equilibrado(receita: float, despesa: float) -> None:
    """O orçamento municipal é equilibrado por lei: receita total == despesa total."""
    if abs(receita - despesa) > TOLERANCIA_EUR:
        raise ValidationError(
            f"V2: receita {receita:.2f} € != despesa {despesa:.2f} € "
            f"(dif. {receita - despesa:+.2f} €)"
        )


def v3_ocupados_lte_previstos(linhas: list[dict]) -> None:
    """Postos ocupados nunca excedem os previstos; violação = erro de extração."""
    maus = [
        l for l in linhas
        if l.get("ocupados") is not None
        and l.get("previstos") is not None
        and l["ocupados"] > l["previstos"]
    ]
    if maus:
        ex = maus[0]
        raise ValidationError(
            f"V3: {len(maus)} linha(s) com ocupados > previstos; ex.: "
            f"{ex.get('unidade_organica')} / {ex.get('carreira')} "
            f"({ex['ocupados']} > {ex['previstos']})"
        )


def v5_serie_continua(anos: list[int]) -> list[int]:
    """Devolve os anos em falta no meio de uma série (lacuna a explicitar)."""
    if not anos:
        return []
    return sorted(set(range(min(anos), max(anos) + 1)) - set(anos))


def v6_fontes_resolvem(registos: list[dict], ids_validos: set[str]) -> None:
    """Integridade referencial: todo o registo aponta para uma fonte conhecida."""
    sem_fonte = [i for i, r in enumerate(registos) if not r.get("fonte_id")]
    if sem_fonte:
        raise ValidationError(
            f"V6: {len(sem_fonte)} registo(s) sem fonte_id (índices: {sem_fonte[:5]})"
        )
    orfaos = sorted(
        {r["fonte_id"] for r in registos}
        - {i for i in ids_validos}
        - {f"{i}-{a}" for i in ids_validos for a in range(2010, 2035)}
    )
    if orfaos:
        raise ValidationError(f"V6: fonte_id inexistente(s) em sources.yaml: {orfaos}")

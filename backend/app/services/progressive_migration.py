"""Read-only reconciliation for the progressive catalog migration.

The report is deliberately not an importer: it never creates mappings,
changes authority, copies rows, or writes to either source.
"""

from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.services.catalog_mapping import CatalogMappingService
from app.services.catalog_mapping_sources import PrismaMappingSource


@dataclass(frozen=True)
class ReconciliationReport:
    mode: str
    writes_performed: bool
    authority_changes: bool
    prisma_diagnostics: dict
    postgres_diagnostics: dict
    mappings_scanned: int
    mapping_statuses: dict[str, int]
    assessment_classes: dict[str, int]
    identity_drift_or_divergence: int

    def document(self) -> dict:
        return {
            'mode': self.mode,
            'writes_performed': self.writes_performed,
            'authority_changes': self.authority_changes,
            'prisma_diagnostics': self.prisma_diagnostics,
            'postgres_diagnostics': self.postgres_diagnostics,
            'mappings_scanned': self.mappings_scanned,
            'mapping_statuses': self.mapping_statuses,
            'assessment_classes': self.assessment_classes,
            'identity_drift_or_divergence': self.identity_drift_or_divergence,
        }


def dry_run(db: Session, prisma_path: Path, namespace: str, *, after_id: int = 0, limit: int = 1000) -> ReconciliationReport:
    source = PrismaMappingSource(prisma_path, namespace)
    service = CatalogMappingService(db, source)
    results = service.audit_links(after_id=after_id, limit=limit)
    statuses = Counter(result.status for result in results)
    classifications = Counter(
        result.assessment.classification
        for result in results
        if result.assessment is not None
    )
    drift = sum(
        1 for result in results
        if result.detail in {'identity_drift', 'source_missing_or_divergent', 'source_unavailable'}
    )
    return ReconciliationReport(
        mode='dry-run', writes_performed=False, authority_changes=False,
        prisma_diagnostics=source.diagnostics(),
        postgres_diagnostics=service.postgres_diagnostics(),
        mappings_scanned=len(results), mapping_statuses=dict(sorted(statuses.items())),
        assessment_classes=dict(sorted(classifications.items())),
        identity_drift_or_divergence=drift,
    )

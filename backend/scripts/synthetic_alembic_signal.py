class ExpectedSyntheticRollback(RuntimeError):
    """Reached only after the fixed rollback revision completes its DDL and DML."""

"""Plan by default; execute a single PostgreSQL smoke test only on explicit request."""

import argparse
import json

from docker_postgres_adapter import DockerPostgresAdapter, DockerSafetyError, IMAGE, _SMOKE_AUTHORIZATION

ERROR_CODES = {
    'PREFLIGHT_FAILED', 'IMAGE_VALIDATION_FAILED', 'PORT_UNAVAILABLE', 'CONTAINER_CREATE_FAILED',
    'INVALID_CONTAINER_ID', 'CONTAINER_INSPECTION_FAILED', 'CONTAINER_START_FAILED',
    'BOOTSTRAP_INPUT_FAILED', 'CONTAINER_EXITED_DURING_BOOTSTRAP', 'READINESS_TIMEOUT', 'READINESS_CHECK_FAILED',
    'POSTGRES_AUTHENTICATION_FAILED', 'POSTGRES_CONNECTION_FAILED', 'POSTGRES_INTERNAL_VERIFICATION_FAILED',
    'CLUSTER_IDENTITY_MISMATCH', 'BOOTSTRAP_CLEANUP_FAILED', 'CONTAINER_STOP_FAILED',
    'CONTAINER_REMOVE_FAILED', 'UNEXPECTED_ERROR',
    'DOCKER_ENV_CONFLICT', 'DOCKER_CONTEXT_MISMATCH', 'DOCKER_ENDPOINT_MISMATCH', 'DOCKER_UNAVAILABLE',
}


def run_smoke(controller: DockerPostgresAdapter) -> dict:
    authorization = _SMOKE_AUTHORIZATION
    def step(stage, code, operation):
        controller.stage = stage
        try:
            operation(authorization)
        except DockerSafetyError as error:
            specific = error.code if error.code in ERROR_CODES else code
            raise DockerSafetyError('Smoke verification failed.', code=specific, exit_code=error.exit_code) from None

    step('preflight', 'PREFLIGHT_FAILED', controller.preflight)
    step('container_create', 'CONTAINER_CREATE_FAILED', controller.create)
    step('container_start', 'CONTAINER_START_FAILED', controller.start)
    step('readiness', 'READINESS_CHECK_FAILED', controller.wait_ready)
    step('postgres_identity', 'POSTGRES_INTERNAL_VERIFICATION_FAILED', controller.cluster_identity)
    step('bootstrap_cleanup', 'BOOTSTRAP_CLEANUP_FAILED', controller.remove_bootstrap_file)
    step('container_stop_remove', 'CONTAINER_STOP_FAILED', controller.stop_and_remove)
    controller.stage = 'complete'
    return {'status': 'passed', 'image': IMAGE, 'container_removed': True}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--confirm-disposable', action='store_true')
    args = parser.parse_args(argv)
    if args.execute != args.confirm_disposable:
        print(json.dumps({'status': 'rejected', 'reason': 'Both execution flags are required.'}))
        return 2
    controller = DockerPostgresAdapter()
    if not args.execute:
        print(json.dumps({'status': 'plan', 'image': IMAGE, 'port': 55432, 'run_id': str(controller.plan.run_id)}))
        return 0
    try:
        print(json.dumps(run_smoke(controller)))
        return 0
    except Exception as error:
        code = error.code if isinstance(error, DockerSafetyError) and error.code in ERROR_CODES else 'UNEXPECTED_ERROR'
        exit_code = error.exit_code if isinstance(error, DockerSafetyError) and isinstance(error.exit_code, int) else None
        cleanup = controller.cleanup_state
        if cleanup == 'in_progress':
            cleanup = 'failed_or_uncertain'
            if controller.resource_state == 'removal_outcome_unknown' and code == 'CONTAINER_STOP_FAILED':
                code = 'CONTAINER_REMOVE_FAILED'
        print(json.dumps({'status': 'failed', 'stage': controller.stage, 'error_code': code,
                          'container_id': controller.container_id, 'run_id': str(controller.plan.run_id),
                          'exit_code': exit_code, 'observed_state': 'exited' if code == 'CONTAINER_EXITED_DURING_BOOTSTRAP' else None,
                          'bootstrap_marker': controller.bootstrap_marker,
                          'resource_state': controller.resource_state, 'cleanup': cleanup}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

module.exports = [
(()=>{"use strict";return[
"[project]/src/app/api/auth/register/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .object>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__ = __turbopack_context__.i("[project]/node_modules/zod/v3/external.js [app-route] (ecmascript) <export * as z .string>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/fastapi.ts [app-route] (ecmascript)");
;
;
;
;
const registrationSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$object$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().min(2, 'Informe seu nome.').max(100),
    email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().trim().email('Informe um e-mail válido.').max(254),
    cpf: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().optional(),
    password: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z__$2e$string$3e$__["z"].string().min(12, 'A senha deve ter ao menos 12 caracteres.').max(128)
});
function diagnosticHeaders(correlationId, source) {
    const headers = new Headers({
        'x-focus-correlation-id': correlationId
    });
    if (source) headers.set('x-focus-failure-source', source);
    return headers;
}
function bridgeFailure(error) {
    if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FastApiConnectionError"]) {
        return {
            code: error.code,
            type: `${error.errorName}/${error.causeCode}`,
            target: error.target,
            elapsedMs: error.elapsedMs
        };
    }
    if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FastApiConfigurationError"]) return {
        code: 'configuration',
        type: error.name
    };
    if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FastApiOriginError"]) {
        return {
            code: 'origin',
            type: error.name,
            receivedOrigin: error.receivedOrigin,
            requestOrigin: error.requestOrigin,
            expectedOrigin: error.expectedOrigin
        };
    }
    return {
        code: 'internal',
        type: error instanceof Error ? error.name : 'UnknownError'
    };
}
function safeBackendDetail(payload) {
    if (!payload || typeof payload !== 'object') return 'no-detail';
    const detail = 'detail' in payload ? payload.detail : undefined;
    if (typeof detail !== 'string') return 'no-detail';
    return detail.replace(/(password|token|cookie|authorization)\s*[:=]\s*[^\s;]+/gi, '$1=[redacted]').slice(0, 200);
}
function safeErrorMessage(error) {
    const value = error instanceof Error ? error.message : String(error);
    return value.replace(/(password|token|cookie|authorization)\s*[:=]\s*[^\s;]+/gi, '$1=[redacted]').replace(/(https?:\/\/)([^/\s@]+):([^@\s]+)@/gi, '$1[redacted]@').slice(0, 240);
}
function errorLogDetails(error) {
    const current = error instanceof Error ? error : undefined;
    const cause = current?.cause instanceof Error ? current.cause : undefined;
    const stack = current?.stack ?? '';
    const firstFrame = stack.split('\n').find((line)=>line.trim().startsWith('at '))?.trim() ?? 'none';
    const location = firstFrame.match(/(?:\(|\s)([^()\s]+):(\d+):(\d+)\)?$/);
    const functionMatch = firstFrame.match(/^at\s+(.+?)\s+\(/);
    return [
        `error_name=${current?.name ?? 'UnknownError'}`,
        `message=${safeErrorMessage(error)}`,
        `cause_name=${cause?.name ?? 'none'}`,
        `cause_code=${cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : 'none'}`,
        `file=${location?.[1] ?? 'unknown'}`,
        `line=${location?.[2] ?? 'unknown'}`,
        `column=${location?.[3] ?? 'unknown'}`,
        `function=${functionMatch?.[1] ?? 'unknown'}`,
        `stack=${safeErrorMessage(firstFrame)}`
    ].join(' ');
}
async function POST(request) {
    const correlationId = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])();
    let stage = 'request_validation';
    if ("TURBOPACK compile-time truthy", 1) console.info(`[auth:${correlationId}] register received`);
    let body;
    try {
        body = await request.json();
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Requisição inválida.'
        }, {
            status: 400,
            headers: diagnosticHeaders(correlationId, 'next_validation')
        });
    }
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.'
        }, {
            status: 400,
            headers: diagnosticHeaders(correlationId, 'next_validation')
        });
    }
    if (parsed.data.cpf?.trim()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'CPF ainda não está disponível no cadastro.'
        }, {
            status: 400,
            headers: diagnosticHeaders(correlationId, 'next_validation')
        });
    }
    try {
        stage = 'fastapi_request';
        const backend = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fastApiRequestFromNextRequest"])(request, '/auth/register', {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                name: parsed.data.name,
                email: parsed.data.email,
                password: parsed.data.password
            })
        }, correlationId);
        stage = 'fastapi_response';
        const payload = await backend.json().catch(()=>({}));
        if (!backend.ok && ("TURBOPACK compile-time value", "development") !== 'production') {
            console.error(`[auth:${correlationId}] FastAPI response HTTP ${backend.status} detail=${safeBackendDetail(payload)}`);
        }
        const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(backend.ok ? {
            user: payload
        } : {
            error: backend.status === 409 ? 'Não foi possível concluir o cadastro. Tente novamente.' : 'Não foi possível criar sua conta.'
        }, {
            status: backend.status,
            headers: diagnosticHeaders(correlationId, backend.ok ? undefined : 'fastapi_response')
        });
        if (!backend.ok) {
            response.headers.set('x-focus-error-type', 'fastapi_http');
            response.headers.set('x-focus-failure-stage', 'fastapi_response');
        }
        stage = 'copy_session_cookie';
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["copySetCookie"])(backend, response);
        return response;
    } catch (error) {
        const failure = bridgeFailure(error);
        if ("TURBOPACK compile-time truthy", 1) {
            const target = failure.target ? ` target=${failure.target}` : '';
            const elapsed = failure.elapsedMs === undefined ? '' : ` elapsed_ms=${failure.elapsedMs}`;
            console.error(`[auth:${correlationId}] stage=${failure.code === 'origin' ? 'next_origin' : stage} failure=${failure.code} error_type=${failure.type}${target}${elapsed} ${errorLogDetails(error)}`);
        }
        const isOriginFailure = failure.code === 'origin';
        const headers = diagnosticHeaders(correlationId, isOriginFailure ? 'next_origin' : 'next_bridge');
        headers.set('x-focus-error-type', failure.type);
        headers.set('x-focus-failure-stage', isOriginFailure ? 'next_origin' : stage);
        headers.set('x-focus-error-code', failure.code);
        if (failure.target) headers.set('x-focus-target', failure.target);
        if (failure.receivedOrigin) headers.set('x-focus-received-origin', failure.receivedOrigin);
        if (failure.requestOrigin) headers.set('x-focus-request-origin', failure.requestOrigin);
        if (failure.expectedOrigin) headers.set('x-focus-expected-origin', failure.expectedOrigin);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Não foi possível concluir o cadastro. Tente novamente.'
        }, {
            status: isOriginFailure ? 403 : 503,
            headers
        });
    }
}
}),
"[project]/src/lib/auth/fastapi.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FastApiConfigurationError",
    ()=>FastApiConfigurationError,
    "FastApiConnectionError",
    ()=>FastApiConnectionError,
    "FastApiOriginError",
    ()=>FastApiOriginError,
    "copySetCookie",
    ()=>copySetCookie,
    "fastApiRequest",
    ()=>fastApiRequest,
    "fastApiRequestFromNextRequest",
    ()=>fastApiRequestFromNextRequest,
    "isPostgresSession",
    ()=>isPostgresSession,
    "postgresSessionUser",
    ()=>postgresSessionUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$origin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/security/origin.ts [app-route] (ecmascript)");
;
;
;
const COOKIE_NAME = 'focus_session';
const REQUEST_TIMEOUT_MS = 10_000;
class FastApiConnectionError extends Error {
    code;
    correlationId;
    target;
    elapsedMs;
    errorName;
    causeCode;
    constructor(code, correlationId, target, elapsedMs, errorName, causeCode){
        super(code === 'timeout' ? 'FastAPI request timed out' : 'FastAPI connection failed'), this.code = code, this.correlationId = correlationId, this.target = target, this.elapsedMs = elapsedMs, this.errorName = errorName, this.causeCode = causeCode;
        this.name = 'FastApiConnectionError';
    }
}
class FastApiConfigurationError extends Error {
    correlationId;
    code;
    constructor(correlationId, message){
        super(message), this.correlationId = correlationId, this.code = 'configuration';
        this.name = 'FastApiConfigurationError';
    }
}
class FastApiOriginError extends Error {
    correlationId;
    receivedOrigin;
    requestOrigin;
    expectedOrigin;
    code;
    constructor(correlationId, receivedOrigin, requestOrigin, expectedOrigin){
        super('Request origin rejected'), this.correlationId = correlationId, this.receivedOrigin = receivedOrigin, this.requestOrigin = requestOrigin, this.expectedOrigin = expectedOrigin, this.code = 'origin';
        this.name = 'FastApiOriginError';
    }
}
function errorCode(error) {
    if (!error || typeof error !== 'object') return 'none';
    const code = 'code' in error ? error.code : undefined;
    return typeof code === 'string' ? code : 'none';
}
function errorName(error) {
    return error instanceof Error && error.name ? error.name : 'UnknownError';
}
function isTimeout(error) {
    const names = new Set();
    let current = error;
    for(let depth = 0; depth < 3 && current; depth += 1){
        if (current instanceof Error) names.add(current.name);
        const code = errorCode(current);
        if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ABORT_ERR') return true;
        current = current instanceof Error ? current.cause : undefined;
    }
    return names.has('TimeoutError') || names.has('AbortError');
}
function diagnosticTarget(url) {
    return `${url.protocol}//${url.host}`;
}
function backendUrl(path) {
    const configured = process.env.FOCUS_FASTAPI_BASE_URL?.trim();
    const base = configured || (("TURBOPACK compile-time truthy", 1) ? `http://127.0.0.1:${process.env.FOCUS_BACKEND_PORT || '8000'}` : "TURBOPACK unreachable");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    let parsed;
    try {
        parsed = new URL(base);
    } catch  {
        throw new Error('FastAPI URL is invalid.');
    }
    if (![
        'http:',
        'https:'
    ].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('FastAPI URL is invalid.');
    }
    return new URL(`/api/v1${path}`, `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/`);
}
function isPostgresSession(token) {
    return Boolean(token?.startsWith('pg_'));
}
async function fastApiRequest(path, init = {}, sessionToken, correlationId = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])()) {
    let url;
    try {
        url = backendUrl(path);
    } catch (error) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.error(`[auth:${correlationId}] stage=next_bridge error_name=${errorName(error)} error_code=${errorCode(error)} failure=configuration`);
        }
        throw new FastApiConfigurationError(correlationId, error instanceof Error ? error.message : 'FastAPI URL is invalid');
    }
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    headers.set('origin', url.origin);
    headers.set('x-focus-correlation-id', correlationId);
    if (sessionToken) headers.set('cookie', `${COOKIE_NAME}=${sessionToken}`);
    if ("TURBOPACK compile-time truthy", 1) {
        console.info(`[auth:${correlationId}] FastAPI request ${init.method ?? 'GET'} ${diagnosticTarget(url)}${url.pathname}`);
    }
    const startedAt = Date.now();
    try {
        const response = await fetch(url, {
            ...init,
            headers,
            cache: 'no-store',
            signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
        if ("TURBOPACK compile-time truthy", 1) {
            console.info(`[auth:${correlationId}] FastAPI response HTTP ${response.status}`);
        }
        return response;
    } catch (error) {
        const code = isTimeout(error) ? 'timeout' : 'connection';
        const cause = error instanceof Error ? error.cause : undefined;
        const elapsedMs = Date.now() - startedAt;
        if ("TURBOPACK compile-time truthy", 1) {
            console.error(`[auth:${correlationId}] stage=next_bridge target=${url.host} error_name=${errorName(error)} error_code=${errorCode(error)} cause_code=${errorCode(cause)} failure=${code} elapsed_ms=${elapsedMs}`);
        }
        throw new FastApiConnectionError(code, correlationId, url.host, elapsedMs, errorName(error), errorCode(cause));
    }
}
async function fastApiRequestFromNextRequest(request, path, init = {}, correlationId = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["randomUUID"])()) {
    const originCheck = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$security$2f$origin$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["checkOrigin"])(request);
    if (!originCheck.allowed) {
        throw new FastApiOriginError(correlationId, originCheck.receivedOrigin, originCheck.requestOrigin, originCheck.expectedOrigin);
    }
    const token = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])()).get(COOKIE_NAME)?.value;
    return fastApiRequest(path, init, token, correlationId);
}
function copySetCookie(source, target) {
    const sourceHeaders = source.headers;
    const getSetCookie = sourceHeaders.getSetCookie;
    const values = typeof getSetCookie === 'function' ? getSetCookie.call(sourceHeaders) : [];
    if (values.length) {
        values.forEach((value)=>target.headers.append('set-cookie', value));
        return;
    }
    const value = source.headers.get('set-cookie');
    if (value) target.headers.set('set-cookie', value);
}
async function postgresSessionUser(token) {
    const response = await fastApiRequest('/users/me', {}, token);
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('PostgreSQL session unavailable.');
    return response.json();
}
}),
"[project]/src/lib/security/origin.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkOrigin",
    ()=>checkOrigin,
    "sameOrigin",
    ()=>sameOrigin
]);
function parseOrigin(value) {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (![
            'http:',
            'https:'
        ].includes(parsed.protocol) || parsed.username || parsed.password) return null;
        return parsed.origin;
    } catch  {
        return null;
    }
}
function localOriginAliases(origin) {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' || ![
            'localhost',
            '127.0.0.1'
        ].includes(parsed.hostname)) return [];
        const alias = parsed.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
        return [
            `http://${alias}${parsed.port ? `:${parsed.port}` : ''}`
        ];
    } catch  {
        return [];
    }
}
function configuredOrigins() {
    return [
        process.env.NEXT_PUBLIC_APP_URL,
        ...process.env.FOCUS_ALLOWED_ORIGINS?.split(',') ?? []
    ].flatMap((value)=>{
        const parsed = parseOrigin(value?.trim());
        return parsed ? [
            parsed
        ] : [];
    });
}
function checkOrigin(request) {
    const receivedOrigin = parseOrigin(request.headers.get('origin'));
    const requestOrigin = parseOrigin(request.url);
    const configured = configuredOrigins();
    const configuredOrigin = configured[0] ?? null;
    const allowed = new Set();
    if (requestOrigin) allowed.add(requestOrigin);
    configured.forEach((origin)=>allowed.add(origin));
    if ("TURBOPACK compile-time truthy", 1) {
        if (requestOrigin) localOriginAliases(requestOrigin).forEach((origin)=>allowed.add(origin));
        configured.forEach((origin)=>localOriginAliases(origin).forEach((alias)=>allowed.add(alias)));
    }
    return {
        allowed: receivedOrigin !== null && allowed.has(receivedOrigin),
        receivedOrigin,
        requestOrigin,
        expectedOrigin: configuredOrigin || requestOrigin
    };
}
function sameOrigin(request) {
    return checkOrigin(request).allowed;
}
}),
]})(),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1zopu0moyls_c._.js.map
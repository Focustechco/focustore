module.exports = [
(()=>{"use strict";return[
"[project]/src/app/api/auth/session/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/session.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/fastapi.ts [app-route] (ecmascript)");
;
;
;
;
;
async function GET() {
    try {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            user: await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthenticatedUser"])()
        });
    } catch (error) {
        console.error('Falha ao consultar sessão do cliente:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Não foi possível verificar sua sessão.'
        }, {
            status: 500
        });
    }
}
async function DELETE() {
    try {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        const sessionToken = cookieStore.get(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["AUTH_COOKIE_NAME"])?.value;
        if (sessionToken) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPostgresSession"])(sessionToken)) {
                const backend = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fastApiRequest"])('/auth/logout', {
                    method: 'POST'
                }, sessionToken);
                if (!backend.ok && backend.status !== 401) {
                    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        error: 'Não foi possível encerrar sua sessão.'
                    }, {
                        status: 503
                    });
                }
            } else {
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].session.deleteMany({
                    where: {
                        sessionToken
                    }
                });
            }
        }
        const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            user: null
        });
        response.cookies.set(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$session$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["AUTH_COOKIE_NAME"], '', {
            httpOnly: true,
            secure: ("TURBOPACK compile-time value", "development") === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });
        return response;
    } catch (error) {
        console.error('Falha ao encerrar sessão do cliente:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Não foi possível encerrar sua sessão.'
        }, {
            status: 500
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
"[project]/src/lib/auth/session.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AUTH_COOKIE_NAME",
    ()=>AUTH_COOKIE_NAME,
    "getAuthenticatedUser",
    ()=>getAuthenticatedUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth/fastapi.ts [app-route] (ecmascript)");
;
;
;
const AUTH_COOKIE_NAME = 'focus_session';
async function getAuthenticatedUser() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!sessionToken) return null;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isPostgresSession"])(sessionToken)) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2f$fastapi$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["postgresSessionUser"])(sessionToken);
    const session = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].session.findUnique({
        where: {
            sessionToken
        },
        select: {
            expires: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            }
        }
    });
    if (!session || session.expires <= new Date()) return null;
    return session.user;
}
}),
"[project]/src/lib/db/database-url.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "databaseUrl",
    ()=>databaseUrl,
    "verifiedDatabaseUrl",
    ()=>verifiedDatabaseUrl
]);
function databaseUrl(env) {
    const configured = env.DATABASE_URL;
    if (!configured) {
        throw new Error('Configure DATABASE_URL explicitamente com PostgreSQL persistente.');
    }
    let parsed;
    try {
        parsed = new URL(configured);
    } catch  {
        throw new Error('DATABASE_URL inválida. Use uma URL PostgreSQL postgresql:// ou postgres://.');
    }
    if (parsed.protocol === 'file:') {
        return configured;
    }
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
        throw new Error('DATABASE_URL deve usar PostgreSQL (postgresql:// ou postgres://) ou SQLite local (file:).');
    }
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
        throw new Error('DATABASE_URL PostgreSQL deve informar host e banco de dados.');
    }
    return configured;
}
const verifiedDatabaseUrl = databaseUrl;
}),
"[project]/src/lib/db/prisma.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$database$2d$url$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db/database-url.ts [app-route] (ecmascript)");
;
;
const globalForPrisma = globalThis;
function getPrismaClient() {
    if (globalForPrisma.prisma) {
        return globalForPrisma.prisma;
    }
    const client = new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
        datasources: {
            db: {
                url: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2f$database$2d$url$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["verifiedDatabaseUrl"])(process.env)
            }
        },
        log: ("TURBOPACK compile-time truthy", 1) ? [
            "error",
            "warn"
        ] : "TURBOPACK unreachable"
    });
    if ("TURBOPACK compile-time truthy", 1) {
        globalForPrisma.prisma = client;
    }
    return client;
}
const prisma = new Proxy({}, {
    get (_target, property) {
        const client = getPrismaClient();
        const value = Reflect.get(client, property, client);
        return typeof value === "function" ? value.bind(client) : value;
    }
});
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

//# sourceMappingURL=%5Broot-of-the-server%5D__05dk7exr4n894._.js.map
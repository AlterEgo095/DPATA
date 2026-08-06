// =============================================================================
// P3-D: Next.js 16 instrumentation hook — graceful shutdown + crash handlers.
// =============================================================================
//
// This file is auto-discovered by Next.js when present at the repo root (or at
// src/instrumentation.ts when using the src/ layout). It runs ONCE when the
// Next.js server boots, BEFORE any request is served. It is NOT imported from
// anywhere in the application code — Next.js loads it via the
// `instrumentationHook` mechanism.
//
// Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
//
// Responsibilities:
//   1. Log a startup banner so PM2 logs clearly show server boot.
//   2. Install SIGTERM + SIGINT handlers for graceful shutdown
//      (PM2 sends SIGINT during `pm2 reload`/`stop`).
//   3. Wait up to 7 seconds for in-flight requests to complete, then exit(0).
//      PM2's kill_timeout is set to 8000ms (see ecosystem config) — the 1s
//      buffer is reserved for log flushing + process teardown.
//   4. unhandledRejection → log + continue (request-level handlers catch most).
//   5. uncaughtException  → log + exit(1) so PM2 restarts cleanly.
// =============================================================================

const SHUTDOWN_TIMEOUT_MS = 7000;

let isShuttingDown = false;

/**
 * Graceful shutdown handler — invoked on SIGTERM or SIGINT.
 * Waits up to SHUTDOWN_TIMEOUT_MS (7s) for in-flight requests to settle,
 * then exits with code 0 so PM2 can restart the process cleanly.
 */
function gracefulShutdown(signal: 'SIGTERM' | 'SIGINT'): void {
  if (isShuttingDown) {
    // Second signal received during shutdown window — force immediate exit.
    console.log(`[PlagiatIA] Second ${signal} received — forcing exit.`);
    process.exit(1);
  }
  isShuttingDown = true;

  console.log(`[PlagiatIA] Graceful shutdown initiated (SIGTERM/SIGINT) — signal: ${signal}`);

  // Give in-flight requests up to SHUTDOWN_TIMEOUT_MS to complete.
  // (Next.js standalone server.js will close its HTTP server on SIGINT/SIGTERM
  // automatically; this timer is a safety net for the process.exit.)
  setTimeout(() => {
    console.log('[PlagiatIA] Shutdown complete');
    process.exit(0);
  }, SHUTDOWN_TIMEOUT_MS);
}

/**
 * Next.js 16 instrumentation hook — runs once at server boot, before any request.
 *
 * Next.js 16 loads instrumentation in BOTH the Node.js runtime AND the Edge
 * runtime. The `process.on()` API is NOT available in the Edge runtime —
 * calling it there throws: "A Node.js API is used (process.on) which is not
 * supported in the Edge Runtime." We guard with `process.env.NEXT_RUNTIME`
 * which Next.js sets to 'nodejs' or 'edge' depending on the active runtime.
 *
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#runtime
 *
 * Next.js 16 signature accepts an optional `options` argument with a
 * `reportError` callback; we omit it here because we install our own
 * unhandledRejection + uncaughtException handlers below.
 */
export async function register(): Promise<void> {
  // Edge runtime guard — process.on() is Node.js-only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  console.log('[PlagiatIA] Server starting — instrumentation loaded');

  // Graceful shutdown — PM2 sends SIGINT on `pm2 reload`/`stop`.
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // unhandledRejection: log + continue.
  // Most async errors should be caught by request-level try/catch; this is a
  // safety net for background tasks (batch manager, federation sync, etc.).
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[PlagiatIA] unhandledRejection:', reason);
    // Intentionally do NOT exit — the server keeps serving other requests.
  });

  // uncaughtException: log + exit(1) → PM2 will restart the process.
  // Synchronous errors that escape all try/catch blocks land here.
  process.on('uncaughtException', (err: Error) => {
    console.error('[PlagiatIA] uncaughtException:', err);
    process.exit(1);
  });
}

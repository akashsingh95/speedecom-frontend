/**
 * Extracts the friendliest message available from a failed listingStudioApi call.
 *
 * The shared axios instance's response interceptor (client/src/api.js) already shows this
 * same text via a toast automatically for every failed request. Several Listing Studio pages
 * additionally keep their own inline error banner fed by `e.message` — but for an axios error,
 * `.message` is axios's own generic text ("Request failed with status code 400"), never the
 * backend's actual reason. The real text lives in the response body, which server/listingStudio
 * routes now always reach via the app's central error middleware (server/middleware/
 * errorHandler.js) rather than leaking a raw technical error. Use this instead of reading
 * `e.message` directly so an inline banner matches what the toast already told the user.
 */
export function getErrorMessage(e) {
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || String(e);
}

import { useOutletContext } from 'react-router-dom';

/**
 * Shape provided by ProjectLayout's <Outlet context={ctx}/> to every campaign-scoped
 * page (research, strategy, aplus, listing, compare, readiness). Ported from
 * speed-listing's pages/project/context.ts — same useOutletContext-based approach, no
 * separate React.createContext needed since React Router's Outlet context already
 * threads this through the nested route tree.
 *
 * @typedef {object} ProjectCtx
 * @property {object} project
 * @property {object|null} job
 * @property {boolean} jobRunning
 * @property {() => Promise<void>} refresh
 * @property {() => void} watchJob - call after starting a background job so the layout begins polling.
 * @property {(check: (project: object) => (Error|any|undefined), opts?: {intervalMs?: number, maxAttempts?: number, timeoutMessage?: string}) => Promise<any>} pollUntil
 *   - polls this project (refreshing shared `project` state each tick) until `check(project)`
 *     returns something other than `undefined`; an Error return value is thrown, anything else
 *     resolves pollUntil's promise. For waiting on a narrower, non-job-tracked condition (e.g.
 *     one A+ module image slot's generating/error/path fields) than watchJob's job-level polling
 *     covers.
 */

/** @returns {ProjectCtx} */
export function useProjectCtx() {
  return useOutletContext();
}

import { useOutletContext } from 'react-router-dom';

/**
 * Shape provided by ProjectLayout's <Outlet context={ctx}/> to every campaign-scoped
 * page (research, strategy, aplus, listing, compare, readiness, export). Ported from
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
 */

/** @returns {ProjectCtx} */
export function useProjectCtx() {
  return useOutletContext();
}

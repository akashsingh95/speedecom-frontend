// Listing Studio's request layer, built on speedecom's shared axios instance (client/src/api.js)
// instead of speed-listing's own standalone fetch() wrapper (frontend/src/api.ts) — the shared
// instance already attaches the Bearer token via interceptor, so there is no separate
// token-relay/postMessage step here at all. Endpoint shapes mirror speed-listing's server.ts
// routes 1:1, mounted under /api/listing-studio/* on speedecom's own server.
import api from '../../api';

const BASE = '/listing-studio';

const moduleImageBaseUrl = (id, conceptId, moduleIdx, key) =>
  `${BASE}/projects/${id}/aplus/${conceptId}/modules/${moduleIdx}/images/${key}`;
const moduleImageGenerateUrl = (id, conceptId, moduleIdx, key) => `${moduleImageBaseUrl(id, conceptId, moduleIdx, key)}/generate`;

export const listingStudioApi = {
  getHealth: () => api.get(`${BASE}/health`).then((r) => r.data),
  listProjects: (tenantId, { page, limit, q } = {}) =>
    api.get(`${BASE}/projects`, { params: { tenantId, page, limit, q } }).then((r) => r.data),
  getProject: (id) => api.get(`${BASE}/projects/${id}`).then((r) => r.data),
  createProject: (form) => api.post(`${BASE}/projects`, form).then((r) => r.data),
  fillCampaignFromImage: (form) => api.post(`${BASE}/projects/fill-from-image`, form).then((r) => r.data),
  createFromAsin: (asin, marketplace, brandKitId, autoGen = {}) =>
    api.post(`${BASE}/projects/from-asin`, {
      asin, marketplace, brandKitId, autoAplus: Boolean(autoGen.aplus), autoPremiumAplus: Boolean(autoGen.premiumAplus),
    }).then((r) => r.data),
  uploadImages: (id, form) => api.post(`${BASE}/projects/${id}/images/upload`, form).then((r) => r.data),
  deleteProject: (id) => api.delete(`${BASE}/projects/${id}`).then((r) => r.data),
  renameProject: (id, name) => api.patch(`${BASE}/projects/${id}`, { name }).then((r) => r.data),

  // Public "view only" link to the Amazon Preview. `{ token }` — null when the project isn't shared.
  getShare: (id) => api.get(`${BASE}/projects/${id}/share`).then((r) => r.data),
  createShare: (id) => api.post(`${BASE}/projects/${id}/share`).then((r) => r.data),
  revokeShare: (id) => api.delete(`${BASE}/projects/${id}/share`).then((r) => r.data),

  // No research job yet is an expected, transient state while research is kicking off
  // (e.g. right after competitor selection) — callers already handle this silently, so
  // skip the global error toast rather than flashing a false-alarm error at the user.
  getJob: (id) => api.get(`${BASE}/projects/${id}/job`, { skipErrorToast: true }).then((r) => r.data),
  startResearch: (id) => api.post(`${BASE}/projects/${id}/research`).then((r) => r.data),
  submitCompetitorSelection: (id, asins) => api.post(`${BASE}/projects/${id}/research/select`, { asins }).then((r) => r.data),
  addResearchCandidates: (id, inputs) => api.post(`${BASE}/projects/${id}/research/candidates`, { inputs }).then((r) => r.data),
  reorderGeneratedImages: (id, imageIds) => api.patch(`${BASE}/projects/${id}/generated-images/order`, { imageIds }).then((r) => r.data),
  updateListing: (id, patch) => api.patch(`${BASE}/projects/${id}/listing`, patch).then((r) => r.data),
  removeGeneratedImage: (id, imageId) => api.delete(`${BASE}/projects/${id}/generated-images/${imageId}`).then((r) => r.data),
  // Queues the edit (202) — poll getImageEditStatus for the result.
  regenerateGeneratedImage: (id, imageId, form) => api.post(`${BASE}/projects/${id}/images/${imageId}/regenerate`, form).then((r) => r.data),
  // { status: 'running' | 'done' | 'error' | 'idle', image?, error? } for one image's queued edit.
  getImageEditStatus: (id, imageId) => api.get(`${BASE}/projects/${id}/images/${imageId}/edit-status`).then((r) => r.data),
  generateNewImage: (id, form) => api.post(`${BASE}/projects/${id}/images/generate`, form).then((r) => r.data),
  getImageEditSuggestions: (id, prompt) => api.post(`${BASE}/projects/${id}/image-edit-suggestions`, { prompt }).then((r) => r.data),

  getCatalog: () => api.get(`${BASE}/aplus/catalog`).then((r) => r.data),
  startStrategy: (id) => api.post(`${BASE}/projects/${id}/strategy`).then((r) => r.data),
  startImageLibrary: (id) => api.post(`${BASE}/projects/${id}/image-library`).then((r) => r.data),
  // `selectedAngleNames` is required — the server rejects an empty selection. (Automatic top-3
  // generation only happens at campaign creation, via the autoAplus/autoPremiumAplus flags.)
  startAplus: (id, selectedAngleNames) =>
    api.post(`${BASE}/projects/${id}/aplus`, selectedAngleNames ? { selectedAngleNames } : {}).then((r) => r.data),
  patchConcept: (id, conceptId, patch) => api.patch(`${BASE}/projects/${id}/aplus/${conceptId}`, patch).then((r) => r.data),
  getCompliance: (id, conceptId) => api.get(`${BASE}/projects/${id}/aplus/${conceptId}/compliance`).then((r) => r.data),
  generateModuleImage: (id, conceptId, moduleIdx, key, quality) =>
    api.post(moduleImageGenerateUrl(id, conceptId, moduleIdx, key), { quality }).then((r) => r.data),
  // Same endpoint as generateModuleImage, but for the A+ editor's "Edit" popup (GeneratedImageModal,
  // shared with the Images tab): the caller builds the FormData so an optional reference-photo
  // file and the editSlotImage flag can ride alongside quality in one request.
  generateModuleImageWithReferencePhoto: (id, conceptId, moduleIdx, key, form) =>
    api.post(moduleImageGenerateUrl(id, conceptId, moduleIdx, key), form).then((r) => r.data),
  // Poll target while a module image is generating — { generating, error } only, not the full
  // project or concept, so a 2s poll loop isn't re-fetching every signed image URL across the
  // whole project just to check one boolean (see AplusPage.jsx's waitForOverlaySlotDone).
  getModuleImageStatus: (id, conceptId, moduleIdx, key) =>
    api.get(`${moduleImageBaseUrl(id, conceptId, moduleIdx, key)}/status`).then((r) => r.data),

  startAlexaReadiness: (id) => api.post(`${BASE}/projects/${id}/alexa-readiness`).then((r) => r.data),

  // A file download, not JSON — fetched as a blob through the shared axios instance (so the
  // Bearer token interceptor actually applies) and then saved via a synthetic <a download>
  // click. A plain <a href="/api/...true URL"> would 401: browsers don't attach a custom
  // Authorization header to a normal link navigation, only to fetch/XHR requests — that's
  // what the interceptor hooks into.
  downloadImagesZip: (id) => downloadFile(`${BASE}/projects/${id}/export/images.zip`, `listing-${id}-images.zip`),
  // "Fill My Template": both steps take the seller's own template as multipart form data — the
  // server never stores it, so step 2 re-sends the same file. Errors are shown inline by the
  // modal (which fields are missing), not as a toast.
  inspectSellerTemplate: (id, form) =>
    api
      .post(`${BASE}/projects/${id}/amazon-listing/seller-template/inspect`, form, { skipErrorToast: true })
      .then((r) => r.data),
  downloadSellerTemplate: (id, form) =>
    postAndDownload(`${BASE}/projects/${id}/amazon-listing/seller-template.xlsm`, form, 'template-filled.xlsm', {
      skipErrorToast: true,
    }),
};

/** The actual "save this Blob to disk as `filename`" trick — a synthetic same-origin blob: URL
 *  anchor, since the `download` attribute is only honored by browsers for a same-origin href;
 *  a direct link to a cross-origin signed S3 URL would just navigate/open it instead of saving
 *  it under our chosen filename. */
function triggerBlobDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

function saveBlob(blob, disposition, fallbackFilename) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  triggerBlobDownload(blob, match ? match[1] : fallbackFilename);
}

// Exported for premiumAplusApi.js's downloadDesignZip — same blob-download convention as
// downloadImagesZip above, just for a different resource with its own small request-layer file.
export async function downloadFile(path, fallbackFilename) {
  const res = await api.get(path, { responseType: 'blob' });
  saveBlob(res.data, res.headers?.['content-disposition'], fallbackFilename);
}

/** Downloads an already-public URL (e.g. a signed S3 display URL for one image, not one of our
 *  own API routes) under a chosen filename — no auth header needed since it's pre-signed, but
 *  still needs the same blob-URL trick as saveBlob above to force a save under `filename` rather
 *  than a same-tab navigation to a cross-origin link. Used by PremiumAplusPage's per-slot
 *  downloads, where each of the 6 generated images already has its own signed URL and just
 *  needs Amazon's expected slot filename, not a fresh API round-trip. */
export async function downloadFromUrl(url, filename) {
  const res = await fetch(url);
  triggerBlobDownload(await res.blob(), filename);
}

async function postAndDownload(path, body, fallbackFilename, config = {}) {
  try {
    const res = await api.post(path, body, { ...config, responseType: 'blob' });
    saveBlob(res.data, res.headers?.['content-disposition'], fallbackFilename);
  } catch (e) {
    // With responseType 'blob' an error body arrives as a Blob too — parse it back into the
    // server's JSON so callers (and getErrorMessage) see the real reason, not axios's generic one.
    const data = e?.response?.data;
    if (data instanceof Blob) {
      try {
        e.response.data = JSON.parse(await data.text());
      } catch {
        // Not JSON (e.g. a proxy error page) — leave it as-is.
      }
    }
    throw e;
  }
}

export function byteLen(s) {
  return new TextEncoder().encode(s).length;
}

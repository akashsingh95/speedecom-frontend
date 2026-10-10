// Listing Studio's request layer, built on speedecom's shared axios instance (client/src/api.js)
// instead of speed-listing's own standalone fetch() wrapper (frontend/src/api.ts) — the shared
// instance already attaches the Bearer token via interceptor, so there is no separate
// token-relay/postMessage step here at all. Endpoint shapes mirror speed-listing's server.ts
// routes 1:1, mounted under /api/listing-studio/* on speedecom's own server.
import api from '../../api';

const BASE = '/listing-studio';

const moduleImageGenerateUrl = (id, conceptId, moduleIdx, key) =>
  `${BASE}/projects/${id}/aplus/${conceptId}/modules/${moduleIdx}/images/${key}/generate`;

export const listingStudioApi = {
  getHealth: () => api.get(`${BASE}/health`).then((r) => r.data),
  listProjects: (tenantId, { page, limit, q } = {}) =>
    api.get(`${BASE}/projects`, { params: { tenantId, page, limit, q } }).then((r) => r.data),
  getProject: (id) => api.get(`${BASE}/projects/${id}`).then((r) => r.data),
  createProject: (form) => api.post(`${BASE}/projects`, form).then((r) => r.data),
  fillCampaignFromImage: (form) => api.post(`${BASE}/projects/fill-from-image`, form).then((r) => r.data),
  fillAmazonListingFields: (id, imageIds, fields) =>
    api.post(`${BASE}/projects/${id}/amazon-listing/fill-fields`, { imageIds, fields }).then((r) => r.data),
  saveAmazonListingDraft: (id, draft) =>
    api.patch(`${BASE}/projects/${id}/amazon-listing/draft`, draft).then((r) => r.data),
  createFromAsin: (asin, marketplace, manualCompetitorSelection = false, imageModel) =>
    api.post(`${BASE}/projects/from-asin`, { asin, marketplace, manualCompetitorSelection, imageModel }).then((r) => r.data),
  uploadImages: (id, form) => api.post(`${BASE}/projects/${id}/images/upload`, form).then((r) => r.data),
  deleteProject: (id) => api.delete(`${BASE}/projects/${id}`).then((r) => r.data),
  renameProject: (id, name) => api.patch(`${BASE}/projects/${id}`, { name }).then((r) => r.data),

  getCampaignQuotaRequest: () => api.get(`${BASE}/campaign-quota-request`).then((r) => r.data),
  requestMoreCampaigns: (requestedCount) =>
    api.post(`${BASE}/campaign-quota-request`, { requestedCount }).then((r) => r.data),

  listCampaignQuotaRequests: () => api.get(`${BASE}/campaign-quota-requests`).then((r) => r.data),
  approveCampaignQuotaRequest: (id) => api.post(`${BASE}/campaign-quota-requests/${id}/approve`).then((r) => r.data),
  rejectCampaignQuotaRequest: (id) => api.post(`${BASE}/campaign-quota-requests/${id}/reject`).then((r) => r.data),

  getJob: (id) => api.get(`${BASE}/projects/${id}/job`).then((r) => r.data),
  startResearch: (id) => api.post(`${BASE}/projects/${id}/research`).then((r) => r.data),
  submitCompetitorSelection: (id, asins) => api.post(`${BASE}/projects/${id}/research/select`, { asins }).then((r) => r.data),
  addResearchCandidates: (id, inputs) => api.post(`${BASE}/projects/${id}/research/candidates`, { inputs }).then((r) => r.data),
  generateListingFromConcept: (id, conceptId) => api.post(`${BASE}/projects/${id}/listing/from-concept/${conceptId}`).then((r) => r.data),
  updateListing: (id, patch) => api.patch(`${BASE}/projects/${id}/listing`, patch).then((r) => r.data),
  removeGeneratedImage: (id, imageId) => api.delete(`${BASE}/projects/${id}/generated-images/${imageId}`).then((r) => r.data),
  regenerateGeneratedImage: (id, imageId, form) => api.post(`${BASE}/projects/${id}/images/${imageId}/regenerate`, form).then((r) => r.data),
  getImageEditSuggestions: (id, prompt) => api.post(`${BASE}/projects/${id}/image-edit-suggestions`, { prompt }).then((r) => r.data),
  mergeEditPrompt: (id, prompt, editRequest) => api.post(`${BASE}/projects/${id}/merge-edit-prompt`, { prompt, editRequest }).then((r) => r.data),

  getCatalog: () => api.get(`${BASE}/aplus/catalog`).then((r) => r.data),
  startStrategy: (id) => api.post(`${BASE}/projects/${id}/strategy`).then((r) => r.data),
  startImageLibrary: (id) => api.post(`${BASE}/projects/${id}/image-library`).then((r) => r.data),
  startAplus: (id) => api.post(`${BASE}/projects/${id}/aplus`).then((r) => r.data),
  patchConcept: (id, conceptId, patch) => api.patch(`${BASE}/projects/${id}/aplus/${conceptId}`, patch).then((r) => r.data),
  getCompliance: (id, conceptId) => api.get(`${BASE}/projects/${id}/aplus/${conceptId}/compliance`).then((r) => r.data),
  generateModuleImage: (id, conceptId, moduleIdx, key, quality, variants = 2, imageModel) =>
    api.post(moduleImageGenerateUrl(id, conceptId, moduleIdx, key), { quality, variants, imageModel }).then((r) => r.data),
  // Same endpoint as generateModuleImage, but for the A+ editor's "Edit" popup (GeneratedImageModal,
  // shared with the Images tab): the caller builds the FormData so an optional reference-photo
  // file and the editSlotImage flag can ride alongside quality/variants/imageModel in one request.
  generateModuleImageWithReferencePhoto: (id, conceptId, moduleIdx, key, form) =>
    api.post(moduleImageGenerateUrl(id, conceptId, moduleIdx, key), form).then((r) => r.data),

  startAlexaReadiness: (id) => api.post(`${BASE}/projects/${id}/alexa-readiness`).then((r) => r.data),

  // These three are file downloads, not JSON — fetched as a blob through the shared axios
  // instance (so the Bearer token interceptor actually applies) and then saved via a
  // synthetic <a download> click. A plain <a href="/api/...true URL"> would 401: browsers
  // don't attach a custom Authorization header to a normal link navigation, only to
  // fetch/XHR requests — that's what the interceptor hooks into.
  downloadImagesZip: (id) => downloadFile(`${BASE}/projects/${id}/export/images.zip`, `listing-${id}-images.zip`),
  downloadListingXlsx: (id) => downloadFile(`${BASE}/projects/${id}/export/listing.xlsx`, `listing-${id}.xlsx`),
  downloadAplusJson: (id, conceptId) => downloadFile(`${BASE}/projects/${id}/export/aplus/${conceptId}.json`, `aplus-${conceptId}.json`),
  // The wizard's Draft step: unlike the three above, this carries the draft (category/title/SKU/
  // fields/images) as a POST body — it only ever lives in the wizard's own client state, never
  // the project record — so it can't be a plain GET.
  downloadAmazonListingDraft: (id, draft) => postAndDownload(`${BASE}/projects/${id}/amazon-listing/draft.xlsx`, draft, `${id}-draft.xlsx`),
};

function saveBlob(blob, disposition, fallbackFilename) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  const filename = match ? match[1] : fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

async function downloadFile(path, fallbackFilename) {
  const res = await api.get(path, { responseType: 'blob' });
  saveBlob(res.data, res.headers?.['content-disposition'], fallbackFilename);
}

async function postAndDownload(path, body, fallbackFilename) {
  const res = await api.post(path, body, { responseType: 'blob' });
  saveBlob(res.data, res.headers?.['content-disposition'], fallbackFilename);
}

export function byteLen(s) {
  return new TextEncoder().encode(s).length;
}

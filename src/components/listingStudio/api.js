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
  // The tenant's actual next-charge rate, read live from their oldest eligible credit lot — used
  // to show a pre-action "this will cost N credits" pill before an edit/generate click, never an
  // approximation from the general pricing catalog (server: creditLedgerService.getNextChargeRates).
  getCreditRates: () => api.get(`${BASE}/wallet/rates`).then((r) => r.data),
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
  // shared with the Images tab): the caller builds the body so an optional reference photo's
  // already-uploaded `referencePhotoKey` and the editSlotImage flag can ride alongside quality
  // in one request.
  generateModuleImageWithReferencePhoto: (id, conceptId, moduleIdx, key, body) =>
    api.post(moduleImageGenerateUrl(id, conceptId, moduleIdx, key), body).then((r) => r.data),
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
  downloadAplusImagesZip: (id) => downloadFile(`${BASE}/projects/${id}/export/aplus-images.zip`, `listing-${id}-aplus-content.zip`),
  // "Fill My Template": the seller's own template goes direct-to-bucket (uploadTemplateViaSignedUrl),
  // fresh for both steps — the server deletes it the moment each step is done with it, so nothing
  // is ever kept. Errors are shown inline by the modal (which fields are missing), not as a toast.
  inspectSellerTemplate: (id, templateKey) =>
    api
      .post(`${BASE}/projects/${id}/amazon-listing/seller-template/inspect`, { templateKey }, { skipErrorToast: true })
      .then((r) => r.data),
  downloadSellerTemplate: (id, body) =>
    postAndDownload(`${BASE}/projects/${id}/amazon-listing/seller-template.xlsm`, body, 'template-filled.xlsm', {
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

/** Uploads a File straight to the bucket via a signed PUT URL — no auth header needed (the URL
 *  itself is pre-signed) and no shared axios instance involved, since this goes directly to
 *  storage, never through our API. `contentType` must match whatever the server actually signed
 *  the URL with (the signature itself binds to it) — pass it explicitly rather than trusting
 *  `file.type` when the server minted the URL from something other than the browser's own
 *  content-type guess (see uploadTemplateViaSignedUrl below, for the browser's unreliable .xlsm
 *  mimetype reporting). */
async function putToSignedUrl(file, url, contentType) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType ?? file.type }, body: file });
  if (!res.ok) throw new Error(`Image upload failed: ${res.status}`);
}

/** The two-step dance every image upload in Listing Studio goes through: ask this server for a
 *  signed URL per file (POST /uploads/signed-url), PUT each file straight to the bucket, then
 *  hand back the resulting storage key(s) — never the file bytes — for the caller to send on to
 *  whichever endpoint actually needs them (createProject's `keys`, a modal's
 *  `referencePhotoKey`, a Brandkit's `logoKey`, …). Shared by every one of those call sites so
 *  the dance is written once, not duplicated per component.
 *
 *  `transient: true` is required for every call whose key gets deleted after one use (a
 *  reference photo) — it mints the key under the server's separate transient sub-path
 *  (store.js#createUploadSlot) so that flow's delete-after-use can only ever touch a key
 *  actually meant to be one-shot, never a lasting asset (a project image, a Brandkit logo) that
 *  happened to be passed in by mistake or by a crafted request. Leave it false/omitted for a
 *  lasting asset — createProject's `keys`, addImages, a Brandkit's `logoKey`.
 *
 *  Uses allSettled rather than all for the PUT step: if one file in the batch fails (a network
 *  blip, say) after others already succeeded, those already-uploaded objects are real bucket
 *  writes we were handed a key for and would otherwise never reference again — best-effort
 *  clean them up via /uploads/cleanup instead of leaking them, then throw so the caller sees
 *  the batch as failed (none of its keys are usable — the failed slot has none). */
export async function uploadImagesViaSignedUrl(files, { transient = false } = {}) {
  const fileList = Array.from(files);
  if (fileList.length === 0) return [];
  // `name` rides along only as a fallback the server uses when `contentType` (file.type) comes
  // back blank/generic for a real image (see store.js#createUploadSlot) — the response's own
  // `contentType` below is what actually gets PUT, never file.type directly, since the server
  // may have overridden it via that fallback.
  const { uploads } = await api
    .post(`${BASE}/uploads/signed-url`, { files: fileList.map((f) => ({ contentType: f.type, size: f.size, name: f.name })), transient })
    .then((r) => r.data);
  const results = await Promise.allSettled(fileList.map((f, i) => putToSignedUrl(f, uploads[i].url, uploads[i].contentType)));
  const failed = results.some((r) => r.status === 'rejected');
  if (!failed) return uploads.map((u) => u.key);

  const uploadedKeys = uploads.filter((_, i) => results[i].status === 'fulfilled').map((u) => u.key);
  if (uploadedKeys.length > 0) {
    // Awaited (not fire-and-forget) so this cleanup request actually gets a chance to reach the
    // server before this function throws and the caller's catch block runs — possibly
    // navigating away or unmounting the component that triggered this call. Still best-effort:
    // a failure here just means an orphaned object, same as uploadsService.js's own cleanupUploads.
    await api.post(`${BASE}/uploads/cleanup`, { keys: uploadedKeys }, { skipErrorToast: true }).catch(() => undefined);
  }
  throw results.find((r) => r.status === 'rejected').reason;
}

/** Same direct-to-bucket dance as uploadImagesViaSignedUrl, for the seller's Amazon template
 *  file (FillSellerTemplateModal) instead of a product photo — its own endpoint rather than
 *  /uploads/signed-url because the server has to mint the key from the filename, not the
 *  browser's (for .xlsm, unreliable) content-type. Called fresh for every "Inspect" and every
 *  "Download filled template" click, not once per file pick: the server deletes the key the
 *  moment that one call is done with it (see exportService.js's fetchTemplateBytes/finally), so
 *  nothing is ever left in the bucket longer than a single request needs it. The modal keeps
 *  the original File in memory across clicks, so re-uploading it per click is cheap, and it
 *  never goes through this server either way. */
export async function uploadTemplateViaSignedUrl(projectId, file) {
  const { key, url, contentType } = await api
    .post(`${BASE}/projects/${projectId}/amazon-listing/seller-template/signed-url`, { filename: file.name, size: file.size })
    .then((r) => r.data);
  await putToSignedUrl(file, url, contentType);
  return key;
}

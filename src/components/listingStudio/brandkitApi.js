// Thin request layer for the Brandkit feature, mirroring listingStudioApi's shape (api.js) —
// same shared axios instance, same `.then(r => r.data)` pattern. Kept as a separate object
// (rather than folded into listingStudioApi) since Brandkit is its own small CRUD resource,
// not a sub-resource of a project — matching how the backend mounts it as its own
// `brandkit.routes.js`. A logo, if any, is uploaded separately via uploadImagesViaSignedUrl
// (api.js) — create/update just take the resulting `logoKey` as a plain JSON field.
import api from '../../api';

const BASE = '/listing-studio/brandkits';

export const brandkitApi = {
  // No pagination params here on purpose — useBrandkits() always fetches the full tenant-scoped
  // list (expected low counts), unlike listProjects's paginated siblings.
  listBrandkits: () => api.get(BASE).then((r) => r.data),
  getBrandkit: (id) => api.get(`${BASE}/${id}`).then((r) => r.data),
  createBrandkit: (body) => api.post(BASE, body).then((r) => r.data),
  updateBrandkit: (id, body) => api.patch(`${BASE}/${id}`, body).then((r) => r.data),
  deleteBrandkit: (id) => api.delete(`${BASE}/${id}`).then((r) => r.data),
  // Not a /brandkits endpoint itself — PATCHes the Project's brandKitId link — but every caller
  // reaches it through a Brandkit-picking control (BrandkitSelect / ProjectLayout's TopNav), so
  // it lives here rather than in listingStudioApi. `brandKitId: null` explicitly clears it.
  setProjectBrandKit: (projectId, brandKitId) =>
    api.patch(`/listing-studio/projects/${projectId}/brandkit`, { brandKitId }).then((r) => r.data),
};

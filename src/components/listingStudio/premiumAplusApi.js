import api from '../../api';
import { downloadFile } from './api';

const BASE = '/listing-studio';

export const premiumAplusApi = {
  startPremiumAplus: (id, selectedAngleNames) =>
    api.post(`${BASE}/projects/${id}/premium-aplus`, { selectedAngleNames }).then((r) => r.data),
  listDesigns: (id) => api.get(`${BASE}/projects/${id}/premium-aplus`).then((r) => r.data),
  getDesign: (id, designId) => api.get(`${BASE}/projects/${id}/premium-aplus/${designId}`).then((r) => r.data),
  downloadDesignZip: (id, designId) =>
    downloadFile(`${BASE}/projects/${id}/premium-aplus/${designId}/export.zip`, `${id}-premium-aplus-${designId}.zip`),
  downloadMobileZip: (id, designId) =>
    downloadFile(
      `${BASE}/projects/${id}/premium-aplus/${designId}/export-mobile.zip`,
      `${id}-premium-aplus-${designId}-mobile.zip`,
    ),
  downloadCombinedZip: (id, designId) =>
    downloadFile(
      `${BASE}/projects/${id}/premium-aplus/${designId}/export-both.zip`,
      `${id}-premium-aplus-${designId}-all.zip`,
    ),
  regenerateSide: (id, designId, side) =>
    api.post(`${BASE}/projects/${id}/premium-aplus/${designId}/${side}/regenerate`).then((r) => r.data),
};

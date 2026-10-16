// Products a support ticket can be about; keep in sync with SUPPORT_PRODUCTS in the backend model.
export const PRODUCT_LABELS = {
  reconciliation: 'Reconciliation',
  speedy_listing: 'Speedy Listing',
};

export const PRODUCT_BADGE_CLASSES = {
  reconciliation: 'bg-sky-50 text-sky-700 border-sky-200',
  speedy_listing: 'bg-violet-50 text-violet-700 border-violet-200',
};

export const productLabel = (product) => PRODUCT_LABELS[product] || PRODUCT_LABELS.reconciliation;

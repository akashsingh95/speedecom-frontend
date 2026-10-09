import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Modal } from './ui/Modal';
import { BTN, BTN_PRIMARY, BADGE, BADGE_BAD, CARD_TITLE, MUTED, SMALL } from './ui/classNames';
import { listingStudioApi, uploadTemplateViaSignedUrl } from './api';
import { getErrorMessage } from './errors';

const MAX_IMAGES = 9;
const MAX_SKU_LENGTH = 40;
const PRODUCT_ID_TYPE_PATH = 'amzn1.volt.ca.product_id_type';
const PRODUCT_ID_VALUE_PATH = 'amzn1.volt.ca.product_id_value';
// Signed image URLs written into the file are valid for 7 days (storageClient's read URLs) —
// after that Amazon can no longer fetch them.
const IMAGE_LINK_DAYS = 7;

const INPUT_CLASS =
  'block w-full mt-1 px-2.5 py-2 bg-white border rounded-lg text-sm text-slate-900 focus:outline focus:outline-2 focus:outline-brand-100';

/** AI "primary" shots first (the Main image), then secondaries, by position; the seller's raw
 *  uploads only when nothing was generated. */
function defaultTemplateImages(project) {
  const generated = [...(project?.generatedImages ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const ordered = [...generated.filter((img) => img.role === 'primary'), ...generated.filter((img) => img.role !== 'primary')];
  const paths = ordered.length ? ordered.map((img) => img.path) : project?.images ?? [];
  return paths.filter(Boolean).slice(0, MAX_IMAGES);
}

/** A field's dropdown options for one Product Type — mirrors the server's fieldOptions. */
function fieldOptions(field, productType) {
  return field.validValuesByProductType?.[productType] || field.validValues || null;
}

function formatExpiry(from, days) {
  const d = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "Fill My Template" — the seller uploads the Amazon flat file they downloaded from Seller
 * Central (any category), and gets it back with this campaign's title, description, bullets,
 * keywords and images in its product row. Two steps against a stateless server: inspect the
 * file (what we fill, what Amazon still needs), then re-send it with the seller's answers.
 * Both steps upload the file fresh, direct to the bucket (uploadTemplateViaSignedUrl) — the
 * server deletes it the moment each step is done reading it, so nothing is ever kept.
 */
export function FillSellerTemplateModal({ project, onClose }) {
  const [file, setFile] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [mode, setMode] = useState('new');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [sku, setSku] = useState('');
  const [productType, setProductType] = useState('');
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [missing, setMissing] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadedAt, setDownloadedAt] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const inspectRequestRef = useRef(0);

  const images = useMemo(() => defaultTemplateImages(project), [project]);
  const listing = project?.listing;
  const hasListingCopy = Boolean(listing?.title);

  const onFileDropped = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped && !/\.xlsm$|\.xlsx$/i.test(dropped.name)) {
      setError('Please drop an .xlsm or .xlsx file — that\'s the format Seller Central exports.');
      return;
    }
    onPickFile(dropped);
  };

  const onPickFile = async (picked) => {
    // Block a new pick while one is already in flight — an inspect or download in progress is
    // for the currently loaded file, and swapping it out mid-request is what lets a stale
    // response land after a newer one and overwrite its state.
    if (!picked || inspecting || downloading) return;
    // A later drop/pick must win even if its inspect response arrives before an earlier one's —
    // only the response matching the most recent request is allowed to write state.
    const requestId = ++inspectRequestRef.current;
    setFile(picked);
    setInspection(null);
    setError('');
    setMissing([]);
    setDownloadedAt(null);
    setInspecting(true);
    try {
      const templateKey = await uploadTemplateViaSignedUrl(project.id, picked);
      const result = await listingStudioApi.inspectSellerTemplate(project.id, templateKey);
      if (inspectRequestRef.current !== requestId) return;
      setInspection(result);
      setMode(result.defaultMode);
      setConfirmReplace(false);
      setSku(result.currentSku || '');
      setProductType(result.currentProductType || (result.productTypes.length === 1 ? result.productTypes[0] : ''));
      setValues(Object.fromEntries(result.sellerFields.map((f) => [f.attributePath, f.currentValue || ''])));
    } catch (e) {
      if (inspectRequestRef.current !== requestId) return;
      setError(getErrorMessage(e));
    } finally {
      if (inspectRequestRef.current === requestId) setInspecting(false);
    }
  };

  // An ASIN campaign is a product already live on Amazon — switching it to a full replace
  // deletes every attribute not in the file, so it needs an explicit acknowledgement.
  const replacingLiveListing = inspection?.defaultMode === 'update' && mode === 'new';
  const isNew = mode === 'new';
  const productIdType = values[PRODUCT_ID_TYPE_PATH] || '';

  const visibleFields = (inspection?.sellerFields ?? []).filter(
    (f) => f.attributePath !== PRODUCT_ID_VALUE_PATH || (productIdType && productIdType !== 'GTIN Exempt'),
  );
  const isFieldMissing = (f) =>
    isNew && (f.required === 'Required' || f.attributePath === PRODUCT_ID_VALUE_PATH) && !values[f.attributePath]?.trim();
  const blockers = [
    !sku.trim() && 'SKU',
    isNew && !productType && 'Product Type',
    ...visibleFields.filter(isFieldMissing).map((f) => f.label),
  ].filter(Boolean);
  const canDownload =
    inspection && hasListingCopy && blockers.length === 0 && (!replacingLiveListing || confirmReplace) && !downloading;

  const download = async () => {
    setError('');
    setMissing([]);
    setDownloading(true);
    try {
      const templateKey = await uploadTemplateViaSignedUrl(project.id, file);
      const extraFields = Object.fromEntries(
        visibleFields.map((f) => [f.attributePath, values[f.attributePath]?.trim() || '']).filter(([, v]) => v),
      );
      await listingStudioApi.downloadSellerTemplate(project.id, {
        templateKey,
        filename: file.name,
        sku: sku.trim(),
        mode,
        ...(isNew ? { productType } : {}),
        images,
        extraFields,
      });
      setDownloadedAt(new Date());
    } catch (e) {
      setError(getErrorMessage(e));
      setMissing(e?.response?.data?.missing ?? []);
    } finally {
      setDownloading(false);
    }
  };

  const autoFilled = [
    'SKU',
    `Listing Action (${isNew ? 'Create or Replace' : 'Edit — Partial Update'})`,
    ...(isNew ? ['Product Type'] : []),
    ...(isNew && inspection?.brand ? [`Brand (${inspection.brand})`] : []),
    'Title',
    'Description',
    `${Math.min(listing?.bullets?.length ?? 0, 5)} bullet points`,
    'Search keywords',
    `${images.length} image${images.length === 1 ? '' : 's'}`,
  ];

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet size={20} className="text-emerald-600" />
        <h2 className={CARD_TITLE}>Fill My Amazon Template</h2>
      </div>
      <p className={`${MUTED} ${SMALL} mb-4`}>
        Upload the inventory template you downloaded from Seller Central. We&apos;ll write this campaign&apos;s listing into
        it and give it back, ready to upload under Catalog → Add Products via Upload.
      </p>

      {!hasListingCopy && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          Generate the listing copy for this campaign first — there is no title yet to put in the template.
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${
          dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onFileDropped}
      >
        {inspecting ? <Loader2 size={20} className="animate-spin text-brand-600" /> : <Upload size={20} className="text-brand-600" />}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{file ? file.name : 'Choose your template (.xlsm) or drag it in'}</div>
          <div className={`${MUTED} ${SMALL}`}>{file ? 'Click to choose a different file' : 'Your file is not stored — it is only read to fill it in'}</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsm,.xlsx"
          hidden
          onChange={(e) => {
            onPickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {inspection && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-2">Is this product already live on Amazon?</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { value: 'new', title: 'New listing', hint: 'Create or Replace' },
                { value: 'update', title: 'Update live listing', hint: 'Partial Update' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setMode(opt.value);
                    setConfirmReplace(false);
                  }}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    mode === opt.value ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{opt.title}</div>
                  <div className={`${MUTED} text-[11px]`}>{opt.hint}</div>
                </button>
              ))}
            </div>
            <p className={`${MUTED} ${SMALL} mb-2`}>
              {isNew
                ? 'The row becomes the whole listing — Amazon needs every required field below.'
                : 'Only the cells we fill change on Amazon; everything else on the live listing stays as it is.'}
            </p>
            {replacingLiveListing && (
              <label className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <input type="checkbox" className="mt-1" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
                <span>
                  This campaign was created from an ASIN that is already live. <b>Create or Replace</b> replaces that whole listing
                  — any attribute not in this file is deleted from Amazon. I understand.
                </span>
              </label>
            )}

            <label className="block mb-3 text-sm text-slate-500">
              SKU <span className="text-red-600">*</span>
              <input
                className={`${INPUT_CLASS} ${!sku.trim() ? 'border-red-300' : 'border-slate-200'}`}
                value={sku}
                maxLength={MAX_SKU_LENGTH}
                placeholder="e.g. JDF-CHAKRA-TREE-300"
                onChange={(e) => setSku(e.target.value)}
              />
            </label>

            {isNew && (
              <label className="block mb-3 text-sm text-slate-500">
                Product Type <span className="text-red-600">*</span>
                <select
                  className={`${INPUT_CLASS} ${!productType ? 'border-red-300' : 'border-slate-200'}`}
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  disabled={inspection.productTypes.length === 1}
                >
                  {inspection.productTypes.length !== 1 && <option value="">Choose…</option>}
                  {inspection.productTypes.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 mb-1.5">
                <CheckCircle2 size={15} /> We fill these for you
              </div>
              <div className="flex flex-wrap gap-1">
                {autoFilled.map((item) => (
                  <span key={item} className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900 mb-1">Amazon also needs</div>
            <p className={`${MUTED} ${SMALL} mb-2`}>
              {isNew
                ? 'Required for a new listing. We can’t fill these — they’re your legal and product-identity details.'
                : 'Optional for an update — fill any you want to change on the live listing.'}
            </p>
            {visibleFields.length === 0 && <p className={`${MUTED} ${SMALL}`}>Nothing else — this template is fully covered.</p>}
            {visibleFields.map((field) => {
              const options = fieldOptions(field, productType || inspection.currentProductType);
              const value = values[field.attributePath] ?? '';
              const flagged = isFieldMissing(field) || missing.includes(field.attributePath);
              const setValue = (v) => setValues((prev) => ({ ...prev, [field.attributePath]: v }));
              return (
                <label key={field.attributePath} className="block mb-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    {field.label}
                    {isNew && (field.required === 'Required' || field.attributePath === PRODUCT_ID_VALUE_PATH) ? (
                      <span className={BADGE_BAD}>Required</span>
                    ) : (
                      <span className={BADGE}>Optional</span>
                    )}
                    {field.currentValue && <span className={`${MUTED} text-[11px]`}>from your file</span>}
                  </span>
                  {options ? (
                    <select
                      className={`${INPUT_CLASS} ${flagged ? 'border-red-300' : 'border-slate-200'}`}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    >
                      <option value="">Choose…</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={`${INPUT_CLASS} ${flagged ? 'border-red-300' : 'border-slate-200'}`}
                      value={value}
                      maxLength={2000}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {inspection && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Image links in this file work for <b>{IMAGE_LINK_DAYS} days</b>
            {downloadedAt ? ` (until ${formatExpiry(downloadedAt, IMAGE_LINK_DAYS)})` : ''}. Upload it to Seller Central before then — or
            download it again for fresh links.
          </span>
        </div>
      )}

      {downloadedAt && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          Downloaded. Upload it in Seller Central → Catalog → Add Products via Upload, then check the Processing Report.
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {inspection && blockers.length > 0 && <span className={`${MUTED} ${SMALL} mr-auto`}>Still needed: {blockers.join(', ')}</span>}
        <button type="button" className={BTN} onClick={onClose}>
          Close
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={!canDownload} onClick={download}>
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Download filled template
        </button>
      </div>
    </Modal>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Check, ChevronDown, Link2, PenLine, Sparkles, SlidersHorizontal, Package, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api';
import { listingStudioApi } from '../../components/listingStudio/api';
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL, MAX_UPLOAD_FILES } from '../../components/listingStudio/constants';
import { validateUploadFiles } from '../../components/listingStudio/helpers';
import { FormField } from '../../components/listingStudio/ui/FormField';
import { Button } from '../../components/listingStudio/ui/Button';
import {
  ERROR_TEXT, ISSUE_WARN, NOTICE_WARN, GRID2, THUMBS, THUMB, CHECK_ROW, CHECK_BOX, CHECK_BOX_CHECKED, FIELD_INPUT,
} from '../../components/listingStudio/ui/classNames';

// This page's CTA is a full-width, larger-than-usual button (its own hero-card layout, see the
// component doc comment below) so it can't just use BTN_PRIMARY directly — but it should still
// carry the same gradient/shadow treatment as every other primary action in the app, not the
// flat bg-brand-600 this used to be.
const PRIMARY_CTA =
  'w-full mt-5 py-3.5 rounded-xl border border-transparent bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold shadow-[0_2px_10px_-2px_rgba(2,132,199,0.45)] transition-all hover:shadow-[0_6px_18px_-2px_rgba(2,132,199,0.5)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2';

const EMPTY_MANUAL_FORM = {
  name: '', brand: '', category: '', price: '', dimensions: '', materials: '',
  description: '', features: '', targetAudience: '', differentiators: '',
};

// Every manual-form field "Fill from image" can populate — kept as one list so the
// analyzeImages/aiFilledFields bookkeeping and the label-badge lookups can't drift apart.
const AI_FILLABLE_FIELDS = ['name', 'brand', 'category', 'description', 'features', 'dimensions', 'materials', 'targetAudience', 'differentiators'];

/** Small "AI-filled" pill appended to a field's label — cleared the moment the user edits that
 *  field (see clearAiFilled), so it only ever marks what's still literally the model's answer. */
function AiFilledBadge() {
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-1.5 py-0.5 align-middle">
      <Sparkles size={9} /> AI-filled — review
    </span>
  );
}

const MARKETPLACES = [
  { value: 'www.amazon.in', flag: '🇮🇳', label: 'IN' },
  { value: 'www.amazon.com', flag: '🇺🇸', label: 'US' },
  { value: 'www.amazon.co.uk', flag: '🇬🇧', label: 'UK' },
  { value: 'www.amazon.de', flag: '🇩🇪', label: 'DE' },
  { value: 'www.amazon.ca', flag: '🇨🇦', label: 'CA' },
  { value: 'www.amazon.com.au', flag: '🇦🇺', label: 'AU' },
  { value: 'www.amazon.ae', flag: '🇦🇪', label: 'AE' },
];

/** Pulls the 10-char ASIN out of a full Amazon product URL (e.g. .../dp/B0CHHSFMRL/...), or null if none found. */
function extractAsinFromUrl(url) {
  const match = url.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Za-z0-9]{10})(?:[/?]|$)/i);
  return match ? match[1].toUpperCase() : null;
}

/** Best-effort marketplace domain from a full Amazon URL, matched against the marketplaces this app supports. */
function extractMarketplaceFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const normalized = hostname.startsWith('www.') ? hostname : `www.${hostname}`;
    return MARKETPLACES.some((m) => m.value === normalized) ? normalized : null;
  } catch {
    return null;
  }
}

/** Shared "Advanced options" collapsible — same two settings for both creation modes
 *  (manual competitor selection, image generation model), just tucked out of the way by
 *  default so the fast path (paste ASIN, hit Generate) stays uncluttered. */
function AdvancedOptions({ manualCompetitors, setManualCompetitors, imageModel, setImageModel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl mt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-wrap items-baseline gap-2 text-sm font-medium text-slate-900">
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-slate-400" />
            Advanced options
          </span>
          <span className="text-xs font-normal text-slate-400">Optional — keep defaults for the fastest start.</span>
        </span>
        <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pt-4 pb-1">
          <button
            type="button"
            className={CHECK_ROW}
            aria-pressed={manualCompetitors}
            onClick={() => setManualCompetitors((v) => !v)}
          >
            <span className={`${CHECK_BOX} ${manualCompetitors ? CHECK_BOX_CHECKED : ''}`}>
              <Check size={12} strokeWidth={3} />
            </span>
            <span>
              Let me choose competitors for market research
              <span className="text-slate-500 text-xs">
                {' '}
                — we'll surface a wider list for you to pick from before running the full analysis.
              </span>
            </span>
          </button>
          <label className="block text-sm text-slate-500">
            Image generation model
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className={`${FIELD_INPUT} block w-full mt-1`}
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.description}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {' '}
              — {IMAGE_MODELS.find((m) => m.id === imageModel)?.description}. Used for every image generated in this
              campaign (drafts, finals, A+ visuals).
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

// Ported from speed-listing's pages/NewCampaignPage.tsx — dual-mode campaign creation
// (import an existing Amazon listing by ASIN, or start from a manual product brief).
// Restyled as a single unified card (icon+title header, full-width segmented pill, grouped
// ASIN+Marketplace row, collapsible Advanced options, one prominent CTA) — same two creation
// flows and the same fields/validation/settings as before, just cleaner visual structure.
export default function NewCampaignPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('mode') === 'manual' ? 'manual' : 'asin');
  const [asin, setAsin] = useState('');
  const [marketplace, setMarketplace] = useState('www.amazon.in');
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [demoMode, setDemoMode] = useState(false);
  const [manualCompetitors, setManualCompetitors] = useState(false);
  const [campaignLimitMessage, setCampaignLimitMessage] = useState(null);
  const [invalidFields, setInvalidFields] = useState(new Set());
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [aiFilledFields, setAiFilledFields] = useState(new Set());
  const [filling, setFilling] = useState(false);
  const fillInputRef = useRef(null);
  const imagesInputRef = useRef(null);
  const navigate = useNavigate();
  // `busy`/`filling` state drive the disabled buttons below, but a state update isn't visible
  // in the DOM until the next render commits — a fast double-click (or two independent
  // triggers of the same action) can both fire before that happens. These refs are checked and
  // set synchronously, so the second call is turned away regardless of render timing.
  const busyRef = useRef(false);
  const fillingRef = useRef(false);

  const clearInvalid = (name) =>
    setInvalidFields((s) => {
      if (!s.has(name)) return s;
      const next = new Set(s);
      next.delete(name);
      return next;
    });

  const clearAiFilled = (name) =>
    setAiFilledFields((s) => {
      if (!s.has(name)) return s;
      const next = new Set(s);
      next.delete(name);
      return next;
    });

  /** value+onChange for one manual-form field — keeps it controlled so "Fill from image" can populate it. */
  const bind = (name) => ({
    value: manualForm[name],
    onChange: (e) => {
      setManualForm((f) => ({ ...f, [name]: e.target.value }));
      clearInvalid(name);
      clearAiFilled(name);
    },
  });

  /** Wraps a field's label with the "AI-filled" badge while that field still holds the model's
   *  unedited answer. */
  const fieldLabel = (text, name) => (
    <>
      {text}
      {aiFilledFields.has(name) && <AiFilledBadge />}
    </>
  );

  /** Merges newly-picked files into the Product images input's FileList without dropping what's already selected. */
  const mergeIntoImagesInput = (newFiles) => {
    const input = imagesInputRef.current;
    if (!input) return;
    const dt = new DataTransfer();
    const seen = new Set();
    [...Array.from(input.files ?? []), ...newFiles].forEach((f) => {
      const key = `${f.name}:${f.size}:${f.lastModified}`;
      if (seen.has(key)) return;
      seen.add(key);
      dt.items.add(f);
    });
    input.files = dt.files;
    setPreviews(Array.from(input.files).map((f) => URL.createObjectURL(f)));
    clearInvalid('images');
  };

  /** Sends the given photo(s) off for vision analysis and fills the form fields with whatever comes back. */
  const analyzeImages = async (files, { mergeIntoProductImages }) => {
    if (files.length === 0 || fillingRef.current) return;
    fillingRef.current = true;
    setFilling(true);
    try {
      const fd = new FormData();
      files.slice(0, 4).forEach((f) => fd.append('images', f));
      const fields = await listingStudioApi.fillCampaignFromImage(fd);
      setManualForm((f) => ({
        ...f,
        name: fields.name || f.name,
        brand: fields.brand || f.brand,
        category: fields.category || f.category,
        description: fields.description || f.description,
        features: fields.features || f.features,
        dimensions: fields.dimensions || f.dimensions,
        materials: fields.materials || f.materials,
        targetAudience: fields.targetAudience || f.targetAudience,
        differentiators: fields.differentiators || f.differentiators,
      }));
      setInvalidFields(new Set());
      // Only badge the fields this response actually supplied a value for — a field the model
      // left null (and which therefore fell back to whatever was already there above) never
      // gets marked "AI-filled".
      setAiFilledFields((prev) => {
        const next = new Set(prev);
        AI_FILLABLE_FIELDS.forEach((key) => {
          if (fields[key]) next.add(key);
        });
        return next;
      });
      if (mergeIntoProductImages) mergeIntoImagesInput(files);
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      fillingRef.current = false;
      setFilling(false);
    }
  };

  /** "Fill from image" button: reuse whatever's already in Product images if the user picked some
   *  there already, instead of making them upload again — only prompt for a fresh photo when
   *  Product images is still empty. */
  const handleFillFromImageClick = () => {
    const existingImages = Array.from(imagesInputRef.current?.files ?? []);
    if (existingImages.length > 0) {
      analyzeImages(existingImages, { mergeIntoProductImages: false });
    } else {
      fillInputRef.current?.click();
    }
  };

  const onFillImagePicked = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow re-picking the same file(s) later
    analyzeImages(files, { mergeIntoProductImages: true });
  };

  useEffect(() => {
    api
      .get('/listing-studio/health')
      .then((res) => setDemoMode(res.data?.amazonProvider === 'mock'))
      .catch(() => undefined);
  }, []);

  const handleAsinInput = (value) => {
    if (!/^https?:\/\//i.test(value.trim())) {
      setAsin(value);
      return;
    }
    const detectedMarketplace = extractMarketplaceFromUrl(value.trim());
    if (detectedMarketplace) setMarketplace(detectedMarketplace);
    setAsin(extractAsinFromUrl(value) ?? value);
  };

  const importAsin = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const project = await listingStudioApi.createFromAsin(asin.trim(), marketplace, manualCompetitors, imageModel);
      // Research auto-starts server-side for an ASIN import (see the from-asin route) and
      // self-chains into strategy + A+ concepts — land on the live progress page instead of
      // the plain research tab.
      navigate(`/listing-studio/p/${project.id}/processing`);
    } catch (err) {
      // The shared axios instance's response interceptor already shows a toast for this;
      // this specific code additionally surfaces a persistent "Request more" action below.
      if (err?.response?.data?.code === 'campaign_limit_reached') setCampaignLimitMessage(err.response.data.error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (busyRef.current) return;
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      const invalid = new Set();
      const invalidElements = Array.from(form.elements).filter(
        (el) => (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && Boolean(el.name) && !el.validity.valid,
      );
      invalidElements.forEach((el) => invalid.add(el.name));
      setInvalidFields(invalid);
      invalidElements[0]?.focus();
      return;
    }
    setInvalidFields(new Set());
    busyRef.current = true;
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set('manualCompetitorSelection', String(manualCompetitors));
      fd.set('imageModel', imageModel);
      const project = await listingStudioApi.createProject(fd);
      navigate(`/listing-studio/p/${project.id}`);
    } catch (err) {
      // The shared axios instance's response interceptor already shows a toast for this;
      // this specific code additionally surfaces a persistent "Request more" action below.
      if (err?.response?.data?.code === 'campaign_limit_reached') setCampaignLimitMessage(err.response.data.error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const marketplaceMeta = MARKETPLACES.find((m) => m.value === marketplace) ?? MARKETPLACES[0];
  const advancedProps = { manualCompetitors, setManualCompetitors, imageModel, setImageModel };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-brand-600" />
            <h1 className="text-xl font-semibold text-slate-900">New Campaign</h1>
          </div>
          <Link to="/listing-studio/campaigns" className="text-sm text-brand-600 mt-1.5">
            Cancel
          </Link>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Import an existing Amazon listing by ASIN, or start from scratch with a manual product brief.
        </p>

        {campaignLimitMessage && (
          <div className={NOTICE_WARN}>
            <Lock size={16} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">
              {campaignLimitMessage}{' '}
              <Link to="/listing-studio/request-campaigns" className="font-semibold underline">
                Request more campaigns
              </Link>
              .
            </span>
          </div>
        )}

        <h2 className="text-sm font-semibold text-slate-900 mb-3">Campaign Setup</h2>

        <div className="flex rounded-xl border border-slate-200 overflow-hidden mb-5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'asin'}
            onClick={() => setTab('asin')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              tab === 'asin' ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Link2 size={16} /> From Amazon ASIN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'manual'}
            onClick={() => setTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-l border-slate-200 transition-colors ${
              tab === 'manual' ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PenLine size={16} /> New product (manual)
          </button>
        </div>

        {tab === 'asin' && (
          <>
            {demoMode && (
              <p className={ISSUE_WARN}>
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Demo mode: the backend is using sample Amazon data, so any ASIN returns the demo product. Set{' '}
                  <code>AMAZON_PROVIDER=brightdata</code> in the server env for real imports.
                </span>
              </p>
            )}
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <label htmlFor="np-asin" className="text-sm font-medium text-slate-900">
                ASIN or product URL
              </label>
              <span className="text-xs text-slate-400">Paste a link, or type the 10-character ASIN</span>
            </div>
            <div className="flex gap-3">
              <input
                id="np-asin"
                value={asin}
                onChange={(e) => handleAsinInput(e.target.value)}
                placeholder="Enter Amazon ASIN or product URL"
                className="flex-1 min-w-0 px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
              />
              <div className="relative flex-shrink-0">
                <select
                  value={marketplace}
                  onChange={(e) => setMarketplace(e.target.value)}
                  aria-label="Target marketplace"
                  className="appearance-none h-full pl-3.5 pr-8 py-2.5 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400"
                >
                  {MARKETPLACES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.flag} {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Output language + compliance rules can be tailored to {marketplaceMeta.label}.
            </p>
            {/^https?:\/\//i.test(asin.trim()) && (
              <p className={`${ERROR_TEXT} text-sm mt-1`}>
                Couldn't find an ASIN in that URL — check it's a product page link (containing /dp/ or /gp/product/).
              </p>
            )}

            <AdvancedOptions {...advancedProps} />

            <button
              type="button"
              onClick={importAsin}
              disabled={busy || asin.trim().length !== 10}
              className={PRIMARY_CTA}
            >
              <Sparkles size={17} />
              {busy ? 'Importing… (can take a few min)' : 'Generate'}
            </button>
          </>
        )}

        {tab === 'manual' && (
          <form onSubmit={submitManual} noValidate>
            <label className="block mb-3 text-sm text-slate-500">
              Target marketplace
              <select
                name="marketplace"
                defaultValue="www.amazon.in"
                className={`${FIELD_INPUT} block w-full mt-1`}
              >
                {MARKETPLACES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.flag} {m.value.replace('www.', '')}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-3 mb-4 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-4 py-3.5">
              <span className="w-10 h-10 rounded-lg bg-white border border-brand-200 text-brand-600 grid place-items-center flex-shrink-0 shadow-sm">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Upload a product photo</p>
                <p className="text-xs text-slate-500">Let AI read it and fill in the fields below for you.</p>
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={handleFillFromImageClick}
                loading={filling}
                className="flex-shrink-0"
              >
                <Sparkles size={14} /> {filling ? 'Analyzing…' : 'Fill from image'}
              </Button>
              <input
                ref={fillInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={onFillImagePicked}
              />
            </div>

            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-3">
              <Package size={15} className="text-brand-600" /> Product Information
            </h3>

            <div className={GRID2}>
              <FormField
                label={fieldLabel('Product name *', 'name')}
                name="name"
                required
                placeholder="AquaVolt 32oz Insulated Bottle"
                invalid={invalidFields.has('name')}
                {...bind('name')}
              />
              <FormField
                label={fieldLabel('Brand *', 'brand')}
                name="brand"
                required
                placeholder="AquaVolt"
                invalid={invalidFields.has('brand')}
                {...bind('brand')}
              />
              <FormField
                label={fieldLabel('Category *', 'category')}
                name="category"
                required
                placeholder="Sports & Outdoors > Water Bottles"
                invalid={invalidFields.has('category')}
                {...bind('category')}
              />
              <FormField
                label="Planned price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="24.99"
                {...bind('price')}
              />
              <FormField label={fieldLabel('Dimensions / variants', 'dimensions')} name="dimensions" placeholder="32oz, 3 colors" {...bind('dimensions')} />
              <FormField label={fieldLabel('Materials', 'materials')} name="materials" placeholder="18/8 stainless steel" {...bind('materials')} />
            </div>
            <FormField
              label={fieldLabel('Short description *', 'description')}
              name="description"
              required
              multiline
              rows={3}
              invalid={invalidFields.has('description')}
              {...bind('description')}
            />
            <FormField
              label={fieldLabel('Key features *', 'features')}
              name="features"
              required
              multiline
              rows={3}
              placeholder="One per line"
              invalid={invalidFields.has('features')}
              {...bind('features')}
            />
            <div className={GRID2}>
              <FormField label={fieldLabel('Target audience', 'targetAudience')} name="targetAudience" {...bind('targetAudience')} />
              <FormField label={fieldLabel('What makes it different?', 'differentiators')} name="differentiators" {...bind('differentiators')} />
            </div>
            <label className={`block mb-3 text-sm ${invalidFields.has('images') ? 'text-red-600' : 'text-slate-500'}`}>
              Product images * <span className="text-xs text-slate-500">(multiple angles, ≥1600px recommended)</span>
              <input
                ref={imagesInputRef}
                type="file"
                name="images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
                className="block w-full mt-1"
                onChange={(e) => {
                  const files = e.target.files;
                  const issue = validateUploadFiles(files);
                  if (issue) {
                    toast.error(issue);
                    e.target.value = '';
                    setPreviews([]);
                    return;
                  }
                  setPreviews(Array.from(files ?? []).map((f) => URL.createObjectURL(f)));
                  clearInvalid('images');
                }}
              />
              {previews.length > 0 && (
                <span className="text-xs text-slate-500">{previews.length} of {MAX_UPLOAD_FILES} selected</span>
              )}
            </label>
            <div className={THUMBS}>
              {previews.map((src) => (
                <img key={src} src={src} alt="" className={THUMB} />
              ))}
            </div>

            <AdvancedOptions {...advancedProps} />

            <button
              type="submit"
              disabled={busy}
              className={PRIMARY_CTA}
            >
              <Sparkles size={17} />
              {busy ? 'Creating…' : 'Create campaign'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

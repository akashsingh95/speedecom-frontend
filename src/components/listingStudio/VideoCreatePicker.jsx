/* eslint-disable no-unused-vars -- this client's eslint config lacks react/jsx-uses-vars, so
   JSX-only usage of these imports false-positives as unused (see ListingStudioPlansManager.jsx). */
import React, { useRef, useState } from 'react';
import { Shirt, Gem, Car, UtensilsCrossed, Package, LayoutGrid, ArrowLeft } from 'lucide-react';
import { CARD_TITLE, MUTED, BTN, BTN_PRIMARY, CANDIDATE_BADGE } from './ui/classNames';
import { CreditCostPill } from './ui/CreditCostPill';

const CATEGORY_OPTIONS = [
  { kind: 'clothing', icon: Shirt, title: 'Clothing', description: 'Worn by a model and revealed from multiple angles.' },
  { kind: 'jewellery', icon: Gem, title: 'Jewellery', description: 'Worn by a model, highlighting craftsmanship and detail.' },
  { kind: 'car-accessories', icon: Car, title: 'Car Accessories', description: 'Installed or used in its vehicle context.' },
  { kind: 'home-kitchen', icon: UtensilsCrossed, title: 'Home & Kitchen', description: 'Used or positioned in its natural home/kitchen setting.' },
  { kind: 'other', icon: Package, title: 'Other', description: 'Worn, held, used, or displayed according to its intended purpose.' },
];

const MAX_REFERENCE_IMAGES = 10;

function ImageThumbPicker({ images, selectedIds, maxSelected, onToggle }) {
  if (images.length === 0) {
    return <p className={`${MUTED} text-sm`}>No generated images yet — generate one on the Images tab first.</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {images.map((img) => {
        const isSelected = selectedIds.includes(img.id);
        const atCap = !isSelected && selectedIds.length >= maxSelected;
        return (
          <button
            key={img.id}
            type="button"
            title={img.type}
            disabled={atCap}
            onClick={() => onToggle(img.id)}
            className={`relative shrink-0 rounded-md overflow-hidden border-2 ${isSelected ? 'border-brand-500' : 'border-slate-200'} ${atCap ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <img src={img.path} alt="" className="w-16 h-16 object-cover block" />
            {isSelected && <span className={CANDIDATE_BADGE}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function AngleRow({ angle, ready, checked, pickedImageIds, images, pickerOpen, onToggle, onTogglePicker, onToggleImage }) {
  const hasImage = ready || pickedImageIds.length > 0;
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">{angle.name}</p>
          <p className={`${MUTED} text-xs`}>
            {ready
              ? 'A+ image ready'
              : pickedImageIds.length > 0
                ? `${pickedImageIds.length} image${pickedImageIds.length === 1 ? '' : 's'} picked`
                : 'No A+ image yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!ready && (
            <button type="button" className={BTN} onClick={onTogglePicker}>
              {pickerOpen ? 'Done' : pickedImageIds.length > 0 ? 'Edit images' : 'Pick images'}
            </button>
          )}
          {hasImage && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 accent-violet-600" />
            </label>
          )}
        </div>
      </div>
      {!ready && pickerOpen && (
        <div className="mt-3">
          <ImageThumbPicker images={images} selectedIds={pickedImageIds} maxSelected={MAX_REFERENCE_IMAGES} onToggle={onToggleImage} />
        </div>
      )}
    </div>
  );
}

export function VideoCreatePicker({ angles, hasReadySeedImage, generatedImages, onGenerateCategory, onGenerateAngles, busy, videoCost = null, freeVideosRemaining = 0 }) {
  const [step, setStep] = useState('choose');
  const [categoryKind, setCategoryKind] = useState(null);
  const [categoryImageIds, setCategoryImageIds] = useState([]);
  const [checkedAngles, setCheckedAngles] = useState(() => new Set());
  const [manualImageByAngle, setManualImageByAngle] = useState(() => new Map());
  const [openPickerForAngle, setOpenPickerForAngle] = useState(null);

  const chooseCategory = (kind) => {
    setCategoryKind(kind);
    setCategoryImageIds([]);
    setStep('category');
  };

  const toggleCategoryImage = (id) => {
    setCategoryImageIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_REFERENCE_IMAGES) return prev;
      return [...prev, id];
    });
  };

  const toggleAngle = (name, ready) => {
    setCheckedAngles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (ready || (manualImageByAngle.get(name)?.length ?? 0) > 0) next.add(name);
      return next;
    });
  };

  const toggleImageForAngle = (name, imageId) => {
    const current = manualImageByAngle.get(name) ?? [];
    const willHaveImage = current.includes(imageId) ? current.length > 1 : true;
    setManualImageByAngle((prev) => {
      const next = new Map(prev);
      const updated = current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : current.length < MAX_REFERENCE_IMAGES
          ? [...current, imageId]
          : current;
      if (updated.length === 0) next.delete(name);
      else next.set(name, updated);
      return next;
    });
    setCheckedAngles((prev) => {
      const next = new Set(prev);
      if (willHaveImage) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  // Each generate POST is billed, and `busy` (jobRunning) doesn't cover the request itself, so the
  // button is locked from the first click until the call settles. The ref blocks a second click
  // landing before React re-renders the disabled button; the state drives the UI.
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const runSubmit = async (call) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await call();
    } catch {
      // handled by the caller
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const locked = busy || submitting;

  const submitCategory = () => {
    if (categoryImageIds.length === 0 || locked) return;
    return runSubmit(() => onGenerateCategory(categoryKind, categoryImageIds));
  };

  const submitAngles = () => {
    if (checkedAngles.size === 0 || locked) return;
    const payload = Array.from(checkedAngles).map((name) => ({ name, sourceImageIds: manualImageByAngle.get(name) }));
    return runSubmit(() => onGenerateAngles(payload));
  };

  if (step === 'choose') {
    return (
      <div>
        <h2 className={CARD_TITLE}>Generate new video</h2>
        <p className={`${MUTED} mb-4`}>Pick a product category, or build one from a marketing angle.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CATEGORY_OPTIONS.map(({ kind, icon: Icon, title, description }) => (
            <button
              key={kind}
              type="button"
              onClick={() => chooseCategory(kind)}
              className="text-left rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-card-hover transition-all"
            >
              <span className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 grid place-items-center mb-2.5">
                <Icon size={18} />
              </span>
              <p className="font-semibold text-slate-900">{title}</p>
              <p className={`${MUTED} text-sm mt-1`}>{description}</p>
            </button>
          ))}
          {angles.length > 0 && (
            <button
              type="button"
              onClick={() => setStep('angles')}
              className="text-left rounded-xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-card-hover transition-all"
            >
              <span className="w-10 h-10 rounded-lg bg-violet-100 text-violet-600 grid place-items-center mb-2.5">
                <LayoutGrid size={18} />
              </span>
              <p className="font-semibold text-slate-900">Marketing Angle</p>
              <p className={`${MUTED} text-sm mt-1`}>Build a video around one of your creative strategy's angles.</p>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'category') {
    const { title } = CATEGORY_OPTIONS.find((o) => o.kind === categoryKind);
    return (
      <div>
        <button type="button" onClick={() => setStep('choose')} className={`${MUTED} text-sm flex items-center gap-1 mb-3`}>
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className={CARD_TITLE}>{title}</h2>
        <p className={`${MUTED} mb-3`}>
          Pick up to {MAX_REFERENCE_IMAGES} images of the same product — they're used together as references for one video.
        </p>
        <ImageThumbPicker images={generatedImages} selectedIds={categoryImageIds} maxSelected={MAX_REFERENCE_IMAGES} onToggle={toggleCategoryImage} />
        <div className="flex items-center gap-2 mt-4">
          <button type="button" className={BTN_PRIMARY} disabled={categoryImageIds.length === 0 || locked} onClick={submitCategory}>
            {locked ? 'Generating…' : 'Generate video'}
          </button>
          {!locked && <CreditCostPill imageCost={videoCost} freeRemaining={freeVideosRemaining} unit="video" />}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={() => setStep('choose')} className={`${MUTED} text-sm flex items-center gap-1 mb-3`}>
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className={CARD_TITLE}>Marketing angles</h2>
      <p className={`${MUTED} mb-3`}>
        Check the angle(s) you want a video for. For an angle with no A+ image yet, pick one or more of your generated images to use instead.
      </p>
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {angles.map((angle) => {
          const ready = hasReadySeedImage(angle.name);
          return (
            <AngleRow
              key={angle.name}
              angle={angle}
              ready={ready}
              checked={checkedAngles.has(angle.name)}
              pickedImageIds={manualImageByAngle.get(angle.name) ?? []}
              images={generatedImages}
              pickerOpen={openPickerForAngle === angle.name}
              onToggle={() => toggleAngle(angle.name, ready)}
              onTogglePicker={() => setOpenPickerForAngle((cur) => (cur === angle.name ? null : angle.name))}
              onToggleImage={(imageId) => toggleImageForAngle(angle.name, imageId)}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button type="button" className={BTN_PRIMARY} disabled={checkedAngles.size === 0 || locked} onClick={submitAngles}>
          {locked ? 'Generating…' : `Generate video${checkedAngles.size === 1 ? '' : 's'} for ${checkedAngles.size} angle${checkedAngles.size === 1 ? '' : 's'}`}
        </button>
        {/* One video per checked angle; nothing to price until at least one is checked. */}
        {!locked && checkedAngles.size > 0 && (
          <CreditCostPill imageCost={videoCost} freeRemaining={freeVideosRemaining} count={checkedAngles.size} unit="video" />
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { BTN, MUTED } from './classNames';

/**
 * Controlled single-image file picker with a thumbnail preview, used by BrandkitFormModal for
 * the optional logo. No existing single-file+preview component in this codebase fit —
 * GenerateNewImageModal's reference-photo picker is the closest ancestor but has no thumbnail.
 *
 * `value` is one of:
 *  - `File` — freshly picked, not yet uploaded (previewed via a revocable object URL)
 *  - `string` — an existing logoUrl (edit mode, unchanged so far)
 *  - `null` — no logo, or explicitly removed
 *
 * GIFs are deliberately excluded from `accept`: the backend rejects them even though the shared
 * upload multer allows it, since a GIF logo would silently be dropped (not error) by the
 * generation pipeline's reference-image loader, which only recognizes jpg/jpeg/png/webp.
 */
export function LogoUploadField({ value, onChange }) {
  const inputRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!(value instanceof File)) {
      setObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const previewSrc = value instanceof File ? objectUrl : typeof value === 'string' ? value : null;

  return (
    <label className="block mb-3.5 text-sm text-slate-900">
      <span>Logo</span>
      <div className="flex items-center gap-3 mt-1">
        {previewSrc ? (
          <img src={previewSrc} alt="" className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-200 flex-shrink-0 p-1" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex-shrink-0" />
        )}
        <button type="button" className={BTN} onClick={() => inputRef.current?.click()}>
          {previewSrc ? 'Change logo' : '+ Upload logo'}
        </button>
        {previewSrc && (
          <button
            type="button"
            className={BTN}
            onClick={() => {
              onChange(null);
              // Reset so re-picking the same file fires onChange again — the browser doesn't
              // treat re-selecting an unchanged value as a change otherwise.
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
        }}
      />
      {!previewSrc && (
        <span className={`${MUTED} text-xs block mt-1`}>Optional — used as a reference image in every generated picture.</span>
      )}
    </label>
  );
}

import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { FormField } from './ui/FormField';
import { ColorInput } from './ui/ColorInput';
import { LogoUploadField } from './ui/LogoUploadField';
import { brandkitApi } from './brandkitApi';
import { getErrorMessage } from './errors';
import { BTN, BTN_PRIMARY, ERROR_TEXT, CARD_TITLE, GRID2 } from './ui/classNames';

// Just so the swatches aren't black on first open of a brand-new Brandkit — not a brand
// recommendation, purely a friendlier default.
const DEFAULT_PRIMARY = '#0284C7';
const DEFAULT_SECONDARY = '#64748B';

/**
 * Single-step create/edit modal for a Brandkit (name, logo, 2 colors, font), built on the
 * shared `Modal`. Used unmodified by both the dedicated CRUD page (BrandkitsPage) and
 * BrandkitSelect's inline "+ Create new Brandkit" quick-create — the only difference between
 * the two call sites is whether `brandkit` (edit mode) is passed.
 *
 * `save()` builds a FormData (multipart, since logo is an optional file), calls
 * brandkitApi.createBrandkit/updateBrandkit, and calls `onSaved(brandkit)` with the server's
 * response either way — callers own what happens next (push into a list, select it, close).
 */
export function BrandkitFormModal({ brandkit, onClose, onSaved }) {
  const isEdit = !!brandkit;
  const [name, setName] = useState(brandkit?.name ?? '');
  const [primaryColor, setPrimaryColor] = useState(brandkit?.primaryColor ?? DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(brandkit?.secondaryColor ?? DEFAULT_SECONDARY);
  const [font, setFont] = useState(brandkit?.font ?? '');
  // string (existing logoUrl) in edit mode, else null — see LogoUploadField's value contract.
  const [logo, setLogo] = useState(brandkit?.logoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSave = name.trim().length > 0 && font.trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(primaryColor);

  const save = async () => {
    if (!canSave) {
      setError('Name, a valid primary color, and font are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('primaryColor', primaryColor);
      if (secondaryColor) form.append('secondaryColor', secondaryColor);
      form.append('font', font.trim());
      if (logo instanceof File) {
        form.append('logo', logo);
      } else if (logo === null && isEdit) {
        // Presence/absence of the `logo` field alone can't express "remove" — this explicit
        // flag is the backend's contract for clearing an existing logo without replacing it.
        form.append('removeLogo', 'true');
      }
      const saved = isEdit ? await brandkitApi.updateBrandkit(brandkit.id, form) : await brandkitApi.createBrandkit(form);
      onSaved(saved);
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className={`${CARD_TITLE} mb-3`}>{isEdit ? 'Edit Brandkit' : 'New Brandkit'}</h2>

      <FormField label="Name *" name="name" required placeholder="AquaVolt" value={name} onChange={(e) => setName(e.target.value)} />

      <LogoUploadField value={logo} onChange={setLogo} />

      <div className={GRID2}>
        <ColorInput label="Primary color *" value={primaryColor} onChange={setPrimaryColor} />
        <ColorInput label="Secondary color" value={secondaryColor} onChange={setSecondaryColor} />
      </div>

      <FormField label="Font *" name="font" required placeholder="Poppins" value={font} onChange={(e) => setFont(e.target.value)} />

      {error && <p className={`${ERROR_TEXT} mb-2 text-sm`}>{error}</p>}

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className={BTN} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={BTN_PRIMARY} disabled={busy || !canSave} onClick={() => void save()}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create Brandkit'}
        </button>
      </div>
    </Modal>
  );
}

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useBrandkits } from './useBrandkits';
import { BrandkitFormModal } from './BrandkitFormModal';
import { FIELD_INPUT } from './ui/classNames';

const CREATE_NEW = '__create_new_brandkit__';

/**
 * Reusable Brandkit dropdown + inline "+ Create new Brandkit" quick-create, shared by
 * NewCampaignPage (both its manual form and ASIN-import tab) and ProjectLayout's TopNav
 * (post-creation editing) so the quick-create flow exists in exactly one place, not duplicated
 * per call site.
 *
 * A plain native `<select>` — the bespoke searchable-dropdown pattern in ProjectsPage is
 * available later if Brandkit counts per tenant ever grow past what a native select handles
 * well, but that's not the case today. `value` is a Brandkit id or `''` for "None". Pass `name`
 * to make this a real form field (NewCampaignPage's manual tab picks it up via
 * `new FormData(e.currentTarget)` with zero extra wiring); omit it for a purely-controlled
 * usage (ASIN tab, ProjectLayout's TopNav).
 *
 * The quick-create modal is rendered through a portal to `document.body` rather than inline:
 * this select (and its modal) can be used inside NewCampaignPage's manual `<form>`, and an
 * un-portaled Modal would leave BrandkitFormModal's own inputs as DOM descendants of that
 * outer form — pressing Enter in one of them would then implicitly submit the campaign form.
 * Portaling keeps the modal working identically wherever BrandkitSelect is used.
 */
export function BrandkitSelect({ name, value, onChange }) {
  const { brandkits, setBrandkits } = useBrandkits();
  const [showCreate, setShowCreate] = useState(false);

  const handleChange = (e) => {
    const next = e.target.value;
    if (next === CREATE_NEW) {
      // A controlled <select> whose `value` prop doesn't change (onChange isn't called here)
      // won't have React re-sync its DOM value — reset it synchronously so the sentinel option
      // doesn't stay visibly "selected" while the create modal is open.
      e.target.value = value ?? '';
      setShowCreate(true);
      return;
    }
    onChange(next);
  };

  return (
    <>
      <select name={name} value={value ?? ''} onChange={handleChange} className={`${FIELD_INPUT} block w-full mt-1`}>
        <option value="">No Brandkit</option>
        {brandkits?.map((bk) => (
          <option key={bk.id} value={bk.id}>
            {bk.name}
          </option>
        ))}
        <option value={CREATE_NEW}>+ Create new Brandkit</option>
      </select>

      {showCreate &&
        createPortal(
          <BrandkitFormModal
            onClose={() => setShowCreate(false)}
            onSaved={(created) => {
              setBrandkits((prev) => [created, ...(prev ?? [])]);
              onChange(created.id);
              setShowCreate(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}

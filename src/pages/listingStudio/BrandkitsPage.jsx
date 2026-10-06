import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBrandkits } from '../../components/listingStudio/useBrandkits';
import { brandkitApi } from '../../components/listingStudio/brandkitApi';
import { BrandkitFormModal } from '../../components/listingStudio/BrandkitFormModal';
import { getErrorMessage } from '../../components/listingStudio/errors';
import { Modal } from '../../components/listingStudio/ui/Modal';
import {
  BTN_PRIMARY,
  BTN,
  BTN_DANGER,
  PAGE_HEAD,
  PAGE_TITLE,
  CARD_TITLE,
  MUTED,
  GRID_CARDS,
  PROJECT_CARD,
  THUMB_LG,
  THUMB_LG_PLACEHOLDER,
  SKELETON_BLOCK,
  EMPTY_STATE,
} from '../../components/listingStudio/ui/classNames';

/**
 * Dedicated Brandkit CRUD screen — mirrors ProjectsPage's grid-of-cards visual pattern
 * (GRID_CARDS, hover-revealed edit/delete icons, Modal-based delete confirmation), but edits
 * open the full BrandkitFormModal (5 fields) instead of an inline rename, since a Brandkit has
 * more to edit than just a name. Reachable from the Campaigns page's header button row; gated
 * against cross-tenant roles (SuperAdmin/SBM acting as themselves — no tenant to own a
 * Brandkit) via ListingStudioCrossTenantBlocked in App.jsx.
 */
export default function BrandkitsPage() {
  const { brandkits, setBrandkits } = useBrandkits();
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const deleteBrandkit = async () => {
    const bk = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(bk.id);
    try {
      await brandkitApi.deleteBrandkit(bk.id);
      setBrandkits((prev) => prev.filter((b) => b.id !== bk.id));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <Link
            to="/listing-studio/campaigns"
            aria-label="Back to campaigns"
            className="flex-shrink-0 w-8 h-8 rounded-lg grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className={PAGE_TITLE}>Brandkits</h1>
            <p className={MUTED}>Reusable brand identities you can attach to any campaign.</p>
          </div>
        </div>
        <button className={`${BTN_PRIMARY} gap-1.5`} onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Brandkit
        </button>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {!brandkits && !error && (
        <div className={GRID_CARDS}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={SKELETON_BLOCK} />
          ))}
        </div>
      )}

      {brandkits?.length === 0 && (
        <div className={EMPTY_STATE}>
          <h2 className="text-lg font-medium mb-2">No Brandkits yet</h2>
          <p>Create one to keep your logo, colors, and font consistent across every campaign.</p>
          <button className={BTN_PRIMARY} onClick={() => setShowCreate(true)}>
            Create your first Brandkit
          </button>
        </div>
      )}

      <div className={GRID_CARDS}>
        {brandkits?.map((bk) => (
          <div key={bk.id} className={`${PROJECT_CARD} group relative`}>
            {bk.logoUrl ? (
              <img src={bk.logoUrl} alt="" className={`${THUMB_LG} object-contain p-1.5`} />
            ) : (
              <div className={THUMB_LG_PLACEHOLDER} style={{ backgroundColor: bk.primaryColor }} />
            )}
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-slate-900">{bk.name}</strong>
              <div className="text-slate-500 text-xs flex items-center gap-1.5 mt-1">
                <span className="w-3 h-3 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: bk.primaryColor }} />
                <span className="w-3 h-3 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: bk.secondaryColor }} />
                <span className="truncate">{bk.font}</span>
              </div>
            </div>
            <div
              className={`absolute bottom-3 right-3 flex gap-1.5 transition-opacity ${
                deletingId === bk.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <button
                type="button"
                title="Edit Brandkit"
                aria-label="Edit Brandkit"
                className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 bg-white border border-slate-200 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50"
                onClick={() => setEditing(bk)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                title="Delete Brandkit"
                aria-label="Delete Brandkit"
                className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 bg-white border border-slate-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                disabled={deletingId === bk.id}
                onClick={() => setConfirmDelete(bk)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <BrandkitFormModal
          onClose={() => setShowCreate(false)}
          onSaved={(created) => {
            setBrandkits((prev) => [created, ...(prev ?? [])]);
            setShowCreate(false);
          }}
        />
      )}

      {editing && (
        <BrandkitFormModal
          brandkit={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBrandkits((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <h2 className={`${CARD_TITLE} mb-2`}>Delete Brandkit?</h2>
          <p className={`${MUTED} mb-4`}>
            &quot;{confirmDelete.name}&quot; will be permanently deleted. Campaigns currently using it keep their generated
            content but lose the Brandkit link.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className={BTN_DANGER} onClick={deleteBrandkit}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

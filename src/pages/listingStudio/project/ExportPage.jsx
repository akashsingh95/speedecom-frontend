import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Download, Loader2 } from 'lucide-react';
import { listingStudioApi, byteLen } from '../../../components/listingStudio/api';
import { useProjectCtx } from '../../../components/listingStudio/context';
import {
  PAGE_HEAD, PAGE_TITLE, MUTED, CARD, GRID_CARDS, ROW, BTN, BTN_PRIMARY, BADGE_GOOD, THUMBS,
  WIZARD_STEPS, WIZARD_STEP, WIZARD_STEP_ACTIVE, WIZARD_STEP_DONE, STEP_NUM,
  CONCEPT_SELECT_CARD, CONCEPT_SELECT_CARD_SELECTED, DOWNLOAD_ROW, COPY_BOX, COPY_BOX_SMALL,
  ISSUE_WARN, ERROR_TEXT, ICON_LABEL,
} from '../../../components/listingStudio/ui/classNames';

const STEPS = ['Choose concept', 'Pre-flight checks', 'Listing copy', 'Images', 'Download'];

/** A download button's label — spinner+"Preparing…" while in flight, download icon+the real
 *  label otherwise. Shared by the 3 export buttons below so they stay in sync. */
function DownloadLabel({ busy, label }) {
  return (
    <span className={ICON_LABEL}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {busy ? 'Preparing…' : label}
    </span>
  );
}

/**
 * Ported from speed-listing's pages/project/ExportPage.tsx — 5-step export wizard. Pre-flight
 * compliance issues are fetched from the same validateConcept()-backed endpoint the editor uses
 * (listingStudioApi.getCompliance), never reimplemented client-side. Downloads go through the
 * shared authenticated axios instance as a blob fetch (listingStudioApi.download*), not a plain
 * <a href> — a normal link click can't carry the Bearer token the API requires.
 */
export default function ExportPage() {
  const { project } = useProjectCtx();
  const [step, setStep] = useState(0);
  const [conceptId, setConceptId] = useState('');
  const [issues, setIssues] = useState(null);
  const [downloading, setDownloading] = useState('');

  const runDownload = (key, fn) => {
    setDownloading(key);
    fn().catch((err) => console.error('Export download failed:', err)).finally(() => setDownloading(''));
  };

  const concepts = project.aplus?.concepts ?? [];
  const concept = concepts.find((c) => c.id === conceptId);
  const listing = project.listing;

  useEffect(() => {
    if (!conceptId && concepts.length) setConceptId(concepts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts, conceptId]);

  useEffect(() => {
    if (step === 1 && conceptId) {
      listingStudioApi.getCompliance(project.id, conceptId).then(setIssues, () => setIssues([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, conceptId, project.id]);

  const listingIssues = [];
  if (!listing) listingIssues.push('No listing copy generated yet');
  if (listing && listing.title.length > 200) listingIssues.push(`Title is ${listing.title.length}/200 characters`);
  if (listing && byteLen(listing.backendKeywords) > 249) listingIssues.push('Backend keywords exceed 249 bytes');
  const errors = (issues ?? []).filter((i) => i.severity === 'error');
  const warnings = (issues ?? []).filter((i) => i.severity === 'warning');

  const finals = (project.generatedImages ?? []).filter((i) => i.quality === 'final');
  const moduleImages = concept?.modules.flatMap((m) => m.images.filter((s) => s.path)) ?? [];

  return (
    <div>
      <div className={PAGE_HEAD}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 grid place-items-center flex-shrink-0">
            <Upload size={16} />
          </span>
          <h1 className={PAGE_TITLE}>Amazon Listing — Export</h1>
        </div>
      </div>

      <div className={WIZARD_STEPS}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`${WIZARD_STEP} ${i === step ? WIZARD_STEP_ACTIVE : ''} ${i < step ? WIZARD_STEP_DONE : ''}`}
            onClick={() => setStep(i)}
          >
            <span className={STEP_NUM}>{i < step ? '✓' : i + 1}</span> {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Choose the A+ concept to export</h2>
          {concepts.length === 0 && (
            <p className={`${MUTED} mb-3`}>
              No A+ concepts yet — <Link className="text-brand-600 underline" to="../aplus">generate them first</Link>, or continue with listing copy only.
            </p>
          )}
          <div className={`${GRID_CARDS} mb-3`}>
            {concepts.map((c) => (
              <label
                key={c.id}
                className={`${CONCEPT_SELECT_CARD} ${conceptId === c.id ? CONCEPT_SELECT_CARD_SELECTED : ''}`}
              >
                <input type="radio" name="concept" className="sr-only" checked={conceptId === c.id} onChange={() => setConceptId(c.id)} />
                <strong className="text-slate-900 text-sm">{c.name}</strong>
                <p className={`${MUTED} text-xs`}>{c.rationale}</p>
              </label>
            ))}
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={() => setStep(1)}>Continue</button>
        </div>
      )}

      {step === 1 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Pre-flight checks</h2>
          {issues === null && conceptId && <p className={MUTED}>Checking…</p>}
          {listingIssues.map((m) => (
            <p key={m} className={ISSUE_WARN}>
              {m} — <Link className="underline" to="../listing">fix on Listing page</Link>
            </p>
          ))}
          {errors.map((i, n) => (
            <p key={n} className={`${ISSUE_WARN} ${ERROR_TEXT} border-red-600 bg-red-50`}>
              {i.message} — <Link className="underline" to={`../editor/${conceptId}`}>fix in editor</Link>
            </p>
          ))}
          {warnings.map((i, n) => (
            <p key={n} className={ISSUE_WARN}>{i.message}</p>
          ))}
          {issues !== null && errors.length === 0 && listingIssues.length === 0 && (
            <p className={BADGE_GOOD}>No blocking issues ✓</p>
          )}
          <div className={`${ROW} mt-3`}>
            <button type="button" className={BTN} onClick={() => setStep(0)}>Back</button>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => setStep(2)}
              disabled={errors.length > 0 || listingIssues.length > 0}
              title={errors.length || listingIssues.length ? 'Resolve blocking issues first' : ''}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Listing copy</h2>
          {listing ? (
            <>
              <div className={COPY_BOX}>{listing.title}</div>
              {listing.bullets.map((b, i) => (
                <div key={i} className={`${COPY_BOX} ${COPY_BOX_SMALL}`}>{b}</div>
              ))}
            </>
          ) : (
            <p className={MUTED}>
              No listing copy — <Link className="text-brand-600 underline" to="../listing">generate it</Link>.
            </p>
          )}
          <div className={`${ROW} mt-3`}>
            <button type="button" className={BTN} onClick={() => setStep(1)}>Back</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setStep(3)}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Images going into the export</h2>
          <h3 className="text-sm font-semibold text-slate-900 mt-2">Listing finals ({finals.length})</h3>
          <div className={THUMBS}>
            {finals.map((i) => <img key={i.id} src={i.path} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />)}
            {finals.length === 0 && <p className={MUTED}>No high-quality finals yet.</p>}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mt-3">A+ module images ({moduleImages.length})</h3>
          <div className={THUMBS}>
            {moduleImages.map((s, i) => <img key={i} src={s.path} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />)}
            {moduleImages.length === 0 && <p className={MUTED}>No module images attached yet.</p>}
          </div>
          <div className={`${ROW} mt-3`}>
            <button type="button" className={BTN} onClick={() => setStep(2)}>Back</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setStep(4)}>Continue</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className={CARD}>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Download</h2>
          <p className={`${MUTED} mb-3`}>
            Upload the sheet via Seller Central's "Add Products via Upload", and the A+ JSON/images via A+ Content Manager.
          </p>
          <div className={`${DOWNLOAD_ROW} mb-3`}>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={downloading === 'xlsx'}
              onClick={() => runDownload('xlsx', () => listingStudioApi.downloadListingXlsx(project.id))}
            >
              <DownloadLabel busy={downloading === 'xlsx'} label="Listing sheet (.xlsx)" />
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={downloading === 'zip'}
              onClick={() => runDownload('zip', () => listingStudioApi.downloadImagesZip(project.id))}
            >
              <DownloadLabel busy={downloading === 'zip'} label="All images (.zip)" />
            </button>
            {concept && (
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={downloading === 'aplus'}
                onClick={() => runDownload('aplus', () => listingStudioApi.downloadAplusJson(project.id, concept.id))}
              >
                <DownloadLabel busy={downloading === 'aplus'} label={`A+ content (${concept.name}) (.json)`} />
              </button>
            )}
          </div>
          <button type="button" className={BTN} onClick={() => setStep(3)}>Back</button>
        </div>
      )}
    </div>
  );
}

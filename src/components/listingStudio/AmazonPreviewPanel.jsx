import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { amazonUrl } from './helpers';
import { premiumAplusApi } from './premiumAplusApi';
import { SharePreviewButton } from './SharePreviewButton';

// Amazon's real PDP shows rating, delivery dates and offers — none of which exist in our
// schema (see server/listingStudio/models/Project.js). This panel previews how the generated
// listing will look on an actual Amazon product page, so these stay as illustrative
// placeholders rather than being wired to data that doesn't exist. Price is the one field that
// IS real (project.input.price, set on the campaign's "Planned price" field — see
// NewCampaignPage.jsx) so it's computed from that instead of hardcoded; see FALLBACK_PRICE below.
const FALLBACK_PRICE = 1499;
const DISCOUNT = '32%';
const RATING = '4.3';
const REVIEW_COUNT = '1,059';
const DELIVERY_DATE = 'Thursday, 17 September';
const FAST_DELIVERY_DATE = 'Wednesday, 16 September';
const DELIVERY_LOCATION = 'Surat 394101';

// Visual affordance for the fields that are actually editable (title/bullets/description) —
// a subtle dashed border + tint so they read as editable without breaking the Amazon-chrome
// look the rest of the page copies pixel-for-pixel.
const EDITABLE_FIELD_STYLE = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#0f1111',
  border: '1px dashed #d5d9d9',
  borderRadius: 4,
  background: '#fafafa',
  padding: '4px 6px',
};

/** Generated images in display order — same `position` sort ImagesPage uses. */
export function sortedGeneratedImages(project) {
  return [...(project.generatedImages ?? [])].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
}

function overlayImage(concept) {
  const module = concept.modules?.find((m) => m.type === 'STANDARD_IMAGE_TEXT_OVERLAY');
  return module?.images?.find((s) => s.key === 'main') ?? null;
}

function renderStars(rating) {
  const filled = Math.round(Math.min(Math.max(rating, 0), 5));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Neither the seller's own listing nor a scraped competitor has a real MRP in our schema —
// only a real price (project.input.price / competitor.price). Backed out from that real price
// using the illustrative DISCOUNT above, so both the buybox and competitor cards show Amazon's
// actual price/MRP/discount layout instead of a bare number.
function deriveMrp(price) {
  const discountRate = parseFloat(DISCOUNT) / 100;
  return Math.round(price / (1 - discountRate));
}

function competitorArrowStyle(side) {
  return {
    position: 'absolute',
    [side]: -14,
    top: '38%',
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #d5d9d9',
    background: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f1111',
  };
}

/** Previews the generated listing exactly as it will render on an actual Amazon product
 *  page — ported from the "Amazon Preview" tab of the Speedy Listing design
 *  (claude.ai/design/p/21337641-44ad-48ef-ba30-2e8d3751c644, Listing Studio.dc.html).
 *  Toggled in from ListingPage's "Amazon Preview" button; draft/dirty/saving state and the
 *  edit handlers live in ListingPage so edits made here stay in sync with the form editor.
 *  Kept as inline styles (not the shared Tailwind tokens the rest of Speedy Listing uses)
 *  since this is a pixel copy of Amazon's own site chrome, not part of our design system —
 *  same reasoning AplusPage already applies to its one-off overlay-image styles.
 *
 *  Takes over the entire browser window — the same pattern SpeedyAgentPage uses from the
 *  main sidebar (a `fixed inset-0` layer that covers the whole viewport, not just this
 *  route's content pane), rather than staying confined under ProjectLayout's TopNav. Since
 *  it now visually covers that nav, a floating back button substitutes for it. */
export function AmazonPreviewPanel({
  project, draft, dirty, saving, setField, setBullet, onSave, onBack, onReorderImages,
  // Public share page: no editing, no back/save, and the Premium A+ designs arrive already
  // embedded in the payload (its API is login-only) instead of being fetched here.
  readOnly = false,
  premiumDesignsOverride,
  // Editor-only extra: a "Share" popover.
  showShare = false,
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const competitorsScrollRef = useRef(null);

  const scrollCompetitors = (dir) => {
    competitorsScrollRef.current?.scrollBy({ left: dir * 840, behavior: 'smooth' });
  };
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  // Premium A+ designs live in their own collection (server/listingStudio/models/PremiumAplusDesign.js),
  // never joined onto the project doc the way Standard A+ concepts are — so they're fetched here.
  const [premiumDesigns, setPremiumDesigns] = useState([]);
  useEffect(() => {
    if (premiumDesignsOverride || !project?.id) return undefined;
    let cancelled = false;
    premiumAplusApi
      .listDesigns(project.id)
      .then((designs) => {
        if (!cancelled) setPremiumDesigns(designs ?? []);
      })
      .catch(() => {
        if (!cancelled) setPremiumDesigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id, premiumDesignsOverride]);

  const images = project.generatedImages?.length
    ? sortedGeneratedImages(project).map((img) => img.path)
    : project.images ?? [];
  const activeImage = images[activeIdx] ?? images[0] ?? null;

  // Only offered when the caller can persist a new order (the listing wizard's image sequence).
  const canReorder = typeof onReorderImages === 'function' && images.length > 1;
  const endDrag = () => {
    setDragIdx(null);
    setOverIdx(null);
  };
  const dropOn = (to) => {
    if (dragIdx !== null && dragIdx !== to) {
      onReorderImages(dragIdx, to);
      // Keep the same image selected after it moves.
      setActiveIdx(to);
    }
    endDrag();
  };

  // Inputs only when the viewer can actually edit; a read-only viewer gets the same layout as plain text.
  const editable = !readOnly && Boolean(draft);
  const title = draft?.title ?? project.input?.name ?? '';
  const bullets = draft?.bullets ?? [];
  // Real price, in priority order — most recent/deliberate entry wins:
  // (1) The wizard's Offer (IN) price: project.input.price/mrp when the wizard (CreateAmazonListingModal)
  //     has overridden them with its own live, unsaved fields (yourPriceSOA/maximumRetailPriceSOA), or
  //     project.amazonListingDraft.fillValues.offerIN once the wizard has actually saved a draft — this
  //     is what makes a wizard edit show up on ListingPage's own preview too, since that page just
  //     passes the real `project` doc with no wizard state of its own.
  // (2) project.input.price alone — the campaign's original price. Either a plain number (manual
  //     campaigns' "Planned price") or a "<CURRENCY> <amount>" string like "USD 24.99" (ASIN-imported
  //     campaigns — see createFromAsin() in projectsService.js, seeded straight from the scraped
  //     listing), so it's parsed rather than just Number()'d.
  // (3) FALLBACK_PRICE, only when nothing above was ever filled in (e.g. a manual campaign that left
  //     "Planned price" blank and hasn't reached the wizard's Offer (IN) step yet).
  const savedOffer = project.amazonListingDraft?.fillValues?.offerIN;
  const parsePrice = (value) => {
    if (typeof value === 'number') return value;
    const match = typeof value === 'string' ? value.match(/[\d.]+/) : null;
    return match ? parseFloat(match[0]) : NaN;
  };
  const firstRealPrice = (...values) => values.map(parsePrice).find((n) => Number.isFinite(n) && n > 0);
  const price = firstRealPrice(savedOffer?.yourPriceSOA, project.input?.price) ?? FALLBACK_PRICE;
  const realMrp = firstRealPrice(savedOffer?.maximumRetailPriceSOA, project.input?.mrp);
  const hasRealMrp = realMrp !== undefined && realMrp > price;
  const mrp = hasRealMrp ? realMrp : deriveMrp(price);
  const discountDisplay = hasRealMrp ? `${Math.round((1 - price / mrp) * 100)}%` : DISCOUNT;
  const priceDisplay = Math.trunc(price).toLocaleString('en-IN');
  const mrpDisplay = Math.trunc(mrp).toLocaleString('en-IN');
  const descriptionParagraphs = (project.listing?.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Premium A+ wins over Standard A+ when the seller has generated both — same tier ordering
  // the marketplace itself imposes (a Premium A+ enrollment replaces Standard A+ on the live
  // listing, it doesn't stack alongside it), so the preview shows exactly what buyers would see.
  const premiumBanners = (premiumDesignsOverride ?? premiumDesigns).filter((d) => d.compositePath).map((d) => ({ path: d.compositePath }));
  const standardBanners = (project.aplus?.concepts ?? []).map(overlayImage).filter((slot) => slot?.path);
  const banners = premiumBanners.length > 0 ? premiumBanners : standardBanners;
  // Only competitors the research pipeline actually scraped image+title for — see
  // server/listingStudio/providers/brightdata.js productDetails(). No MRP/discount/delivery
  // date exist on this shape (same gap deriveMrp() above covers for the seller's own listing),
  // so those are simply omitted here rather than fabricated per-competitor.
  const competitors = (project.competitors ?? []).filter((c) => c?.title && (c.images?.[0] || c.imageUrl));

  const brand = project.input?.brand ?? '';
  const category = project.input?.category ?? '';

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-white">
      {!readOnly && onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to editor"
          className="fixed top-4 left-4 z-[70] w-9 h-9 rounded-full bg-white shadow-lg grid place-items-center text-slate-700 transition-colors hover:text-brand-600"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      {!readOnly && (
        <div className="fixed top-4 right-4 z-[70] flex items-start gap-2">
          {showShare && project?.id && <SharePreviewButton projectId={project.id} />}
          {draft && (
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-full bg-white shadow-lg text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-50 disabled:cursor-default"
            >
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          )}
        </div>
      )}
      <div style={{ background: '#fff', paddingBottom: 40, fontFamily: 'Arial, Helvetica, sans-serif', minWidth: 1200 }}>
        {/* Amazon's site chrome (search bar, account, cart, category nav) — hidden on the public share page. */}
        {!readOnly && (
          <>
          <div style={{ background: '#131921', display: 'flex', alignItems: 'center', gap: 14, padding: '8px 14px', color: '#fff' }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              amazon<span style={{ fontSize: 14, fontWeight: 400 }}>.in</span>
            </span>
            <div style={{ fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              <div style={{ color: '#ccc' }}>📍 Delivering to {DELIVERY_LOCATION}</div>
              <strong>Update location</strong>
            </div>
            <div style={{ flex: 1, display: 'flex', maxWidth: 820, borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ background: '#f3f3f3', color: '#0f1111', fontSize: 13, padding: '0 10px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                {category || 'All'} ▾
              </span>
              <span style={{ flex: 1, background: '#fff', color: '#767676', fontSize: 14, padding: '9px 10px' }}>Search Amazon.in</span>
              <span style={{ background: '#febd69', width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔍</span>
            </div>
            <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>🇮🇳 EN ▾</span>
            <div style={{ fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              <div style={{ color: '#ccc' }}>Hello, sign in</div>
              <strong>Account &amp; Lists ▾</strong>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              <div style={{ color: '#ccc' }}>Returns</div>
              <strong>&amp; Orders</strong>
            </div>
            <div style={{ position: 'relative', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span
                style={{
                  position: 'absolute',
                  top: -8,
                  left: 2,
                  background: '#f90',
                  color: '#0f1111',
                  borderRadius: 999,
                  width: 16,
                  height: 16,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                1
              </span>
              🛒 Cart
            </div>
          </div>

          <div style={{ background: '#232f3e', color: '#fff', fontSize: 13, padding: '7px 14px', display: 'flex', gap: 18, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span>☰ All</span>
            <span>Fresh</span>
            <span>Prime Video</span>
            <span>Sell</span>
            <span>Bestsellers</span>
            <span>Today&apos;s Deals</span>
            <span>Mobiles</span>
            <span>Customer Service</span>
            <span>New Releases</span>
            <span>Prime ▾</span>
            <span>Amazon Pay</span>
            <span>Electronics</span>
            <span>Home &amp; Kitchen</span>
            <span>Fashion</span>
            <span>Gift Cards</span>
          </div>
          </>
        )}

        {category && (
          <div style={{ padding: '12px 18px 0', fontSize: 13, color: '#565959' }}>{category}</div>
        )}

        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'minmax(0,42%) minmax(0,58%)', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0, gridColumn: 1, position: 'sticky', top: 12 }}>
            <div style={{ position: 'relative', border: '1px solid #f0f0f0' }}>
              <div
                style={{
                  aspectRatio: '1',
                  backgroundImage: activeImage ? `url(${activeImage})` : undefined,
                  backgroundColor: '#fff',
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <span style={{ position: 'absolute', top: 10, right: 10, color: '#565959' }}>⤴</span>
            </div>
            <div style={{ textAlign: 'center', margin: '10px 0', fontSize: 13 }}>
              <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                Click to see full view
              </a>
            </div>
            {canReorder && (
              <div style={{ fontSize: 12, color: '#565959', marginBottom: 6 }}>
                Drag images to reorder — the first image is the Main Image.
              </div>
            )}
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                {images.map((src, i) => (
                  <div
                    key={src + i}
                    onClick={() => setActiveIdx(i)}
                    draggable={canReorder}
                    onDragStart={canReorder ? (e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDragIdx(i);
                    } : undefined}
                    onDragOver={canReorder ? (e) => {
                      e.preventDefault();
                      if (overIdx !== i) setOverIdx(i);
                    } : undefined}
                    onDrop={canReorder ? (e) => {
                      e.preventDefault();
                      dropOn(i);
                    } : undefined}
                    onDragEnd={canReorder ? endDrag : undefined}
                    style={{
                      opacity: dragIdx === i ? 0.4 : 1,
                      outline: canReorder && overIdx === i && dragIdx !== null && dragIdx !== i ? '2px dashed #007185' : 'none',
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      borderRadius: 4,
                      border: i === activeIdx ? '2px solid #e77600' : '1px solid #ddd',
                      backgroundImage: `url(${src})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      cursor: canReorder ? 'grab' : 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ minWidth: 0, gridColumn: 2 }}>
            {brand && (
              <a href="#" style={{ color: '#007185', fontSize: 13, textDecoration: 'none' }}>
                Visit the {brand} Store
              </a>
            )}
            {editable ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setField('title', e.target.value)}
                style={{ ...EDITABLE_FIELD_STYLE, fontSize: 22, fontWeight: 600, lineHeight: 1.35, margin: '6px 0 8px' }}
              />
            ) : (
              <h1 style={{ fontSize: 22, fontWeight: 600, color: '#0f1111', margin: '6px 0 8px', lineHeight: 1.35 }}>{title}</h1>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: '#0f1111' }}>{RATING}</span>
              <span style={{ color: '#ffa41c', letterSpacing: '1px' }}>★★★★☆</span>
              <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                ({REVIEW_COUNT})
              </a>
            </div>
            <span
              style={{
                display: 'inline-block',
                background: '#0f1111',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 2,
                marginBottom: 10,
              }}
            >
              Amazon&apos;s Choice
            </span>
            <div style={{ fontSize: 13, color: '#0f1111', marginBottom: 10 }}>300+ bought in past month</div>
            <div style={{ borderTop: '1px solid #e7e7e7', marginBottom: 12 }} />
            <span
              style={{
                display: 'inline-block',
                background: '#cc0c39',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              Limited time deal
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: '#0f1111' }}>
              <span style={{ fontSize: 19, color: '#cc0c39', fontWeight: 600 }}>-{discountDisplay}</span>
              <span style={{ fontSize: 15, position: 'relative', top: -8 }}>₹</span>
              <span style={{ fontSize: 28 }}>{priceDisplay}</span>
            </div>
            <div style={{ fontSize: 13, color: '#565959', marginTop: 2 }}>
              M.R.P.: <span style={{ textDecoration: 'line-through' }}>₹{mrpDisplay}</span>
            </div>
            <div style={{ fontSize: 13, color: '#0f1111', margin: '4px 0 12px' }}>Inclusive of all taxes</div>

            <div style={{ border: '1px solid #d5d9d9', borderRadius: 8, padding: 16, maxWidth: 340, marginBottom: 16 }}>
              <div style={{ fontSize: 22, color: '#0f1111' }}>
                ₹{priceDisplay}
                <sup style={{ fontSize: 12 }}>00</sup>
              </div>
              <div style={{ fontSize: 13, color: '#0f1111', margin: '8px 0 4px' }}>
                FREE delivery <strong>{DELIVERY_DATE}</strong>.{' '}
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  Details
                </a>
              </div>
              <div style={{ fontSize: 13, color: '#0f1111', marginBottom: 10 }}>
                Or fastest delivery <strong>{FAST_DELIVERY_DATE}</strong>. Order within 9 hrs 16 mins.{' '}
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  Details
                </a>
              </div>
              <div style={{ fontSize: 13, color: '#0f1111', marginBottom: 10 }}>
                📍{' '}
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  Delivering to {DELIVERY_LOCATION} - Update location
                </a>
              </div>
              <div style={{ fontSize: 15, color: '#007600', fontWeight: 600, marginBottom: 10 }}>In stock</div>
              <select style={{ width: '100%', padding: 6, borderRadius: 8, border: '1px solid #d5d9d9', background: '#f0f2f2', fontSize: 13, marginBottom: 12 }}>
                <option>Quantity: 1</option>
              </select>
              <button
                type="button"
                style={{ width: '100%', background: '#ffd814', border: '1px solid #fcd200', borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 8, cursor: 'default' }}
              >
                Add to cart
              </button>
              <button
                type="button"
                style={{ width: '100%', background: '#ffa41c', border: '1px solid #ff8f00', borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 14, cursor: 'default' }}
              >
                Buy Now
              </button>
              <div style={{ fontSize: 13, color: '#565959', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', borderTop: '1px solid #e7e7e7', paddingTop: 12 }}>
                <span>Ships from</span>
                <strong style={{ color: '#0f1111' }}>Amazon</strong>
                <span>Sold by</span>
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  {brand || 'Seller'}
                </a>
                <span>Payment</span>
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  Secure transaction
                </a>
                <span>Gift options</span>
                <a href="#" style={{ color: '#007185', textDecoration: 'none' }}>
                  Available at checkout
                </a>
              </div>
              <div style={{ borderTop: '1px solid #e7e7e7', marginTop: 14, paddingTop: 14, fontSize: 13, color: '#0f1111' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'default' }}>
                  <input type="checkbox" style={{ marginTop: 3 }} readOnly />
                  <span>
                    1 year Fire Protection for Home by OneAssist for <strong style={{ color: '#cc0c39' }}>₹99.00</strong>
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#0f1111', marginBottom: 10 }}>
              <span style={{ border: '1px solid #999', borderRadius: 999, width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                %
              </span>{' '}
              Offers
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 16 }}>
              <div style={{ border: '1px solid #e7e7e7', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1111', marginBottom: 4 }}>Cashback</div>
                <div style={{ fontSize: '12.5px', color: '#0f1111', marginBottom: 6 }}>Upto ₹25.00 cashback as Amazon Pay Balance when...</div>
                <a href="#" style={{ fontSize: '12.5px', color: '#007185', textDecoration: 'none' }}>
                  1 offer ›
                </a>
              </div>
              <div style={{ border: '1px solid #e7e7e7', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1111', marginBottom: 4 }}>Bank Offer</div>
                <div style={{ fontSize: '12.5px', color: '#0f1111', marginBottom: 6 }}>Upto ₹2,500.00 discount on select Credit Cards</div>
                <a href="#" style={{ fontSize: '12.5px', color: '#007185', textDecoration: 'none' }}>
                  37 offers ›
                </a>
              </div>
              <div style={{ border: '1px solid #e7e7e7', borderRadius: 6, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1111', marginBottom: 4 }}>Partner Offers</div>
                <div style={{ fontSize: '12.5px', color: '#0f1111', marginBottom: 6 }}>Get GST invoice, save up to 18% on business purchases</div>
                <a href="#" style={{ fontSize: '12.5px', color: '#007185', textDecoration: 'none' }}>
                  1 offer ›
                </a>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111', marginBottom: 6 }}>Dimensions</div>
            <a href="#" style={{ fontSize: 13, color: '#007185', textDecoration: 'none', display: 'block', marginBottom: 14 }}>
              ▾ See more
            </a>
            <div style={{ borderTop: '1px solid #e7e7e7', marginBottom: 16 }} />

            {bullets.length > 0 && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#0f1111', margin: '0 0 10px' }}>About this item</p>
                <ul style={{ margin: '0 0 14px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {bullets.map((b, i) => (
                    <li key={i} style={{ fontSize: 14, color: '#0f1111', lineHeight: 1.6 }}>
                      {editable ? (
                        <textarea
                          value={b}
                          onChange={(e) => setBullet(i, e.target.value)}
                          rows={2}
                          style={{ ...EDITABLE_FIELD_STYLE, fontSize: 14, lineHeight: 1.6, resize: 'vertical' }}
                        />
                      ) : (
                        b
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <a href="#" style={{ fontSize: 13, color: '#c45500', textDecoration: 'none', fontWeight: 600 }}>
              › See more product details
            </a>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #d5e3d5', background: '#f0f7f0', borderRadius: 6, padding: 14, margin: '18px 0' }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, background: '#007600', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                ✓
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1111', marginBottom: 4 }}>Customers usually keep this item</div>
                <div style={{ fontSize: 13, color: '#0f1111', lineHeight: 1.5 }}>This product has fewer returns than average compared to similar products.</div>
              </div>
            </div>
            <a href="#" style={{ fontSize: 13, color: '#007185', textDecoration: 'none', display: 'block', marginBottom: 14 }}>
              ⚑ Report an issue with this product
            </a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #e7e7e7', paddingTop: 14, fontSize: 13, color: '#0f1111' }}>
              <strong style={{ fontSize: 14 }}>
                amazon<span style={{ color: '#007185' }}>business</span>
              </strong>
              <span>Are you a business? Get GST invoice and bulk discounts.</span>
            </div>
          </div>
        </div>

        {(draft || descriptionParagraphs.length > 0 || competitors.length > 0 || banners.length > 0) && (
          <div style={{ padding: '20px 18px 0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f1111', margin: '0 0 14px', borderBottom: '1px solid #e7e7e7', paddingBottom: 10 }}>
              Product description
            </h2>
            {editable ? (
              <textarea
                value={draft.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={8}
                style={{ ...EDITABLE_FIELD_STYLE, fontSize: 14, lineHeight: 1.7, marginBottom: 24, resize: 'vertical' }}
              />
            ) : (
              descriptionParagraphs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginBottom: 24 }}>
                  {descriptionParagraphs.map((para, i) => (
                    <p key={i} style={{ fontSize: 14, color: '#0f1111', lineHeight: 1.7, margin: 0 }}>
                      {para}
                    </p>
                  ))}
                </div>
              )
            )}
            {competitors.length > 0 && (
              <div style={{ marginBottom: banners.length > 0 ? 24 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e7e7e7', paddingBottom: 10, marginBottom: 16 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f1111', margin: 0 }}>
                    Relevant items customers are likely to buy
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ color: '#565959', fontSize: 13 }}>Page 1 of {Math.max(1, Math.ceil(competitors.length / 7))}</span>
                    <span style={{ color: '#565959', fontSize: 18, cursor: 'default' }}>⋮</span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <button type="button" onClick={() => scrollCompetitors(-1)} aria-label="Scroll left" style={competitorArrowStyle('left')}>
                    ‹
                  </button>
                  <div ref={competitorsScrollRef} style={{ display: 'flex', overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: 8 }}>
                    {competitors.map((c, i) => (
                      <a
                        key={c.asin ?? c.url}
                        href={amazonUrl(c.asin, project.marketplace)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flexShrink: 0,
                          width: 280,
                          padding: '0 20px',
                          borderRight: i < competitors.length - 1 ? '1px solid #e7e7e7' : 'none',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div
                          style={{
                            aspectRatio: '1',
                            backgroundImage: `url(${c.images?.[0] ?? c.imageUrl})`,
                            backgroundColor: '#fff',
                            backgroundSize: 'contain',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            marginBottom: 10,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 15,
                            color: '#007185',
                            lineHeight: 1.4,
                            marginBottom: 8,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {c.title}
                        </div>
                        {(c.rating || c.reviewsCount) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, marginBottom: 6 }}>
                            {c.rating && <span style={{ color: '#ffa41c', letterSpacing: '1px' }}>{renderStars(c.rating)}</span>}
                            {c.reviewsCount && <span style={{ color: '#565959' }}>{c.reviewsCount.toLocaleString('en-IN')}</span>}
                          </div>
                        )}
                        {c.price != null && (
                          <>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 15, color: '#cc0c39', fontWeight: 600 }}>-{DISCOUNT}</span>
                              <span style={{ fontSize: 23, color: '#0f1111' }}>
                                <span style={{ fontSize: 15, position: 'relative', top: -9 }}>₹</span>
                                {Math.trunc(c.price).toLocaleString('en-IN')}
                                <sup style={{ fontSize: 13 }}>00</sup>
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#565959', marginBottom: 5 }}>
                              M.R.P.: <span style={{ textDecoration: 'line-through' }}>₹{deriveMrp(c.price).toLocaleString('en-IN')}</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#0f1111' }}>
                              Get it by <strong>{DELIVERY_DATE}</strong>
                            </div>
                            <div style={{ fontSize: 13, color: '#565959' }}>FREE Delivery by Amazon</div>
                          </>
                        )}
                      </a>
                    ))}
                  </div>
                  <button type="button" onClick={() => scrollCompetitors(1)} aria-label="Scroll right" style={competitorArrowStyle('right')}>
                    ›
                  </button>
                </div>
              </div>
            )}
            {banners.length > 0 && (
              <>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f1111', margin: '0 0 10px', borderTop: '1px solid #e7e7e7', paddingTop: 16 }}>
                From the manufacturer
              </h2>
              {/* Amazon renders A+ modules centred at a fixed 970px max width rather than
                  edge-to-edge, so the banner never dominates a wide viewport. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 'min(970px, 75%)', margin: '0 auto 24px' }}>
                {banners.map((slot) => (
                  // Rendered at its natural size instead of a forced-aspect-ratio background-cover
                  // box — Standard A+ overlays (970x600) and Premium A+ composites (1472x1472,
                  // see PremiumAplusDesign.js) have different real dimensions, and a guessed box
                  // crops whichever one doesn't match, so the whole banner always shows this way.
                  <img
                    key={slot.path}
                    src={slot.path}
                    alt=""
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #e7e7e7' }}
                  />
                ))}
              </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

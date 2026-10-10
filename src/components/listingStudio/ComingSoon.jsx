import React from 'react';
import { PAGE_TITLE, MUTED, CARD } from './ui/classNames';

/** Placeholder for a Listing Studio route not yet ported in this slice — keeps the
 *  route tree structurally complete (per the migration plan's Phase 2 slice order)
 *  without pretending the page is finished. */
export default function ComingSoon({ title }) {
  return (
    <div>
      <h1 className={PAGE_TITLE}>{title}</h1>
      <div className={CARD}>
        <p className={MUTED}>This part of Listing Studio is being migrated and will be available in a later update.</p>
      </div>
    </div>
  );
}

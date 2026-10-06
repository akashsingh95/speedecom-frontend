/**
 * Single source of truth for "should View Report / Open Report calculate first,
 * and with which mode" — used by both CalculationsTab.jsx and PaymentsTab.jsx so
 * the two entry points can never disagree on the decision.
 *
 * requiresRecalculation (the admin / Amazon-refund-loss flag) always wins and
 * always forces mode: 'full' — this preserves the existing Recalculate flow
 * exactly. calculationPending (cost sheet saved but no calculation has run
 * since) only ever requests a plain calculate, never 'full', so it can never
 * be mistaken for — or trigger — the Recalculate flow. Credit gating
 * (insufficient balance, or credits/uploads still processing) blocks either
 * path the same way the Calculate button itself already does.
 */
export function decideCalculationBeforeReport({ requiresRecalculation, calculationPending, isCreditBalanceLow, isCreditCalculating }) {
    if (isCreditBalanceLow || isCreditCalculating) {
        return { shouldCalculate: false, mode: undefined };
    }
    if (requiresRecalculation) {
        return { shouldCalculate: true, mode: 'full' };
    }
    if (calculationPending) {
        return { shouldCalculate: true, mode: undefined };
    }
    return { shouldCalculate: false, mode: undefined };
}

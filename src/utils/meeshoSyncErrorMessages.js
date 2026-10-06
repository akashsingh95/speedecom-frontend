// UI-only translation of raw Meesho auto-sync error strings into messages a seller can
// act on. Doesn't change what's stored/logged server-side — only what's displayed.

const PATTERNS = [
    {
        test: /File not ready after|never produced a file/i,
        message: 'Meesho hasn\'t generated this file yet — this usually means there\'s no data for the selected date range, or Meesho was slow to prepare it. Please try again in a few minutes.',
    },
    {
        test: /Incorrect Meesho password/i,
        message: 'Your Meesho password appears to be incorrect, or the account was temporarily locked after repeated failed attempts. Please update the password in Marketplace Settings.',
    },
    {
        test: /Could not determine complete Meesho supplier details|not mapped to the supplier identifier|missing supplierId|missing supplierIdentifier/i,
        message: 'We couldn\'t verify your Meesho account details right now. Please try again shortly.',
    },
    {
        test: /on a \d+-minute cooldown/i,
        message: 'We\'re still verifying your Meesho account details after a recent issue. Please try again in a few minutes.',
    },
    {
        test: /Akamai|edge-block|anti-bot protection/i,
        message: 'Meesho temporarily blocked this sync attempt for security reasons. This usually clears on its own — please try again shortly.',
    },
    {
        test: /aborted pending request|NO_HOST_CONNECTION|bad gateway|proxy server rejected|before secure TLS connection/i,
        message: 'There was a temporary connection issue while syncing with Meesho. Please try again.',
    },
    {
        test: /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up|network error/i,
        message: 'There was a network issue during the sync. Please try again.',
    },
    {
        test: /No stored credentials|No email on marketplace/i,
        message: 'This Meesho account isn\'t fully configured yet. Please check the account details in Marketplace Settings.',
    },
];

const DEFAULT_MESSAGE = 'There was a problem with the Meesho sync. Please retry.';

export const getFriendlySyncErrorMessage = (rawMessage) => {
    if (!rawMessage) return DEFAULT_MESSAGE;
    const match = PATTERNS.find(({ test }) => test.test(rawMessage));
    return match ? match.message : DEFAULT_MESSAGE;
};

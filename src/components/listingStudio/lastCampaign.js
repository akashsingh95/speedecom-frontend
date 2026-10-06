// Per-tab-session flag: has this user started a campaign since logging in? Decides where
// re-entering Listing Studio lands (Campaigns history if so, campaign creation otherwise).
// Cleared on logout (AuthContext) so a new login starts at campaign creation again.
const KEY = 'ls:startedCampaign';

export const markCampaignStarted = () => {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
};

export const hasStartedCampaign = () => {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
};

export const clearCampaignStarted = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

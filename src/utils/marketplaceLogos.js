const base = import.meta.env.BASE_URL;

export const MARKETPLACE_LOGOS = {
  "Flipkart Ads": `${base}assets/flipkart_ads.jpeg`,
  Amazon: `${base}assets/amazon.svg`,
  Flipkart: `${base}assets/flipkart.svg`,
  Myntra: `${base}assets/myntra.png`,
  Meesho: `${base}assets/meesho.png`,
  JioMart: `${base}assets/JioMart.png`,
  Ajio: `${base}assets/ajio.png`,
  Tata: `${base}assets/Tata_Cliq.png`,
  Nykaa: `${base}assets/NykaaLarge.svg`,
  Snapdeal: `${base}assets/snapdeal.png`,
  Cred: `${base}assets/cred.png`,
  FirstCry: `${base}assets/firstcry.svg`,
  Shopify: `${base}assets/shopify.svg`,
  Pepperfry: `${base}assets/pepprfry.png`,
  Easycom: `${base}assets/easycom.png`,
};

/**
 * Get marketplace logo URL by name
 * @param {string} name - Marketplace name (e.g., "Amazon India (Seller)")
 * @returns {string|null} - Logo URL or null if not found
 */
export const getMarketplaceLogo = (name) => {
  if (!name) return null;

  // Direct match
  if (MARKETPLACE_LOGOS[name]) return MARKETPLACE_LOGOS[name];

  // Try to find partial match (longest first)
  const key = Object.keys(MARKETPLACE_LOGOS)
    .sort((a, b) => b.length - a.length)
    .find((k) => name.toLowerCase().includes(k.toLowerCase()));

  return key ? MARKETPLACE_LOGOS[key] : null;
};

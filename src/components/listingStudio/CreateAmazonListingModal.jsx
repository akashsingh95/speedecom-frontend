import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet, Check, Star, Image as ImageIcon, Sparkles, ArrowLeft, Tag, HelpCircle, ChevronRight, X, Camera, Layers, Download, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Copy, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';
import { CARD, BTN, BTN_PRIMARY, BTN_SMALL } from './ui/classNames';
import { listingStudioApi, byteLen } from './api';

const STEPS = ['Category', 'Images', 'Fill Details', 'Draft', 'Done'];
const MAX_IMAGES = 9;

// Amazon Seller Central's per-category listing templates — name + the exact macro-enabled
// workbook filename shown to the user so it's clear which official template a pick maps to.
const CATEGORIES = [
  { name: 'Beauty', file: 'BEAUTY.xlsm' },
  { name: 'Clothing', file: 'CLOTHING.xlsm' },
  { name: 'Jewelry', file: 'JEWELRY.xlsm' },
  { name: 'Kitchen & Home', file: 'KITCHEN.xlsm' },
  { name: 'Office Products', file: 'OFFICE_PRODUCTS.xlsm' },
  { name: 'Professional Healthcare', file: 'PROFESSIONAL_HEALTHCARE.xlsm' },
  { name: 'Personal Care', file: 'PERSONAL_CARE.xlsm' },
  { name: 'Baby Products', file: 'BABY_PRODUCTS.xlsm' },
  { name: 'Car Electronics', file: 'CAR_ELECTRONICS.xlsm' },
  { name: 'Consumer Electronics', file: 'CONSUMER_ELECTRONICS.xlsm' },
  { name: 'Grocery', file: 'GROCERY.xlsm' },
  { name: 'Pet Food', file: 'PET_FOOD.xlsm' },
  { name: 'Shoes', file: 'SHOES.xlsm' },
];

// Step 3's subsection tabs, in the exact order Amazon Seller Central's template groups them.
// Listing Identity/Variations/Shipping are the same regardless of category (see SUBSECTION_FIELDS
// below); Product Identity/Product Details/Offer/Offer (IN)/Safety & Compliance are
// category-specific (see the *_BY_CATEGORY maps below) — each currently only has real fields for
// whichever category its reference screenshots covered (mostly Consumer Electronics or Clothing),
// and renders the generic "not defined yet" placeholder for every other category until given its
// own screenshots too.
const SUBSECTIONS = [
  { key: 'listingIdentity', label: 'Listing Identity' },
  { key: 'variations', label: 'Variations' },
  { key: 'productIdentity', label: 'Product Identity' },
  { key: 'productDetails', label: 'Product Details' },
  { key: 'offer', label: 'Offer' },
  { key: 'offerIN', label: 'Offer (IN) - (Sell on Amazon), (IN) - (Amazon Business (B2B))', shortLabel: 'Offer (IN)' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'safetyCompliance', label: 'Safety & Compliance' },
];

// Recommended Browse Nodes (Cols L-P) repeats the same label/help/option-list 5x in the
// reference template — Consumer Electronics' actual candidate node list, "Category path (node
// id)" per option, exactly as shown in the reference dropdown.
const BROWSE_NODE_HELP =
  'Indicate the browse node or section of the Amazon website where the product will be assigned. This allows customers to find the product on the website easily.';
const BROWSE_NODE_OPTIONS = [
  'Home & Kitchen > Home Improvement > Safety & Security > Household Alarms (8452591031)',
  'Electronics > Accessories > Camera & Photo Accessories > Digital Camera Accessories > Battery Grips (1389051031)',
  'Home & Kitchen > Home Improvement > Safety & Security (4286645031)',
  'Industrial & Scientific > Digital Signage > Commercial TVs & Displays (2062246560031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Home Security Systems (4286664031)',
  'Electronics > Power Accessories (1388973031)',
  'Electronics > Accessories > Camera & Photo Accessories > Digital Camera Accessories (1389049031)',
  'Electronics > eBook Readers & Accessories > Bundles (1389495031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Beacons (8452578031)',
  'Electronics > Warranties (1389493031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Personal Defense Equipment > Batons (10616049031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Personal Defense Equipment (10616047031)',
  'Electronics > Headphones, Earbuds & Accessories > Cleaning Kits (207877566031)',
  'Electronics > Accessories > Camera & Photo Accessories > Digital Camera Accessories > Accessory Kits (1389050031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Household Alarms > Safety Test Kits (10616043031)',
  'Home & Kitchen > Home Improvement > Safety & Security > Lockable Window Levers (10616045031)',
  'Electronics > Power Accessories > Power Distribution Units (206211204031)',
  'Electronics > Accessories > Camera & Photo Accessories > Digital Camera Accessories > Viewfinder Extenders (1389058031)',
  'Industrial & Scientific > Occupational Health & Safety Products > Emergency Response Equipment > Fire Extinguishers (8452585031)',
  'Electronics > Computers & Accessories (1458204031)',
  'Industrial & Scientific > Digital Signage > Digital Kiosks & Billboards (206246559031)',
];
const browseNodeField = (col) => ({
  key: `browseNode${col}`,
  label: 'Recommended Browse Nodes',
  col,
  aiFillable: true,
  type: 'select',
  options: BROWSE_NODE_OPTIONS,
  help: BROWSE_NODE_HELP,
});

// Product Details' 5 Bullet Point columns (AF-AJ) and 3 Packer Contact Information columns
// (BO-BQ) each repeat the same label/help — same reasoning as Recommended Browse Nodes above.
const BULLET_POINT_HELP =
  'Brief descriptive text, called out via a bullet point, regarding a specific aspect of the product. These display directly under or next to your product photo, immediately visible to shoppers.';
const bulletPointField = (col) => ({
  key: `bulletPoint${col}`,
  label: 'Bullet Point',
  col,
  required: true,
  aiFillable: true,
  type: 'textarea',
  placeholder: 'Breathable Leather Lining',
  help: BULLET_POINT_HELP,
});
const PACKER_CONTACT_HELP =
  'Provide the contact information (including address, zipcode) for the packer of the product. The packer is the person who does the primary pre-packaging of the product.';
const packerContactField = (col) => ({
  key: `packerContact${col}`,
  label: 'Packer Contact Information',
  col,
  conditional: true,
  type: 'text',
  placeholder: 'Packer Name Ltd., Street No. 24/4, New Delhi, India - 110011, Contact: +91-22-XXXXXXXX',
  help: PACKER_CONTACT_HELP,
});
const IMPORTER_CONTACT_HELP =
  "Provide the contact information (including address, zipcode) of the importer of the product. The importer is the person who brings the product into a country for sale.";
const importerContactField = (col) => ({
  key: `importerContact${col}`,
  label: 'Importer Contact Information',
  col,
  conditional: true,
  type: 'text',
  placeholder: 'Importer Name Ltd., Street No. 24/4, New Delhi, India - 110011, Contact: +91-22-XXXXXXXX',
  help: IMPORTER_CONTACT_HELP,
});
// Personal Care's real template (see templates/PERSONAL_CARE.xlsm) repeats Generic Keyword,
// Material, and Ingredients 5x each — same "same label/help, only the column changes" shape as
// Bullet Point/Browse Node/Packer/Importer Contact above, so these get the same factory
// treatment rather than 5 hand-typed near-duplicate objects.
const genericKeywordField = (col) => ({
  key: `genericKeyword${col}`,
  label: 'Generic Keyword',
  col,
  aiFillable: true,
  type: 'text',
  placeholder: 'epilator; face trimmer; hair removal; cordless; rechargeable',
  help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.',
});
const materialField = (col) => ({
  key: `material${col}`,
  label: 'Material',
  col,
  aiFillable: true,
  type: 'text',
  placeholder: 'ABS Plastic',
  help: 'Provide a material used in the product.',
});
const ingredientField = (col) => ({
  key: `ingredient${col}`,
  label: 'Ingredients',
  col,
  aiFillable: true,
  type: 'text',
  placeholder: 'Aqua, Glycerin',
  help: 'Provide an ingredient used in the product, in descending order of quantity.',
});

// These two are genuinely enumerable (unlike Style/Color/Size/etc., which are open-ended free
// text in the reference template) — real, standard unit lists, not category-specific ones.
const WARRANTY_DURATION_UNIT_OPTIONS = ['Days', 'Weeks', 'Months', 'Years'];
const WEIGHT_UNIT_OPTIONS = ['Grams', 'Kilograms', 'Milligrams', 'Ounces', 'Pounds'];

// Shipping's 6 "X Unit" fields (Item/Package Length/Width/Height) share both an options list and
// a help-text template — only the dimension name changes.
const LENGTH_UNIT_OPTIONS = ['Millimetres', 'Centimetres', 'Meters', 'Inches', 'Feet'];
const dimensionUnitField = (key, label, col, dimensionLabel) => ({
  key,
  label,
  col,
  conditional: true,
  type: 'select',
  options: LENGTH_UNIT_OPTIONS,
  help: `Select the unit of measure for ${dimensionLabel}. If a value is provided for ${dimensionLabel}, you must also enter the corresponding unit.`,
});

// Safety & Compliance's "Compliance Media Source Location (en_IN, X)" repeats for 25 different
// document types in the reference (X = Application Guide, Patient Fact Sheet, Emergency Use
// Authorization, Repairability Index Calculation Sheet, ...) — almost all of them medical-device
// or electronics-specific and irrelevant to most listings. Kept to the handful genuinely broad
// enough to apply across categories; same shared help-text template either way.
const complianceMediaField = (key, col, docType) => ({
  key,
  label: `Compliance Media Source Location (${docType})`,
  col,
  aiFillable: true,
  type: 'text',
  placeholder: 'N/A',
  help: `Provide the URL where your product document is stored. This must be a direct download link, not a link that opens the PDF in a browser. (en_IN, ${docType})`,
});
const REGULATORY_IDENTIFICATION_HELP = 'Provide the regulatory identification associated with the regulation type.';
const regulatoryIdentificationField = (col) => ({
  key: `regulatoryIdentification${col}`,
  label: 'Regulatory Identification',
  col,
  aiFillable: true,
  type: 'text',
  placeholder: 'N/A',
  help: REGULATORY_IDENTIFICATION_HELP,
});
const complianceRegulationTypeField = (col) => ({
  key: `complianceRegulationType${col}`,
  label: 'Compliance Regulation Type',
  col,
  type: 'text',
  placeholder: '3B Registration Number',
  help: 'Select applicable regulation type',
});

// Each field's `col` mirrors the target .xlsm's actual spreadsheet column letter, shown next to
// the label the same way Amazon's own template does.
const SUBSECTION_FIELDS = {
  listingIdentity: [
    { key: 'sku', label: 'SKU', col: 'A', required: true, type: 'text', placeholder: 'abc123', help: 'This attribute indicates the SKU number as assigned by the contributor' },
    { key: 'productType', label: 'Product Type', col: 'B', required: true, type: 'text', placeholder: 'CONSUMER_ELECTRONICS', help: 'Select the appropriate product type that best suits the item' },
    {
      key: 'listingAction',
      label: 'Listing Action',
      col: 'C',
      type: 'select',
      options: ['Create or Replace (Full Update)', 'Edit (Partial Update)', 'Delete'],
    },
  ],
  variations: [
    {
      key: 'parentageLevel',
      label: 'Parentage Level',
      col: 'D',
      type: 'select',
      options: ['Parent', 'Child'],
      help: 'Specify whether a SKU is a parent or child',
    },
    { key: 'parentSku', label: 'Parent SKU', col: 'E', conditional: true, type: 'text', help: 'The SKU of the parent item' },
    {
      key: 'variationTheme',
      label: 'Variation Theme Name',
      col: 'F',
      conditional: true,
      type: 'select',
      options: ['COLOR', 'ITEM_WEIGHT', 'NUMBER_OF_ITEMS', 'SIZE', 'SIZE/COLOR'],
      help: "Specify the variation theme that the product will use. The theme's attributes must be populated for all items in the grouping.",
    },
  ],
};

// Product Identity's fields (Item Name, Brand, Product Id Type, Recommended Browse Nodes, Model
// Number, Manufacturer, UNSPSC/NSN codes) are genuinely universal — every category needs an item
// name, a brand, a barcode type, etc. Unlike Product Details/Offer/Offer (IN)/Safety & Compliance
// (which really do have different real content per category, and correctly show "not defined
// yet" for a category we have no screenshots for), Product Identity has no legitimate reason to
// ever be empty just because we haven't seen that specific category's own reference screenshot —
// so every category maps to the same field list below. (Recommended Browse Nodes' actual option
// values, BROWSE_NODE_OPTIONS, are still the Consumer Electronics-specific list from the
// reference screenshot — swap in a category's real node list once you have one.)
const UNIVERSAL_PRODUCT_IDENTITY_FIELDS = [
  {
    key: 'itemName',
    label: 'Item Name',
    col: 'G',
    required: true,
    aiFillable: true,
    type: 'text',
    placeholder: 'Sony QuietComfort Noise Cancelling Wireless Headphones',
    help: 'Provide a title for the item that may be customer facing',
  },
  {
    key: 'itemHighlight',
    label: 'Item Highlight',
    col: 'H',
    aiFillable: true,
    type: 'text',
    placeholder: 'Breathable material',
    help: 'Provide product features or benefit driven phrases, not a full sentence. Information will appear only when the item name is under 75 characters. Do not repeat information already in the item name.',
  },
  { key: 'brandName', label: 'Brand Name', col: 'I', required: true, aiFillable: true, type: 'text', placeholder: 'Sony', help: 'Provide the brand name of the product' },
  {
    key: 'productIdType',
    label: 'Product Id Type',
    col: 'J',
    required: true,
    type: 'select',
    options: ['EAN', 'GTIN', 'UPC', 'ASIN', 'GTIN Exempt'],
    help: 'Select the type of external ID (barcode) type or ASIN that is being used to identify this product. If the product is exempt from external ID, select GTIN Exempt',
  },
  {
    key: 'productId',
    label: 'Product Id',
    col: 'K',
    conditional: true,
    type: 'text',
    placeholder: '840414602304',
    help: 'Provide the corresponding product id value based on the type that was selected',
  },
  browseNodeField('L'),
  browseNodeField('M'),
  browseNodeField('N'),
  browseNodeField('O'),
  browseNodeField('P'),
  { key: 'modelNumber', label: 'Model Number', col: 'Q', aiFillable: true, type: 'text', placeholder: '53-100744', help: "Provide the manufacturer's model number for the item" },
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    col: 'R',
    conditional: true,
    aiFillable: true,
    type: 'text',
    placeholder: 'Amazon',
    help: 'Provide the company that manufactures the product.',
  },
  {
    key: 'unspscCode',
    label: 'UNSPSC Code',
    col: 'S',
    aiFillable: true,
    type: 'text',
    placeholder: '27876546',
    help: 'The UN specified purchasing/taxonomy code corresponding to the item',
  },
  {
    key: 'nationalStockNumber',
    label: 'National Stock Number',
    col: 'T',
    aiFillable: true,
    type: 'text',
    placeholder: '850519-S01, 783360-S01',
    help: "Provide the product's NSN identifier",
  },
];
const PRODUCT_IDENTITY_BY_CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.file, UNIVERSAL_PRODUCT_IDENTITY_FIELDS]));

// Offer is genuinely universal, unlike Product Details/Safety & Compliance below — these are
// fulfillment/pricing attributes about the seller's specific inventory and business terms, not
// facts about the product itself, so Amazon's real flat-file schema uses the same Offer columns
// regardless of category. Built from Clothing reference screenshots (so Clothing is the one
// category these columns are verified against); every other category reuses the identical field
// list rather than a fabricated category-specific variant — inventing fake per-category
// differences here would be worse than a verified shared default.
//
// Deliberately NOT a 1:1 copy of the reference template's 26 columns (Cols BV-CU): 6 "Image
// Location" columns (CD-CI) are dropped since they just duplicate the image URLs step 2
// already manages — re-asking for them as separate text fields would confuse, not help. 11
// more (Accessories, Battery Life Percentage, Cosmetic, 4x identical "Features", Functional
// Condition, Packaging, Renewed Grade, Source Type — Cols CJ-CU) are dropped too: every one of
// them is explicitly scoped in its own help text to "the non-new product," i.e. they only ever
// apply to a used/renewed listing — including 15 fields most sellers (selling new items) would
// never touch isn't thoughtful, it's just noise. Only the 5 fields the reference itself marked
// AI Generated are aiFillable here (skipOffer, productTaxCode, merchantReleaseDate,
// offeringCanBeGiftMessaged, isGiftWrapAvailable) — Item Condition/Offer Condition Note/
// Maximum Order Quantity stay seller-only, since those describe this specific seller's actual
// inventory/policy rather than something inferable from the product itself.
const UNIVERSAL_OFFER_FIELDS = [
    {
      key: 'skipOffer',
      label: 'Skip Offer',
      col: 'BV',
      aiFillable: true,
      aiHint: 'Default to "No" — a seller creating a listing almost always wants a buyable offer.',
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Whether to skip creating a buyable offer for this listing. "Yes" means no offer will be created — leave as "No" unless you specifically want a browse-only listing.',
    },
    {
      key: 'itemCondition',
      label: 'Item Condition',
      col: 'BW',
      conditional: true,
      type: 'select',
      options: ['New', 'Renewed', 'Used - Like New', 'Used - Very Good', 'Used - Good', 'Used - Acceptable'],
      help: 'The actual condition of the item being sold.',
    },
    {
      key: 'offerConditionNote',
      label: 'Offer Condition Note',
      col: 'BX',
      conditional: true,
      type: 'textarea',
      placeholder: 'Small dent in left side panel.',
      help: "Only needed when Item Condition isn't New — describe the actual condition in plain language for the buyer.",
    },
    {
      key: 'productTaxCode',
      label: 'Product Tax Code',
      col: 'BY',
      aiFillable: true,
      aiHint: "Pick the standard general tax code appropriate for this product's category (e.g. A_CLTH_GEN for clothing, A_GEN_STANDARD otherwise) unless the brief indicates a special tax treatment.",
      type: 'select',
      options: ['A_GEN_STANDARD', 'A_GEN_TAX', 'A_GEN_NOTAX', 'A_CLTH_GEN'],
      help: 'The product tax code supplied to you by Amazon for this listing.',
    },
    {
      key: 'merchantReleaseDate',
      label: 'Merchant Release Date',
      col: 'BZ',
      aiFillable: true,
      aiHint: "Default to today's date (immediate availability) unless the brief specifies a future launch date.",
      type: 'text',
      placeholder: '2024-05-20',
      help: 'When this offer should first become available for sale (YYYY-MM-DD).',
    },
    {
      key: 'maximumOrderQuantity',
      label: 'Maximum Order Quantity',
      col: 'CA',
      type: 'number',
      placeholder: '3',
      help: 'The maximum number of units a single customer can buy in one order — leave blank for no limit.',
    },
    {
      key: 'offeringCanBeGiftMessaged',
      label: 'Offering Can Be Gift Messaged',
      col: 'CB',
      aiFillable: true,
      aiHint: 'Default to "Yes" unless the product is clearly unsuitable for gifting (e.g. a hazardous, perishable, or bulk industrial item).',
      type: 'select',
      options: ['No', 'Yes'],
      help: "Whether shoppers can add a gift message at checkout. Defaults to 'No' if left blank.",
    },
    {
      key: 'isGiftWrapAvailable',
      label: 'Is Gift Wrap Available',
      col: 'CC',
      aiFillable: true,
      aiHint: 'Default to "Yes" unless the product is clearly unsuitable for gift wrap (e.g. oversized, hazardous, or perishable items).',
      type: 'select',
      options: ['No', 'Yes'],
      help: "Whether gift wrap is offered for this item. Defaults to 'No' if left blank.",
    },
];
/** Positionally remaps a field array onto a new set of column letters — `cols[i]` replaces
 *  `fields[i].col`, everything else about the field object (key/label/type/options/help/
 *  aiFillable/aiHint) stays untouched. Used to build a category's real-column variant of a
 *  UNIVERSAL_*_FIELDS array without hand-retyping every field object, on the condition that
 *  `cols` lists the target template's real column letters in the exact same order the source
 *  array already enumerates its fields — throws instead of silently mis-mapping if the lengths
 *  ever drift apart (e.g. a future edit adds a field to one side but not the other). */
function remapFieldsToColumns(fields, cols) {
  if (fields.length !== cols.length) {
    throw new Error(`remapFieldsToColumns: expected ${fields.length} columns, got ${cols.length}`);
  }
  return fields.map((f, i) => ({ ...f, col: cols[i] }));
}

// Personal Care's real template (see templates/PERSONAL_CARE.xlsm) has the exact same Offer
// field content as UNIVERSAL_OFFER_FIELDS above, in the same order — Amazon just put its Offer
// section 22 columns further right (DH-DO instead of BV-CC) because Personal Care's own, much
// richer, Product Details section (AH-DG) runs longer than Clothing's or Consumer Electronics'.
const PERSONAL_CARE_OFFER_COLS = ['DH', 'DI', 'DJ', 'DK', 'DL', 'DM', 'DN', 'DO'];
const PERSONAL_CARE_OFFER_FIELDS = remapFieldsToColumns(UNIVERSAL_OFFER_FIELDS, PERSONAL_CARE_OFFER_COLS);

// Offer is universal for every category we haven't verified a real template for — Personal Care
// is the one exception now that we have one, and its Offer content is identical to the universal
// default, just at different real column letters (see PERSONAL_CARE_OFFER_FIELDS above).
const OFFER_BY_CATEGORY = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.file, UNIVERSAL_OFFER_FIELDS])),
  'PERSONAL_CARE.xlsm': PERSONAL_CARE_OFFER_FIELDS,
};

// Offer (IN) is universal too, same reasoning as Offer above — pricing/inventory/fulfillment
// terms for the India marketplace aren't a function of product category. Built from Clothing's
// reference template (33 columns, CV-EB), which had two real problems worth fixing rather than
// copying: (1) 4 of its price fields (Cols DA/DD/DE/DK/DM/DN) showed a literal
// "Delete ... (Sell on Amazon)"-style button label as their example VALUE — a data bug in the
// reference tool, not a real placeholder — so those get sensible numeric examples instead; (2)
// its quantity-discount tiers repeat the identical unlabeled "Quantity Threshold"/"Quantity
// Price" pair 5x (Cols DR-EA) — a real, legitimate Amazon B2B feature (unlike Offer's "non-new
// condition" fields), but 5 unlabeled duplicates isn't usable, so this keeps 3 clearly-numbered
// tiers instead of all 5. Only the 3 fields the reference marked AI Generated (pricingRule,
// offeringReleaseDate x2, stopSellingDate x2) are aiFillable — the rest are real
// inventory/pricing decisions.
const UNIVERSAL_OFFER_IN_FIELDS = [
    {
      key: 'fulfillmentChannelCode',
      label: 'Fulfillment Channel Code (IN)',
      col: 'CV',
      conditional: true,
      type: 'select',
      options: ['Fulfillment by Merchant (Default)', 'Amazon Fulfillment Network (FBA)'],
      help: 'For those merchants using Amazon fulfillment services, this designates which fulfillment network will be used. Specifying a value other than DEFAULT will cancel any existing FBA enrollment for this offer.',
    },
    {
      key: 'quantity',
      label: 'Quantity (IN)',
      col: 'CW',
      conditional: true,
      type: 'number',
      placeholder: '152',
      help: 'Enter the quantity of the item you are making available for sale. This is your current inventory commitment (as a whole number)',
    },
    {
      key: 'handlingTime',
      label: 'Handling Time (IN)',
      col: 'CX',
      type: 'number',
      placeholder: '5',
      help: 'Provide the time, in days, between when you receive an order for an item and when you can ship the item',
    },
    {
      key: 'restockDate',
      label: 'Restock Date (IN)',
      col: 'CY',
      type: 'text',
      placeholder: '2026-01-15',
      help: 'Provide the date that product will be restocked using YYYY-MM-DD format',
    },
    {
      key: 'inventoryAlwaysAvailable',
      label: 'Inventory Always Available (IN)',
      col: 'CZ',
      conditional: true,
      type: 'select',
      options: ['Enabled', 'Disabled'],
      help: 'Always available inventory is an alternative to quantity that allows inventory to never deplete. Enabling or disabling will toggle this feature on or off.',
    },
    {
      key: 'yourPriceSOA',
      label: 'Your Price INR (Sell on Amazon, IN)',
      col: 'DA',
      type: 'number',
      placeholder: '899.00',
      help: 'Provide base price of the item at which it is being offered to the intended buyer segment (Sell on Amazon)',
    },
    {
      key: 'maximumRetailPriceSOA',
      label: 'Maximum Retail Price (Sell on Amazon, IN)',
      col: 'DB',
      type: 'number',
      placeholder: '999',
      help: 'Provide the maximum retail price that is physically printed on pre-packaged products, if applicable.',
    },
    {
      key: 'pricingRule',
      label: 'Pricing Rule (Sell on Amazon, IN)',
      col: 'DC',
      aiFillable: true,
      aiHint: 'Default to "No Price Rule" unless the brief specifically mentions automated repricing.',
      type: 'select',
      options: ['No Price Rule', 'Match Lowest Price', 'Automate by Sales Velocity'],
      help: 'The pricing rule that will automate price on this offer (Sell on Amazon)',
    },
    {
      key: 'minimumSellerAllowedPriceSOA',
      label: 'Minimum Seller Allowed Price (Sell on Amazon, IN)',
      col: 'DD',
      type: 'number',
      placeholder: '799',
      help: 'Provide the minimum seller allowed price (Sell on Amazon)',
    },
    {
      key: 'maximumSellerAllowedPriceSOA',
      label: 'Maximum Seller Allowed Price (Sell on Amazon, IN)',
      col: 'DE',
      type: 'number',
      placeholder: '999',
      help: 'Provide the maximum seller allowed price (Sell on Amazon)',
    },
    {
      key: 'salePriceSOA',
      label: 'Sale Price INR (Sell on Amazon, IN)',
      col: 'DF',
      type: 'number',
      placeholder: '219.99',
      help: 'The price at which you offer the product for sale. (Sell on Amazon)',
    },
    {
      key: 'saleStartDateSOA',
      label: 'Sale Start Date (Sell on Amazon, IN)',
      col: 'DG',
      type: 'text',
      placeholder: '2026-06-30',
      help: "The date that the sale price will begin to override the product's standard price (YYYY-MM-DD format); the sale price will be displayed after 0:00AM of Sale Start.",
    },
    {
      key: 'saleEndDateSOA',
      label: 'Sale End Date (Sell on Amazon, IN)',
      col: 'DH',
      type: 'text',
      placeholder: '2026-07-31',
      help: "The last date that the sale price will override the item's standard price (YYYY-MM-DD format); the product's standard price will be displayed after 0:00AM of Sale End.",
    },
    {
      key: 'offeringReleaseDateSOA',
      label: 'Offering Release Date (Sell on Amazon, IN)',
      col: 'DI',
      aiFillable: true,
      aiHint: 'Default to right now (immediate availability) in ISO 8601 format (YYYY-MM-DDT00:00:01Z) unless the brief specifies a future launch date.',
      type: 'text',
      placeholder: '2026-01-15T00:00:01Z',
      help: 'Provide your price start date using YYYY-MM-DD format (Sell on Amazon)',
    },
    {
      key: 'stopSellingDateSOA',
      label: 'Stop Selling Date (Sell on Amazon, IN)',
      col: 'DJ',
      aiFillable: true,
      aiHint: 'Default to a far-future date (e.g. 2030-12-31T23:59:59Z) representing "no planned end date" unless the brief specifies a promotional end date.',
      type: 'text',
      placeholder: '2030-12-31T23:59:59Z',
      help: 'Provide your price end date using YYYY-MM-DD format (Sell on Amazon)',
    },
    {
      key: 'yourPriceB2B',
      label: 'Your Price INR (Amazon Business (B2B), IN)',
      col: 'DK',
      type: 'number',
      placeholder: '849.00',
      help: 'Provide base price of the item at which it is being offered to the intended buyer segment (Amazon Business (B2B))',
    },
    {
      key: 'maximumRetailPriceB2B',
      label: 'Maximum Retail Price (Amazon Business (B2B), IN)',
      col: 'DL',
      type: 'number',
      placeholder: '999',
      help: 'Provide the maximum retail price that is physically printed on pre-packaged products, if applicable.',
    },
    {
      key: 'minimumSellerAllowedPriceB2B',
      label: 'Minimum Seller Allowed Price (Amazon Business (B2B), IN)',
      col: 'DM',
      type: 'number',
      placeholder: '749',
      help: 'Provide the minimum seller allowed price (Amazon Business (B2B))',
    },
    {
      key: 'maximumSellerAllowedPriceB2B',
      label: 'Maximum Seller Allowed Price (Amazon Business (B2B), IN)',
      col: 'DN',
      type: 'number',
      placeholder: '949',
      help: 'Provide the maximum seller allowed price (Amazon Business (B2B))',
    },
    {
      key: 'offeringReleaseDateB2B',
      label: 'Offering Release Date (Amazon Business (B2B), IN)',
      col: 'DO',
      aiFillable: true,
      aiHint: 'Default to right now (immediate availability) in ISO 8601 format (YYYY-MM-DDT00:00:01Z) unless the brief specifies a future launch date.',
      type: 'text',
      placeholder: '2026-01-15T00:00:01Z',
      help: 'Provide your price start date using YYYY-MM-DD format (Amazon Business (B2B))',
    },
    {
      key: 'stopSellingDateB2B',
      label: 'Stop Selling Date (Amazon Business (B2B), IN)',
      col: 'DP',
      aiFillable: true,
      aiHint: 'Default to a far-future date (e.g. 2030-12-31T23:59:59Z) representing "no planned end date" unless the brief specifies a promotional end date.',
      type: 'text',
      placeholder: '2030-12-31T23:59:59Z',
      help: 'Provide your price end date using YYYY-MM-DD format (Amazon Business (B2B))',
    },
    {
      key: 'quantityPriceType',
      label: 'Quantity Price Type (Amazon Business (B2B), IN)',
      col: 'DQ',
      type: 'select',
      options: ['Fixed Price', 'Percentage Discount'],
      help: 'Provide whether the quantity price type is a fixed price set in local currency for each quantity threshold, or a percentage discount off the business price.',
    },
    {
      key: 'quantityThresholdTier1',
      label: 'Quantity Discount Tier 1 — Threshold (Amazon Business (B2B), IN)',
      col: 'DR',
      type: 'number',
      placeholder: '5',
      help: 'The minimum purchase quantity necessary to receive this tier’s discount. Applies to all units once the threshold is met.',
    },
    {
      key: 'quantityPriceTier1',
      label: 'Quantity Discount Tier 1 — Price (Amazon Business (B2B), IN)',
      col: 'DS',
      type: 'number',
      placeholder: '10',
      help: 'The fixed price or discount percentage for this tier (see Quantity Price Type above).',
    },
    {
      key: 'quantityThresholdTier2',
      label: 'Quantity Discount Tier 2 — Threshold (Amazon Business (B2B), IN)',
      col: 'DT',
      type: 'number',
      placeholder: '10',
      help: 'The minimum purchase quantity necessary to receive this tier’s discount. Applies to all units once the threshold is met.',
    },
    {
      key: 'quantityPriceTier2',
      label: 'Quantity Discount Tier 2 — Price (Amazon Business (B2B), IN)',
      col: 'DU',
      type: 'number',
      placeholder: '20',
      help: 'The fixed price or discount percentage for this tier (see Quantity Price Type above).',
    },
    {
      key: 'quantityThresholdTier3',
      label: 'Quantity Discount Tier 3 — Threshold (Amazon Business (B2B), IN)',
      col: 'DV',
      type: 'number',
      placeholder: '20',
      help: 'The minimum purchase quantity necessary to receive this tier’s discount. Applies to all units once the threshold is met.',
    },
    {
      key: 'quantityPriceTier3',
      label: 'Quantity Discount Tier 3 — Price (Amazon Business (B2B), IN)',
      col: 'DW',
      type: 'number',
      placeholder: '30',
      help: 'The fixed price or discount percentage for this tier (see Quantity Price Type above).',
    },
    {
      key: 'shippingTemplateIN',
      label: 'Shipping Template (IN)',
      col: 'EB',
      conditional: true,
      type: 'select',
      options: ['Default Shipping Template', 'Free Shipping', 'Expedited Shipping', 'Custom Template'],
      help: 'Shipping Templates define your shipping regions and fees. Amazon assigns a default template, which you can modify or configure additional templates in your Shipping Settings.',
    },
];
// Personal Care's real template's Offer (IN) section (EH-FN) has the exact same 29 fields as
// UNIVERSAL_OFFER_IN_FIELDS, same order, same "kept to 3 of 5 quantity-discount tiers" curation
// call already made above — just at real column letters further right than Clothing's CV-EB.
const PERSONAL_CARE_OFFER_IN_COLS = [
  'EH', 'EI', 'EJ', 'EK', 'EL', 'EM', 'EN', 'EO', 'EP', 'EQ', 'ER', 'ES', 'ET', 'EU', 'EV',
  'EW', 'EX', 'EY', 'EZ', 'FA', 'FB', 'FC', 'FD', 'FE', 'FF', 'FG', 'FH', 'FI', 'FN',
];
const PERSONAL_CARE_OFFER_IN_FIELDS = remapFieldsToColumns(UNIVERSAL_OFFER_IN_FIELDS, PERSONAL_CARE_OFFER_IN_COLS);

// Same story as OFFER_BY_CATEGORY above — universal default for every category without a
// verified real template, Personal Care's real columns as the one override.
const OFFER_IN_BY_CATEGORY = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.file, UNIVERSAL_OFFER_IN_FIELDS])),
  'PERSONAL_CARE.xlsm': PERSONAL_CARE_OFFER_IN_FIELDS,
};

// Shipping (Cols EC-EP) is a clean 1:1 copy of the reference — unlike Offer/Offer (IN), every
// one of these 14 fields is a distinct, real physical measurement with no duplicates or data
// bugs to fix. Also genuinely category-agnostic (a saree and a speaker both have a
// length/width/height) rather than just under-verified like Offer/Product Identity — used to be
// a single shared array rather than a by-category map for that reason, until Personal Care's
// real template (below) proved the column *positions* still shift per category even though the
// field content itself doesn't. None are aiFillable — actual dimensions/weight are physical
// facts only the seller (with the item in hand) can state accurately; an AI guess here risks
// real shipping-cost and delivery-promise errors.
const UNIVERSAL_SHIPPING_FIELDS = [
    { key: 'itemLength', label: 'Item Length', col: 'EC', conditional: true, type: 'number', placeholder: '5500', help: 'Provide the item length as a numeric value.' },
    dimensionUnitField('itemLengthUnit', 'Item Length Unit', 'ED', 'Item Length'),
    { key: 'itemWidth', label: 'Item Width', col: 'EE', conditional: true, type: 'number', placeholder: '1100', help: 'Provide the item width as a numeric value.' },
    dimensionUnitField('itemWidthUnit', 'Item Width Unit', 'EF', 'Item Width'),
    { key: 'itemHeight', label: 'Item Height', col: 'EG', conditional: true, type: 'number', placeholder: '1000', help: 'Provide the item height as a numeric value.' },
    dimensionUnitField('itemHeightUnit', 'Item Height Unit', 'EH', 'Item Height'),
    {
      key: 'itemPackageLength',
      label: 'Item Package Length',
      col: 'EI',
      conditional: true,
      type: 'number',
      placeholder: '295',
      help: 'Provide the package length as a numeric value.',
    },
    dimensionUnitField('packageLengthUnit', 'Package Length Unit', 'EJ', 'Package Length'),
    {
      key: 'itemPackageWidth',
      label: 'Item Package Width',
      col: 'EK',
      conditional: true,
      type: 'number',
      placeholder: '235',
      help: 'Provide the package width as a numeric value.',
    },
    dimensionUnitField('packageWidthUnit', 'Package Width Unit', 'EL', 'Package Width'),
    {
      key: 'itemPackageHeight',
      label: 'Item Package Height',
      col: 'EM',
      conditional: true,
      type: 'number',
      placeholder: '43',
      help: 'Provide the package height as a numeric value.',
    },
    dimensionUnitField('packageHeightUnit', 'Package Height Unit', 'EN', 'Package Height'),
    {
      key: 'packageWeight',
      label: 'Package Weight',
      col: 'EO',
      conditional: true,
      type: 'number',
      placeholder: '600',
      help: 'This attribute represents the weight of the item plus the packaging. If your item is shipped to the customer in multiple packages, enter the dimensions of the heaviest package.',
    },
    {
      key: 'packageWeightUnit',
      label: 'Package Weight Unit',
      col: 'EP',
      conditional: true,
      type: 'select',
      options: WEIGHT_UNIT_OPTIONS,
      help: 'Select the unit of measure for Package Weight. If a value is provided for Package Weight, you must also enter the corresponding unit.',
    },
  ];

// Personal Care's real template puts the same 14 Shipping fields at FO-GB (further right than
// Clothing's EC-EP, same reason as Offer/Offer (IN) above), and adds 3 real columns
// (GC-GE) neither Clothing nor Consumer Electronics' templates have at all — bulk/pallet
// logistics fields relevant to sellers shipping cartons of grooming devices rather than single
// units. Included since they're genuinely useful and cost nothing to add; like the rest of
// Shipping, none are aiFillable — pallet/carton counts are the seller's own packing facts.
const PERSONAL_CARE_SHIPPING_COLS = ['FO', 'FP', 'FQ', 'FR', 'FS', 'FT', 'FU', 'FV', 'FW', 'FX', 'FY', 'FZ', 'GA', 'GB'];
const PERSONAL_CARE_SHIPPING_FIELDS = [
  ...remapFieldsToColumns(UNIVERSAL_SHIPPING_FIELDS, PERSONAL_CARE_SHIPPING_COLS),
  { key: 'numberOfBoxes', label: 'Number of Boxes', col: 'GC', conditional: true, type: 'number', placeholder: '1', help: 'Provide the number of boxes/cartons this item ships in, if more than one.' },
  {
    key: 'masterPackLayersPerPallet',
    label: 'Master Pack Layers per Pallet Quantity',
    col: 'GD',
    conditional: true,
    type: 'number',
    help: 'Provide the number of master pack layers stacked per pallet, for bulk/FBA pallet shipments.',
  },
  {
    key: 'masterPacksPerLayer',
    label: 'Master Packs Per Layer Quantity',
    col: 'GE',
    conditional: true,
    type: 'number',
    help: 'Provide the number of master packs per pallet layer, for bulk/FBA pallet shipments.',
  },
];

// Was a single shared array until Personal Care's real template proved column position still
// varies per category (see UNIVERSAL_SHIPPING_FIELDS' comment above) — same universal-default-
// plus-verified-override shape as Offer/Offer (IN)/Safety & Compliance below.
const SHIPPING_BY_CATEGORY = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.file, UNIVERSAL_SHIPPING_FIELDS])),
  'PERSONAL_CARE.xlsm': PERSONAL_CARE_SHIPPING_FIELDS,
};

// Safety & Compliance is universal, same reasoning as Offer/Offer (IN)/Product Identity above —
// country of origin, batteries, dangerous-goods regulation, and compliance paperwork aren't a
// function of product category either; nearly every physical product needs the same handful of
// answers here. Built from Clothing's reference template (74 columns, EQ-HD) — the single biggest
// gap between "copy everything" and "thoughtful." Three separate, deliberate cuts:
//
  // 1. Deep lithium-battery chemistry (Cols ET-FF: Battery Cell Composition, Lithium Metal/-ion
  //    Cell counts, Energy Content, Packaging, Lithium Battery Weight, 2 weight-unit selects — 10
  //    fields) is dropped entirely. It's real, but only for products that actually ship
  //    lithium cells requiring IATA/DOT hazmat declarations — a tiny fraction of listings even in
  //    Consumer Electronics, let alone Clothing. Kept instead: a lean 3-field "does this need
  //    batteries at all" trio (required/included/type/count) that covers the common case (a
  //    battery-powered accessory) without forcing every seller through cell-chemistry paperwork.
  // 2. "Dangerous Goods Regulations" and "GHS Class" each repeated 5x identically (Cols FG-FK,
  //    FL-FP) — kept to 2 slots each, same reasoning as Offer (IN)'s quantity-discount tiers.
  //    "Compliance Regulation Type"/"Regulatory Identification" repeated 4x (FU-GB) — kept to 2.
  //    GHS Chemical H Code (Cols HH-HL, industrial chemical-substance hazard coding) is dropped
  //    outright — essentially never applicable outside literal chemical-substance listings.
  // 3. "Compliance Media Source Location (en_IN, X)" repeated for 25 different document types
  //    (Cols GF-HD) — the reference showed the exact same 25-option kitchen sink regardless of
  //    category, and most of them (Patient Fact Sheet, Provider Fact Sheet, 2x Emergency Use
  //    Authorization, Installation Manual, Troubleshooting Guide, Compatibility Guide,
  //    Repairability Index Calculation Sheet, 5x "ECGT - ... Claims" substantiation docs, Data
  //    Act Transparency Declaration, Application Guide) are medical-device or electronics-specific
  //    and irrelevant to almost everything else. Kept to the 6 genuinely cross-category document
  //    types a real seller might actually have on hand: Certificate of Compliance, Safety Data
  //    Sheet, Safety Information, Warranty, User Manual, Specification Sheet.
  //
  // Every field the reference marked AI Generated stays aiFillable here (Buyer Age Restrictions,
  // both Regulatory Identification slots, Responsible Person's Email, all 6 kept Compliance Media
  // Source Location fields, Safety Attestation, Ships Globally) — everything else (country of
  // origin, battery specs, hazmat class, regulation type, manufacturer's email) is a compliance
  // fact only the seller can state accurately.
const UNIVERSAL_SAFETY_COMPLIANCE_FIELDS = [
    {
      key: 'countryOfOrigin',
      label: 'Country of Origin',
      col: 'EQ',
      required: true,
      type: 'select',
      options: ['India', 'China', 'Bangladesh', 'Vietnam', 'Indonesia', 'Pakistan', 'Sri Lanka', 'Turkey', 'Italy', 'United States', 'Other'],
      help: "Select the product's country of origin",
    },
    {
      key: 'batteriesRequired',
      label: 'Are batteries required?',
      col: 'ER',
      conditional: true,
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Select "Yes" if batteries are required to power the item (or if the item is a battery) or "No" if they are not.',
    },
    {
      key: 'batteriesIncluded',
      label: 'Are batteries included?',
      col: 'ES',
      conditional: true,
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Select "Yes" if batteries are contained in or included with the product, "No" if they must be purchased separately.',
    },
    {
      key: 'batteryType',
      label: 'Battery Type',
      col: 'EY',
      conditional: true,
      type: 'select',
      options: ['Not Applicable', 'Alkaline', 'Lithium Metal', 'Lithium Ion', 'Nickel Metal Hydride (NiMH)', 'Other'],
      help: 'Provide the battery type needed to power the item, including spares if included.',
    },
    {
      key: 'numberOfBatteries',
      label: 'Number of Batteries',
      col: 'EX',
      conditional: true,
      type: 'number',
      placeholder: '4',
      help: 'Specify the number of batteries needed to power the item. If batteries are included, account for any spares provided.',
    },
    {
      key: 'dangerousGoodsRegulations1',
      label: 'Dangerous Goods Regulations',
      col: 'FG',
      required: true,
      type: 'select',
      options: ['Not Applicable', 'IATA', 'IMDG', 'ADR', 'US DOT', 'Other'],
      help: 'Provide the regulations that apply to the item if it is classified as a dangerous good, hazardous material, substance, or waste.',
    },
    {
      key: 'dangerousGoodsRegulations2',
      label: 'Dangerous Goods Regulations',
      col: 'FH',
      type: 'select',
      options: ['Not Applicable', 'IATA', 'IMDG', 'ADR', 'US DOT', 'Other'],
      help: 'A second applicable regulation, if any — leave as Not Applicable otherwise.',
    },
    {
      key: 'ghsClass1',
      label: 'GHS Class',
      col: 'FL',
      conditional: true,
      type: 'select',
      options: ['Not Applicable', 'Flammable', 'Corrosive', 'Toxic', 'Irritant', 'Oxidizing', 'Other'],
      help: 'Select the GHS Class of the product from the list of valid values if GHS is selected as the Dangerous Goods Regulation.',
    },
    {
      key: 'ghsClass2',
      label: 'GHS Class',
      col: 'FM',
      conditional: true,
      type: 'select',
      options: ['Not Applicable', 'Flammable', 'Corrosive', 'Toxic', 'Irritant', 'Oxidizing', 'Other'],
      help: 'A second applicable GHS Class, if any — leave as Not Applicable otherwise.',
    },
    {
      key: 'safetyDataSheetUrl',
      label: 'Safety Data Sheet (SDS or MSDS) URL',
      col: 'FS',
      conditional: true,
      type: 'text',
      placeholder: 'https://example.com/hazardous_substance/msds.pdf',
      help: 'Provide the web address for the Safety Data Sheet, containing essential safety information for potentially hazardous materials.',
    },
    {
      key: 'buyerAgeRestrictions',
      label: 'Is This Product Subject To Buyer Age Restrictions',
      col: 'FT',
      aiFillable: true,
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Provide whether the product is subject to buyer age restrictions. These can influence the purchase and/or delivery of the product.',
    },
    complianceRegulationTypeField('FU'),
    regulatoryIdentificationField('FV'),
    complianceRegulationTypeField('FW'),
    regulatoryIdentificationField('FX'),
    {
      key: 'responsiblePersonEmail',
      label: "Responsible Person's Email or Electronic Address",
      col: 'GE',
      aiFillable: true,
      type: 'text',
      placeholder: 'N/A',
      help: "Provide the email or URL of the EU Responsible Person. If you've submitted this information for the brand before, use the same email or URL.",
    },
    complianceMediaField('complianceMediaCertificateOfCompliance', 'GI', 'Certificate of Compliance'),
    complianceMediaField('complianceMediaSafetyDataSheet', 'GX', 'Safety Data Sheet'),
    complianceMediaField('complianceMediaSafetyInformation', 'GY', 'Safety Information'),
    complianceMediaField('complianceMediaWarranty', 'HD', 'Warranty'),
    complianceMediaField('complianceMediaUserManual', 'HC', 'User Manual'),
    complianceMediaField('complianceMediaSpecificationSheet', 'GZ', 'Specification Sheet'),
    {
      key: 'safetyAttestation',
      label: 'Safety Attestation',
      col: 'HE',
      aiFillable: true,
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Check "Yes" if your product doesn\'t have any warning and safety information, as it can be used safely and as intended without it.',
    },
    {
      key: 'shipsGlobally',
      label: 'Ships Globally',
      col: 'HG',
      aiFillable: true,
      type: 'select',
      options: ['No', 'Yes'],
      help: 'Provide whether the item can be shipped globally by Amazon.',
    },
    {
      key: 'manufacturerEmail',
      label: "Manufacturer's Email or Electronic Address",
      col: 'HF',
      type: 'text',
      placeholder: 'contact@manufacturer.com',
      help: "Provide the email or URL of the manufacturer. If you've submitted this information for the brand before, use the same email or URL.",
    },
];

// Personal Care's real template's Safety & Compliance section (GF-JO) is, field-for-field, the
// same 25 kept fields as UNIVERSAL_SAFETY_COMPLIANCE_FIELDS above — same curation call (2 of 5
// Dangerous Goods Regulations/GHS Class slots, 2 of 5 Compliance Regulation Type/Regulatory
// Identification pairs, 6 of 25 Compliance Media document types) — just at real column letters,
// in the exact order UNIVERSAL_SAFETY_COMPLIANCE_FIELDS already lists them, with ONE notable
// twist: the reference's battery pair is "(Number of Batteries, Battery Type)" column order
// (GM=Number of Batteries, GN=Battery Type), the reverse of how batteryType/numberOfBatteries
// happen to be ordered in the array above — so this remap is NOT simply "next column along" for
// those two entries, it's genuinely GN for batteryType and GM for numberOfBatteries.
const PERSONAL_CARE_SAFETY_COMPLIANCE_COLS = [
  'GF', 'GG', 'GH', 'GN', 'GM', 'HD', 'HE', 'HI', 'HJ', 'HS', 'HT', 'HU', 'HV', 'HW', 'HX',
  'IE', 'II', 'IX', 'IY', 'JD', 'JC', 'IZ', 'JE', 'JG', 'JF',
];
const PERSONAL_CARE_SAFETY_COMPLIANCE_FIELDS = remapFieldsToColumns(UNIVERSAL_SAFETY_COMPLIANCE_FIELDS, PERSONAL_CARE_SAFETY_COMPLIANCE_COLS);

// Same universal-default-plus-verified-override shape as OFFER_BY_CATEGORY/OFFER_IN_BY_CATEGORY
// above — every category without a verified real template still gets the universal best-effort
// field list; Personal Care gets its own real, verified columns.
const SAFETY_COMPLIANCE_BY_CATEGORY = {
  ...Object.fromEntries(CATEGORIES.map((c) => [c.file, UNIVERSAL_SAFETY_COMPLIANCE_FIELDS])),
  'PERSONAL_CARE.xlsm': PERSONAL_CARE_SAFETY_COMPLIANCE_FIELDS,
};

// Product Details is the one subsection that's genuinely different per category — unlike
// Product Identity/Offer/Offer (IN)/Safety & Compliance above, a saree's real descriptive
// attributes (fabric, department, care instructions) and a speaker's (item weight, part number)
// don't overlap much, so this stays a true by-category map rather than one shared field list.
// Keyed by the selected category's .xlsm filename; a category with no entry here falls back to
// the generic "not defined yet" placeholder the same way an empty subsection already does.
//
// Consumer Electronics, Clothing, and Personal Care were built from real reference
// screenshots/templates and are verified against an actual Amazon template (see
// templates/CONSUMER_ELECTRONICS.xlsm, CLOTHING.xlsm, and PERSONAL_CARE.xlsm). The other 10
// categories below are best-effort: real, commonly-used Amazon browse-node attributes for that
// category, but NOT verified against an actual downloaded template for that category — column
// letters are a plausible continuation of the AE-onward convention established by the verified
// categories, not confirmed positions. Replace a category's entry here (and add a real
// templates/<FILE>.xlsm) once real reference screenshots/templates exist for it.
const PRODUCT_DETAILS_BY_CATEGORY = {
  // Columns U-AD are the Main/Secondary image URL columns — already covered by step 2's own
  // image picker, not a Fill Details field, hence the jump straight to AE here. Deliberately
  // just these 23 columns — the seller only wants exactly the fields they specified for this
  // subsection, not the rest of the real Amazon template's fuller field set.
  'CONSUMER_ELECTRONICS.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder:
        'This summer, boots by Jette made from high quality suede leather are real gems. They visually highlight the craftsmanship and fine leather braid positioned at the top of the shaft',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product. Include unique product features, benefits, and any other information that helps customers make a purchase decision.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    {
      key: 'genericKeyword',
      label: 'Generic Keyword',
      col: 'AK',
      aiFillable: true,
      type: 'text',
      placeholder: 'Water sport shoes; Derek Rose; Electric; Wi-Fi; Banana',
      help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.',
    },
    {
      key: 'style',
      label: 'Style',
      col: 'AL',
      conditional: true,
      aiFillable: true,
      type: 'text',
      placeholder: 'Art Deco',
      help: 'Provide the style of the product. Style refers to the aesthetic choices of a person or a group of people. It describes the distinctive visual representation of a product line or brand.',
    },
    {
      key: 'numberOfItems',
      label: 'Number of Items',
      col: 'AM',
      conditional: true,
      aiFillable: true,
      type: 'number',
      placeholder: '-1',
      help: 'Provide the total number of identical items in the selling unit to the customer',
    },
    {
      key: 'itemTypeName',
      label: 'Item Type Name',
      col: 'AN',
      conditional: true,
      aiFillable: true,
      type: 'text',
      placeholder: 'Watch',
      help: 'Select from the list or provide a customer-facing one to two-word phrase that describes the type of item the product is.',
    },
    { key: 'color', label: 'Color', col: 'AO', conditional: true, aiFillable: true, type: 'text', placeholder: 'Graphite', help: 'Provide the color of the product' },
    { key: 'size', label: 'Size', col: 'AP', conditional: true, aiFillable: true, type: 'text', placeholder: 'Extra Large', help: 'Provide the size of the item' },
    {
      key: 'partNumber',
      label: 'Part Number',
      col: 'AQ',
      type: 'text',
      placeholder: '53-100744',
      help: 'Provide the part number. For many products, this will be identical to the model number however some manufacturers distinguish part number from model number',
    },
    {
      key: 'manufacturerContact',
      label: 'Manufacturer Contact Information',
      col: 'AR',
      conditional: true,
      type: 'text',
      placeholder: 'Manufacturer Name Ltd., Street No. 24/4, New Delhi, India - 110011, Contact: +91-22-XXXXXXXX',
      help: "Provide the contact information (including address, zipcode) for the product's manufacturer",
    },
    {
      key: 'productGrade',
      label: 'Product Grade',
      col: 'AS',
      conditional: true,
      aiFillable: true,
      type: 'text',
      placeholder: 'Replacement Parts',
      help: 'Provide the grade or condition classification of the product, if applicable (e.g., New, Refurbished, Replacement Parts).',
    },
    {
      key: 'unitCount',
      label: 'Unit Count',
      col: 'AT',
      conditional: true,
      type: 'number',
      placeholder: '72.0',
      help: 'Provide the count of individual units included in this product or package.',
    },
    packerContactField('BO'),
    packerContactField('BP'),
    packerContactField('BQ'),
    {
      key: 'extendedWarrantyDuration',
      label: 'Extended Warranty Duration',
      col: 'BR',
      type: 'number',
      placeholder: '24',
      help: 'Provide the extended warranty duration of the item. This is the period of coverage provided beyond the standard warranty.',
    },
    {
      key: 'extendedWarrantyDurationUnit',
      label: 'Extended Warranty Duration Unit',
      col: 'BS',
      type: 'select',
      options: WARRANTY_DURATION_UNIT_OPTIONS,
      help: 'Provide the corresponding unit used to designate the extended warranty period of the item.',
    },
    {
      key: 'itemWeight',
      label: 'Item Weight',
      col: 'BT',
      conditional: true,
      type: 'number',
      placeholder: '1633',
      help: 'Provide the item weight numeric value (not including the packaging)',
    },
    {
      key: 'itemWeightUnit',
      label: 'Item Weight Unit',
      col: 'BU',
      conditional: true,
      type: 'select',
      options: WEIGHT_UNIT_OPTIONS,
      help: 'Provide unit for item weight',
    },
  ],
  // Columns AE-AJ (Product Description + 5 Bullet Points) match Consumer Electronics exactly —
  // those are universal Amazon flat-file columns. Everything from AK on is Clothing-specific.
  // Columns BJ-BL weren't visible in the reference screenshots (a gap between the 2nd Importer
  // Contact Information and the 1st Packer Contact Information), so they're skipped here.
  'CLOTHING.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder:
        'Crafted with attention to detail, the rich magenta-wine hue provides a striking contrast to the gold metallic work, making it a versatile addition to your ethnic wardrobe.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product. Include unique product features, benefits, and any other information that helps customers make a purchase decision.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    {
      key: 'genericKeywords',
      label: 'Generic Keywords',
      col: 'AK',
      aiFillable: true,
      type: 'text',
      placeholder: 'banarasi saree kanjivaram silk sarees for women party wear wedding traditional',
      help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.',
    },
    {
      key: 'lifestyle',
      label: 'Lifestyle',
      col: 'AL',
      aiFillable: true,
      type: 'select',
      options: ['Athletic', 'Casual', 'Formal', 'Outdoor', 'Evening'],
      help: 'Provide the lifestyle category that the clothing item is designed for, such as athletic, casual, formal, or outdoor activities.',
    },
    {
      key: 'style',
      label: 'Style',
      col: 'AM',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Casual', 'Formal', 'Vintage', 'Contemporary', 'Classic'],
      help: 'Provide the design aesthetic or fashion category that characterizes the clothing item, such as casual, formal, vintage, or contemporary.',
    },
    {
      key: 'departmentName',
      label: 'Department Name',
      col: 'AN',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Womens', 'Mens', 'Girls', 'Boys', 'Baby', 'Unisex'],
      help: 'Provide the department category that the item belongs to.',
    },
    {
      key: 'targetGender',
      label: 'Target Gender',
      col: 'AO',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Female', 'Male', 'Unisex'],
      help: 'Provide the target gender for the product',
    },
    {
      key: 'ageRangeDescription',
      label: 'Age Range Description',
      col: 'AP',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Adult', 'Teen', 'Kids', 'Baby', 'All Ages'],
      help: 'Provide the intended age range for the apparel item, indicating the appropriate user group for the clothing.',
    },
    {
      key: 'fabricType',
      label: 'Fabric Type',
      col: 'AQ',
      required: true,
      aiFillable: true,
      type: 'text',
      placeholder: 'Silk',
      help: "Provide the materials used in the garment's construction, including percentages of each fabric type",
    },
    {
      key: 'numberOfItems',
      label: 'Number of Items',
      col: 'AR',
      conditional: true,
      aiFillable: true,
      type: 'number',
      placeholder: '1',
      help: 'Provide the total number of identical items in the selling unit to the customer',
    },
    {
      key: 'itemTypeName',
      label: 'Item Type Name',
      col: 'AS',
      conditional: true,
      aiFillable: true,
      type: 'text',
      placeholder: 'Saree',
      help: 'Provide the specific category or classification that describes what kind of item it is.',
    },
    {
      key: 'subjectCharacter',
      label: 'Subject Character',
      col: 'AT',
      aiFillable: true,
      type: 'text',
      placeholder: 'Not provided',
      help: 'Provide the fictional or real character featured on the item, such as superheroes, cartoon figures, or celebrities.',
    },
    {
      key: 'specialSize',
      label: 'Special Size',
      col: 'AU',
      conditional: true,
      type: 'select',
      options: ['Petite', 'Plus Size', 'Tall', 'Maternity', 'Big and Tall'],
      help: 'Provide the special size category for the clothing item, indicating non-standard sizing options for specific body types or age groups.',
    },
    {
      key: 'colorMap',
      label: 'Color Map',
      col: 'AV',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink', 'Orange', 'Brown', 'Grey', 'Beige', 'Gold', 'Silver', 'Multicolor'],
      help: 'Provide the most dominant color of the apparel item. This describes the main color that appears on the clothing item.',
    },
    { key: 'color', label: 'Color', col: 'AW', conditional: true, aiFillable: true, type: 'text', placeholder: 'Wine', help: 'Provide the color of the product' },
    { key: 'size', label: 'Size', col: 'AX', conditional: true, aiFillable: true, type: 'text', placeholder: 'Free', help: 'Provide the size of the item' },
    {
      key: 'partNumber',
      label: 'Part Number',
      col: 'AY',
      conditional: true,
      type: 'text',
      placeholder: 'Banarasi Paithani',
      help: 'Provide the part number. For many products, this will be identical to the model number however some manufacturers distinguish part number from model number',
    },
    {
      key: 'theme',
      label: 'Theme',
      col: 'AZ',
      aiFillable: true,
      type: 'select',
      options: ['Occasion', 'Everyday', 'Wedding', 'Festival', 'Sports', 'Travel'],
      help: 'Provide the primary high-level concept, motif, or idea that the item itself, or else the images or design of the item, evoke.',
    },
    {
      key: 'careInstructions',
      label: 'Care Instructions',
      col: 'BA',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Dry Clean Only', 'Machine Wash Cold', 'Hand Wash Only', 'Do Not Bleach', 'Line Dry'],
      help: 'Provide instructions related to how to care for the item',
    },
    {
      key: 'manufacturerContact',
      label: 'Manufacturer Contact Information',
      col: 'BB',
      conditional: true,
      type: 'text',
      placeholder: 'Manufacturer Name Ltd., Street No. 24/4, New Delhi, India - 110011, Contact: +91-22-XXXXXXXX',
      help: "Provide the contact information (including address, zipcode) for the product's manufacturer",
    },
    {
      key: 'productSiteLaunchDate',
      label: 'Product Site Launch Date',
      col: 'BC',
      aiFillable: true,
      type: 'text',
      placeholder: '2024-05-20T00:00:01Z',
      help: 'Provide the date the product launches and should first be shown on the Amazon website (YYYY-MM-DD format). PSLD does not impact buyability or pre-order logic.',
    },
    {
      key: 'leagueName',
      label: 'League Name',
      col: 'BD',
      aiFillable: true,
      type: 'select',
      options: ['Not Applicable', 'Tennis', 'Cricket', 'Football', 'Basketball'],
      help: 'Provide the league name associated with this product',
    },
    {
      key: 'teamName',
      label: 'Team Name',
      col: 'BE',
      aiFillable: true,
      type: 'text',
      placeholder: 'N/A',
      help: 'Provide the name of the sports team associated with the apparel item, indicating the team affiliation represented by the clothing.',
    },
    {
      key: 'externalProductInformationEntity',
      label: 'External Product Information Entity',
      col: 'BF',
      conditional: true,
      type: 'text',
      placeholder: 'HSN Code',
      help: 'Store external product entity information. "HSN" for India marketplace.',
    },
    {
      key: 'externalProductInformation',
      label: 'External Product Information',
      col: 'BG',
      conditional: true,
      type: 'text',
      placeholder: 'N/A',
      help: 'Store external product information for a given key. For example 6 to 8-digit HSN for India marketplace.',
    },
    importerContactField('BH'),
    importerContactField('BI'),
    packerContactField('BM'),
    packerContactField('BN'),
    packerContactField('BO'),
    packerContactField('BP'),
    packerContactField('BQ'),
    {
      key: 'closureTypeBR',
      label: 'Closure Type',
      col: 'BR',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Pull-On', 'Zipper', 'Button', 'Hook and Eye', 'Lace-Up', 'Elastic'],
      help: 'Provide the type of closing mechanism used by the item. The closing type allows a user to fully wear, seal, or close the item.',
    },
    {
      key: 'closureTypeBS',
      label: 'Closure Type',
      col: 'BS',
      conditional: true,
      aiFillable: true,
      type: 'select',
      options: ['Pull-On', 'Zipper', 'Button', 'Hook and Eye', 'Lace-Up', 'Elastic'],
      help: 'Provide the type of closing mechanism used by the item. The closing type allows a user to fully wear, seal, or close the item.',
    },
    {
      key: 'itemWeight',
      label: 'Item Weight',
      col: 'BT',
      conditional: true,
      type: 'number',
      placeholder: '480',
      help: 'Provide the item weight numeric value (not including the packaging)',
    },
  ],

  'BEAUTY.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A lightweight, fast-absorbing face cream infused with hyaluronic acid and vitamin E to hydrate and soften skin without leaving a greasy residue.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'face cream moisturizer hydrating skincare', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'itemForm', label: 'Item Form', col: 'AL', aiFillable: true, type: 'select', options: ['Cream', 'Gel', 'Liquid', 'Powder', 'Spray', 'Balm', 'Oil', 'Stick'], help: 'Provide the physical form of the product.' },
    { key: 'skinType', label: 'Skin Type', col: 'AM', conditional: true, aiFillable: true, type: 'select', options: ['All', 'Normal', 'Dry', 'Oily', 'Combination', 'Sensitive'], help: 'Provide the skin type this product is designed for, if applicable.' },
    { key: 'hairType', label: 'Hair Type', col: 'AN', conditional: true, aiFillable: true, type: 'select', options: ['All', 'Straight', 'Wavy', 'Curly', 'Coily'], help: 'Provide the hair type this product is designed for, if applicable.' },
    { key: 'scent', label: 'Scent', col: 'AO', conditional: true, aiFillable: true, type: 'text', placeholder: 'Lavender', help: 'Provide the scent or fragrance of the product, if any.' },
    { key: 'specialIngredients', label: 'Special Ingredients', col: 'AP', aiFillable: true, type: 'text', placeholder: 'Hyaluronic Acid, Vitamin E', help: 'Provide the key active ingredients that differentiate this product.' },
    { key: 'color', label: 'Color', col: 'AQ', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product, if applicable.' },
    { key: 'itemVolume', label: 'Item Volume', col: 'AR', conditional: true, type: 'number', placeholder: '50', help: 'Provide the volume of the product as a numeric value.' },
    { key: 'itemVolumeUnit', label: 'Item Volume Unit', col: 'AS', conditional: true, type: 'select', options: ['Milliliters', 'Liters', 'Fluid Ounces', 'Grams'], help: 'Select the unit of measure for Item Volume.' },
    { key: 'targetGender', label: 'Target Gender', col: 'AT', conditional: true, aiFillable: true, type: 'select', options: ['Female', 'Male', 'Unisex'], help: 'Provide the target gender for the product.' },
    { key: 'ageRangeDescription', label: 'Age Range Description', col: 'AU', conditional: true, aiFillable: true, type: 'select', options: ['Adult', 'Teen', 'Kids', 'All Ages'], help: 'Provide the intended age range for the product.' },
    { key: 'numberOfItems', label: 'Number of Items', col: 'AV', conditional: true, aiFillable: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit.' },
    { key: 'directions', label: 'Directions', col: 'AW', aiFillable: true, type: 'textarea', placeholder: 'Apply evenly to clean skin, morning and night.', help: 'Provide usage instructions for the product.' },
  ],

  'JEWELRY.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'An elegant sterling silver pendant necklace featuring a cubic zirconia centerpiece, finished with a delicate cable chain — a timeless addition to any jewelry collection.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'silver necklace pendant gift jewelry', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'metalType', label: 'Metal Type', col: 'AL', aiFillable: true, type: 'select', options: ['Gold', 'Silver', 'Platinum', 'Stainless Steel', 'Brass', 'Rose Gold', 'Sterling Silver'], help: 'Provide the primary metal type used in the item.' },
    { key: 'metalStamp', label: 'Metal Stamp', col: 'AM', conditional: true, type: 'text', placeholder: '925 Sterling Silver', help: 'Provide the metal purity stamp marked on the item, if any.' },
    { key: 'gemstoneType', label: 'Gemstone Type', col: 'AN', conditional: true, aiFillable: true, type: 'text', placeholder: 'Cubic Zirconia', help: 'Provide the type of gemstone featured on the item, if any.' },
    { key: 'plating', label: 'Plating', col: 'AO', conditional: true, type: 'select', options: ['None', 'Gold Plated', 'Rhodium Plated', 'Silver Plated'], help: 'Provide the plating applied to the item, if any.' },
    { key: 'itemShape', label: 'Item Shape', col: 'AP', aiFillable: true, type: 'text', placeholder: 'Round', help: 'Provide the shape of the item or its centerpiece.' },
    { key: 'chainType', label: 'Chain Type', col: 'AQ', conditional: true, type: 'select', options: ['Cable', 'Box', 'Rope', 'Curb', 'Snake'], help: 'Provide the chain style, if the item includes one.' },
    { key: 'ringSize', label: 'Ring Size', col: 'AR', conditional: true, type: 'text', placeholder: '7', help: 'Provide the ring size, if applicable.' },
    { key: 'color', label: 'Color', col: 'AS', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'occasion', label: 'Occasion', col: 'AT', aiFillable: true, type: 'select', options: ['Everyday', 'Wedding', 'Anniversary', 'Festival', 'Party'], help: 'Provide the occasion the item is best suited for.' },
    { key: 'style', label: 'Style', col: 'AU', aiFillable: true, type: 'select', options: ['Classic', 'Modern', 'Vintage', 'Minimalist', 'Statement'], help: 'Provide the design aesthetic of the item.' },
    { key: 'numberOfItems', label: 'Number of Items', col: 'AV', conditional: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit.' },
  ],

  'KITCHEN.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A durable stainless steel non-stick frying pan, evenly heat-conductive and dishwasher safe — built for everyday cooking that cleans up in minutes.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'frying pan non stick kitchen cookware', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'material', label: 'Material', col: 'AL', aiFillable: true, type: 'text', placeholder: 'Stainless Steel', help: 'Provide the primary material the product is made of.' },
    { key: 'color', label: 'Color', col: 'AM', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'capacity', label: 'Capacity', col: 'AN', conditional: true, type: 'number', placeholder: '2', help: 'Provide the capacity of the product as a numeric value.' },
    { key: 'capacityUnit', label: 'Capacity Unit', col: 'AO', conditional: true, type: 'select', options: ['Milliliters', 'Liters', 'Cups', 'Ounces'], help: 'Select the unit of measure for Capacity.' },
    { key: 'numberOfPieces', label: 'Number of Pieces', col: 'AP', conditional: true, aiFillable: true, type: 'number', placeholder: '1', help: 'Provide the number of pieces included in the set.' },
    { key: 'itemShape', label: 'Item Shape', col: 'AQ', conditional: true, aiFillable: true, type: 'text', placeholder: 'Round', help: 'Provide the shape of the item.' },
    { key: 'specialFeature', label: 'Special Feature', col: 'AR', aiFillable: true, type: 'text', placeholder: 'Non-Stick, Dishwasher Safe', help: 'Provide notable features of the item.' },
    { key: 'isDishwasherSafe', label: 'Is Dishwasher Safe', col: 'AS', aiFillable: true, type: 'select', options: ['Yes', 'No'], help: 'Provide whether the item can safely be cleaned in a dishwasher.' },
    { key: 'isMicrowaveSafe', label: 'Is Microwave Safe', col: 'AT', aiFillable: true, type: 'select', options: ['Yes', 'No'], help: 'Provide whether the item can safely be used in a microwave.' },
    { key: 'includedComponents', label: 'Included Components', col: 'AU', aiFillable: true, type: 'text', placeholder: '1 x Pan, 1 x Lid', help: 'Provide the components included with the product.' },
    { key: 'careInstructions', label: 'Care Instructions', col: 'AV', aiFillable: true, type: 'select', options: ['Dishwasher Safe', 'Hand Wash Only', 'Wipe Clean'], help: 'Provide instructions related to how to care for the item.' },
  ],

  'OFFICE_PRODUCTS.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A smooth-writing gel pen with quick-dry ink and an ergonomic grip, designed for comfortable everyday note-taking.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'gel pen office stationery supplies', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'material', label: 'Material', col: 'AL', aiFillable: true, type: 'text', help: 'Provide the primary material the product is made of.' },
    { key: 'color', label: 'Color', col: 'AM', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'numberOfItems', label: 'Number of Items', col: 'AN', conditional: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit.' },
    { key: 'itemPackageQuantity', label: 'Item Package Quantity', col: 'AO', conditional: true, type: 'number', placeholder: '1', help: 'Provide the number of packages included in this listing.' },
    { key: 'specialFeature', label: 'Special Feature', col: 'AP', aiFillable: true, type: 'text', placeholder: 'Quick-Dry Ink, Ergonomic Grip', help: 'Provide notable features of the item.' },
    { key: 'includedComponents', label: 'Included Components', col: 'AQ', aiFillable: true, type: 'text', help: 'Provide the components included with the product.' },
    { key: 'style', label: 'Style', col: 'AR', aiFillable: true, type: 'text', help: 'Provide the style of the product.' },
    { key: 'sheetSize', label: 'Sheet Size', col: 'AS', conditional: true, type: 'select', options: ['A4', 'A5', 'Letter', 'Legal'], help: 'Provide the paper size, if applicable.' },
  ],

  'PROFESSIONAL_HEALTHCARE.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A digital blood pressure monitor for accurate at-home readings, featuring a large display and automatic inflation for simple, single-button operation.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'blood pressure monitor home healthcare device', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'material', label: 'Material', col: 'AL', aiFillable: true, type: 'text', help: 'Provide the primary material the product is made of.' },
    { key: 'color', label: 'Color', col: 'AM', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product, if applicable.' },
    { key: 'size', label: 'Size', col: 'AN', conditional: true, type: 'text', help: 'Provide the size of the item, if applicable.' },
    { key: 'isSterile', label: 'Is Sterile', col: 'AO', conditional: true, type: 'select', options: ['Yes', 'No'], help: 'Provide whether the item is supplied sterile.' },
    { key: 'isLatexFree', label: 'Is Latex Free', col: 'AP', aiFillable: true, type: 'select', options: ['Yes', 'No'], help: 'Provide whether the item is free of natural rubber latex.' },
    { key: 'isSingleUse', label: 'Single Use or Reusable', col: 'AQ', conditional: true, type: 'select', options: ['Single Use', 'Reusable'], help: 'Provide whether the item is intended for single use or is reusable.' },
    { key: 'intendedUse', label: 'Intended Use', col: 'AR', aiFillable: true, type: 'textarea', placeholder: 'For measuring blood pressure at home.', help: 'Describe the intended use of the device.' },
    { key: 'prescriptionStatus', label: 'Prescription Status', col: 'AS', type: 'select', options: ['Not a Prescription Item', 'Prescription Required'], help: 'Provide whether a prescription is required to purchase this item.' },
    { key: 'numberOfItems', label: 'Number of Items', col: 'AT', conditional: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit.' },
  ],

  // PERSONAL_CARE.xlsm — verified against a real downloaded Amazon template (see
  // templates/PERSONAL_CARE.xlsm), not best-effort like the other categories in this map. Its
  // real Product Details section runs AH-DG — 72 columns, far wider than Clothing's or Consumer
  // Electronics' — curated the same thoughtful way those two were: keep what a real seller of
  // grooming tools/cosmetics would actually fill in, cut what's either not category-relevant or
  // a same-label repeat with nothing more to say. Concretely:
  //  - Generic Keyword (5 slots, AN-AR) and Material (5 slots, AS-AW) are trimmed to 2 slots
  //    each, Importer Contact Information (5 slots, CH-CL) to 2, Packer Contact Information (5
  //    slots, CM-CQ) to 3 (matching Consumer Electronics' own precedent), and Ingredients (5
  //    slots, CX-DB) to 3 — same "kept to a few clearly-useful slots, not all 5" reasoning as
  //    Offer (IN)'s quantity-discount tiers and Safety & Compliance's Dangerous Goods
  //    Regulations/GHS Class fields elsewhere in this file. Fabric Type (5 slots, AX-BB) is
  //    trimmed to just 1 — most personal care products (electric trimmers, skincare, grooming
  //    tools) have no fabric at all; the rare textile personal-care item (a wash cloth, a robe)
  //    still gets one slot to use.
  //  - League Name (5 slots, BU-BY) and Team Name (2 slots, BZ-CA) are dropped entirely — real
  //    Amazon columns on this template, but there's no realistic personal care listing that
  //    needs a sports league/team affiliation (same call as dropping Offer's "non-new product"
  //    fields for a seller who's never selling used goods).
  //  - Also dropped as too niche for this category: Temperature Rating (BJ) and Serial Number
  //    Scan Required (BK), both aimed at high-value electronics/pharma tracking rather than
  //    grooming products; Lot Controlled Product (BP) and Health Industry Bar Code (CD), batch/
  //    HIBC tracking used by pharma distributors rather than typical marketplace sellers; Item
  //    Thickness/decimal value/unit (CE-CG), essentially unused outside industrial materials; and
  //    Labeler Name (DG), an FDA drug-labeler code that essentially no personal care seller here
  //    has.
  //  - Kept and worth calling out: Is the Item Heat Sensitive?/Melting Temperature (degrees
  //    Celsius)/Melting Temperature Unit (CT-CV) — a genuinely common personal care concern (lip
  //    balm, wax, cream-based products that can melt in transit) neither Consumer Electronics nor
  //    Clothing had any equivalent of. Is Product Expirable/Product Expiration Type/Fulfillment
  //    Center Shelf Life(+Unit) (BL-BO) are kept for the same reason — cosmetics/skincare
  //    genuinely expire, unlike a saree or a speaker. External Product Information Entity/
  //    External Product Information (CB-CC) are kept for the same HSN-code reasoning as
  //    Clothing's identical pair.
  //  - Release Date (DC) and Dosage Form (DE) are kept even though this template's real Product
  //    Type constant is "PROFESSIONAL_HEALTHCARE" (see PRODUCT_TYPE_BY_TEMPLATE in
  //    templateInject.js) — some Personal Care listings genuinely are supplements/health items
  //    with a dosage form and their own release date, distinct from Product Site Launch Date.
  'PERSONAL_CARE.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AH',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A cordless 2-in-1 eyebrow trimmer and epilator with a precision face-trimming head, designed for gentle, painless hair removal anywhere at home.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AI'),
    bulletPointField('AJ'),
    bulletPointField('AK'),
    bulletPointField('AL'),
    bulletPointField('AM'),
    genericKeywordField('AN'),
    genericKeywordField('AO'),
    materialField('AS'),
    materialField('AT'),
    { key: 'fabricType', label: 'Fabric Type', col: 'AX', conditional: true, aiFillable: true, type: 'text', placeholder: 'Cotton', help: "Provide the materials used in the garment's construction, including percentages of each fabric type — only applicable to textile personal care items (e.g. a wash cloth, a robe)." },
    { key: 'numberOfItems', label: 'Number of Items', col: 'BC', conditional: true, aiFillable: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit to the customer' },
    { key: 'itemTypeName', label: 'Item Type Name', col: 'BD', conditional: true, aiFillable: true, type: 'text', placeholder: 'Eyebrow Trimmer', help: 'Select from the list or provide a customer-facing one to two-word phrase that describes the type of item the product is.' },
    { key: 'color', label: 'Color', col: 'BE', conditional: true, aiFillable: true, type: 'text', placeholder: 'Rose Gold', help: 'Provide the color of the product' },
    { key: 'size', label: 'Size', col: 'BF', conditional: true, aiFillable: true, type: 'text', help: 'Provide the size of the item' },
    { key: 'partNumber', label: 'Part Number', col: 'BG', type: 'text', help: 'Provide the part number. For many products, this will be identical to the model number however some manufacturers distinguish part number from model number' },
    { key: 'itemShape', label: 'Item Shape', col: 'BH', aiFillable: true, type: 'text', placeholder: 'Ergonomic', help: 'Provide the shape of the item.' },
    {
      key: 'manufacturerContact',
      label: 'Manufacturer Contact Information',
      col: 'BI',
      conditional: true,
      type: 'text',
      placeholder: 'Manufacturer Name Ltd., Street No. 24/4, New Delhi, India - 110011, Contact: +91-22-XXXXXXXX',
      help: "Provide the contact information (including address, zipcode) for the product's manufacturer",
    },
    { key: 'isProductExpirable', label: 'Is Product Expirable', col: 'BL', conditional: true, type: 'select', options: ['No', 'Yes'], help: 'Provide whether the product has an expiration date.' },
    { key: 'productExpirationType', label: 'Product Expiration Type', col: 'BM', conditional: true, type: 'select', options: ['Not Applicable', 'Best By', 'Use By', 'Expires On'], help: 'Provide how the expiration date is expressed on the product packaging, if it is expirable.' },
    { key: 'fulfillmentCenterShelfLife', label: 'Fulfillment Center Shelf Life', col: 'BN', conditional: true, type: 'number', help: 'Provide the minimum shelf life remaining, as a numeric value, required for the item to be accepted at an Amazon fulfillment center.' },
    { key: 'fulfillmentCenterShelfLifeUnit', label: 'Fulfillment Center Shelf Life Unit', col: 'BO', conditional: true, type: 'select', options: ['Days', 'Weeks', 'Months', 'Years'], help: 'Select the unit of measure for Fulfillment Center Shelf Life.' },
    { key: 'unitCount', label: 'Unit Count', col: 'BQ', conditional: true, type: 'number', help: 'Provide the count of individual units included in this product or package.' },
    { key: 'unitCountType', label: 'Unit Count Type', col: 'BR', conditional: true, type: 'text', placeholder: 'Count', help: 'Provide the unit of measure for Unit Count (e.g. Count, Milliliters, Grams).' },
    {
      key: 'productSiteLaunchDate',
      label: 'Product Site Launch Date',
      col: 'BS',
      aiFillable: true,
      type: 'text',
      placeholder: '2026-01-15T00:00:01Z',
      help: 'Provide the date the product launches and should first be shown on the Amazon website (YYYY-MM-DD format). PSLD does not impact buyability or pre-order logic.',
    },
    { key: 'includedComponents', label: 'Included Components', col: 'BT', aiFillable: true, type: 'text', placeholder: '1 x Trimmer, 1 x Charging Cable, 3 x Attachment Combs', help: 'Provide the components included with the product.' },
    {
      key: 'externalProductInformationEntity',
      label: 'External Product Information Entity',
      col: 'CB',
      conditional: true,
      type: 'text',
      placeholder: 'HSN Code',
      help: 'Store external product entity information. "HSN" for India marketplace.',
    },
    {
      key: 'externalProductInformation',
      label: 'External Product Information',
      col: 'CC',
      conditional: true,
      type: 'text',
      placeholder: 'N/A',
      help: 'Store external product information for a given key. For example 6 to 8-digit HSN for India marketplace.',
    },
    importerContactField('CH'),
    importerContactField('CI'),
    packerContactField('CM'),
    packerContactField('CN'),
    packerContactField('CO'),
    { key: 'itemWeight', label: 'Item Weight', col: 'CR', conditional: true, type: 'number', placeholder: '350', help: 'Provide the item weight numeric value (not including the packaging)' },
    { key: 'itemWeightUnit', label: 'Item Weight Unit', col: 'CS', conditional: true, type: 'select', options: WEIGHT_UNIT_OPTIONS, help: 'Provide unit for item weight' },
    { key: 'isHeatSensitive', label: 'Is the Item Heat Sensitive?', col: 'CT', conditional: true, type: 'select', options: ['No', 'Yes'], help: 'Provide whether the item can be damaged by exposure to heat during shipping/storage (e.g. a wax or cream-based product that can melt).' },
    { key: 'meltingTemperature', label: 'Melting Temperature (degrees Celsius)', col: 'CU', conditional: true, type: 'number', help: 'Provide the temperature at which the item begins to melt, if heat sensitive.' },
    { key: 'meltingTemperatureUnit', label: 'Melting Temperature Unit', col: 'CV', conditional: true, type: 'select', options: ['Celsius', 'Fahrenheit'], help: 'Select the unit of measure for Melting Temperature.' },
    { key: 'flavor', label: 'Flavor', col: 'CW', conditional: true, aiFillable: true, type: 'text', placeholder: 'Mint', help: 'Provide the flavor of the product, if applicable (e.g. a flavored lip balm or mouthwash).' },
    ingredientField('CX'),
    ingredientField('CY'),
    ingredientField('CZ'),
    {
      key: 'releaseDate',
      label: 'Release Date',
      col: 'DC',
      aiFillable: true,
      type: 'text',
      placeholder: '2026-01-15',
      help: 'Provide the date this product was first released or manufactured (YYYY-MM-DD format).',
    },
    { key: 'scent', label: 'Scent', col: 'DD', conditional: true, aiFillable: true, type: 'text', help: 'Provide the scent or fragrance of the product, if any.' },
    { key: 'dosageForm', label: 'Dosage Form', col: 'DE', conditional: true, type: 'select', options: ['Not Applicable', 'Tablet', 'Capsule', 'Liquid', 'Powder', 'Gummy'], help: 'Provide the dosage form, if this is an ingestible health/supplement item.' },
    { key: 'packageSizeName', label: 'Package Size Name', col: 'DF', conditional: true, type: 'text', placeholder: 'Trial Size', help: 'Provide the package size descriptor (e.g. Trial Size, Value Pack, Travel Size).' },
  ],

  'BABY_PRODUCTS.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A soft, breathable 100% cotton swaddle blanket, gentle on sensitive newborn skin and machine washable for easy everyday care.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'baby swaddle blanket newborn cotton', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'ageRangeDescription', label: 'Age Range Description', col: 'AL', aiFillable: true, type: 'select', options: ['0-3 Months', '3-6 Months', '6-12 Months', '1-2 Years', '2-4 Years', 'All Ages'], help: 'Provide the intended age range for the product.' },
    { key: 'material', label: 'Material', col: 'AM', aiFillable: true, type: 'text', placeholder: 'Cotton', help: 'Provide the primary material the product is made of.' },
    { key: 'color', label: 'Color', col: 'AN', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'isBpaFree', label: 'Is BPA Free', col: 'AO', aiFillable: true, type: 'select', options: ['Yes', 'No'], help: 'Provide whether the item is free of BPA, if applicable.' },
    { key: 'numberOfPieces', label: 'Number of Pieces', col: 'AP', conditional: true, type: 'number', placeholder: '1', help: 'Provide the number of pieces included in the set.' },
    { key: 'specialFeature', label: 'Special Feature', col: 'AQ', aiFillable: true, type: 'text', placeholder: 'Machine Washable, Hypoallergenic', help: 'Provide notable features of the item.' },
    { key: 'careInstructions', label: 'Care Instructions', col: 'AR', aiFillable: true, type: 'select', options: ['Machine Wash Cold', 'Hand Wash Only', 'Dry Clean Only'], help: 'Provide instructions related to how to care for the item.' },
    { key: 'safetyWarning', label: 'Safety Warning', col: 'AS', type: 'textarea', placeholder: 'Choking Hazard — Small Parts. Not suitable for children under 3 years.', help: 'Provide any safety warning required for this product, e.g. choking hazard for small parts.' },
  ],

  'CAR_ELECTRONICS.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A compact Bluetooth car adapter that streams audio and takes hands-free calls through your car speakers, with a built-in USB port for charging on the go.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'bluetooth car adapter hands free charger', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'compatibleVehicles', label: 'Compatible Vehicles', col: 'AL', type: 'text', placeholder: 'Universal Fit — Most Sedans and SUVs', help: 'Provide the vehicles this product is compatible with.' },
    { key: 'connectivityTechnology', label: 'Connectivity Technology', col: 'AM', aiFillable: true, type: 'select', options: ['Bluetooth', 'USB', 'AUX', 'Wi-Fi', 'NFC'], help: 'Provide the connectivity technology the product uses.' },
    { key: 'powerSource', label: 'Power Source', col: 'AN', type: 'select', options: ['12V Car Adapter', 'USB', 'Battery'], help: 'Provide how the product is powered.' },
    { key: 'screenSize', label: 'Screen Size', col: 'AO', conditional: true, type: 'number', help: 'Provide the screen size in inches, if applicable.' },
    { key: 'material', label: 'Material', col: 'AP', aiFillable: true, type: 'text', help: 'Provide the primary material the product is made of.' },
    { key: 'color', label: 'Color', col: 'AQ', conditional: true, aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'specialFeature', label: 'Special Feature', col: 'AR', aiFillable: true, type: 'text', placeholder: 'Voice Control, GPS Navigation', help: 'Provide notable features of the item.' },
    { key: 'includedComponents', label: 'Included Components', col: 'AS', aiFillable: true, type: 'text', help: 'Provide the components included with the product.' },
    { key: 'itemVoltage', label: 'Item Voltage', col: 'AT', conditional: true, type: 'number', help: 'Provide the operating voltage of the item, if applicable.' },
    { key: 'waterResistanceLevel', label: 'Water Resistance Level', col: 'AU', conditional: true, type: 'select', options: ['Not Water Resistant', 'Water Resistant', 'Waterproof'], help: 'Provide the water resistance level of the item.' },
  ],

  'GROCERY.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'Whole grain rolled oats, slow-cooked for a hearty breakfast — no added sugar, no artificial preservatives, just 100% natural oats.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'rolled oats breakfast cereal healthy grocery', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'itemForm', label: 'Item Form', col: 'AL', aiFillable: true, type: 'select', options: ['Powder', 'Liquid', 'Solid', 'Granules', 'Whole'], help: 'Provide the physical form of the product.' },
    { key: 'flavor', label: 'Flavor', col: 'AM', conditional: true, aiFillable: true, type: 'text', placeholder: 'Original', help: 'Provide the flavor of the product, if applicable.' },
    { key: 'dietType', label: 'Diet Type', col: 'AN', aiFillable: true, type: 'select', options: ['Vegan', 'Vegetarian', 'Gluten Free', 'Organic', 'Sugar Free', 'Not Applicable'], help: 'Provide any diet type this product is suited for.' },
    { key: 'ingredients', label: 'Ingredients', col: 'AO', aiFillable: true, type: 'textarea', placeholder: 'Whole Grain Rolled Oats', help: 'Provide the full ingredients list.' },
    { key: 'netQuantity', label: 'Net Quantity', col: 'AP', type: 'number', placeholder: '500', help: 'Provide the net quantity of the product as a numeric value.' },
    { key: 'netQuantityUnit', label: 'Net Quantity Unit', col: 'AQ', type: 'select', options: ['Grams', 'Kilograms', 'Milliliters', 'Liters', 'Count'], help: 'Select the unit of measure for Net Quantity.' },
    { key: 'numberOfItems', label: 'Number of Items', col: 'AR', conditional: true, type: 'number', placeholder: '1', help: 'Provide the total number of identical items in the selling unit.' },
    { key: 'specialFeature', label: 'Special Feature', col: 'AS', aiFillable: true, type: 'text', placeholder: 'No Artificial Preservatives', help: 'Provide notable features of the item.' },
  ],

  'PET_FOOD.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'A nutritious dry dog food made with real chicken and rice, formulated to support healthy digestion and a shiny coat in adult dogs of all breeds.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'dry dog food chicken rice pet nutrition', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'petType', label: 'Pet Type', col: 'AL', aiFillable: true, type: 'select', options: ['Dog', 'Cat', 'Bird', 'Fish', 'Small Animal'], help: 'Provide the type of pet this product is intended for.' },
    { key: 'breedRecommendation', label: 'Breed Recommendation', col: 'AM', conditional: true, type: 'text', placeholder: 'All Breeds', help: 'Provide the breed(s) this product is recommended for, if any.' },
    { key: 'lifeStage', label: 'Life Stage', col: 'AN', aiFillable: true, type: 'select', options: ['Puppy/Kitten', 'Adult', 'Senior', 'All Life Stages'], help: 'Provide the pet life stage this product is formulated for.' },
    { key: 'flavor', label: 'Flavor', col: 'AO', aiFillable: true, type: 'text', placeholder: 'Chicken & Rice', help: 'Provide the flavor of the product.' },
    { key: 'itemForm', label: 'Item Form', col: 'AP', aiFillable: true, type: 'select', options: ['Dry', 'Wet', 'Treats', 'Powder'], help: 'Provide the physical form of the product.' },
    { key: 'specialIngredients', label: 'Special Ingredients', col: 'AQ', aiFillable: true, type: 'text', placeholder: 'Real Chicken, Omega-3', help: 'Provide the key ingredients that differentiate this product.' },
    { key: 'netQuantity', label: 'Net Quantity', col: 'AR', type: 'number', help: 'Provide the net quantity of the product as a numeric value.' },
    { key: 'netQuantityUnit', label: 'Net Quantity Unit', col: 'AS', type: 'select', options: ['Grams', 'Kilograms', 'Pounds'], help: 'Select the unit of measure for Net Quantity.' },
  ],

  'SHOES.xlsm': [
    {
      key: 'productDescription',
      label: 'Product Description',
      col: 'AE',
      required: true,
      aiFillable: true,
      type: 'textarea',
      placeholder: 'Genuine leather lace-up boots with a durable rubber sole, built for all-day comfort and a classic look that pairs with both casual and formal outfits.',
      help: 'Provide a text description of the product. This information will appear in paragraph form on the detail page of your product.',
    },
    bulletPointField('AF'),
    bulletPointField('AG'),
    bulletPointField('AH'),
    bulletPointField('AI'),
    bulletPointField('AJ'),
    { key: 'genericKeywords', label: 'Generic Keywords', col: 'AK', aiFillable: true, type: 'text', placeholder: 'leather boots lace up casual shoes', help: 'Provide any terms that may be relevant to customer searches. No repetition, no competitor brand names or ASINs.' },
    { key: 'shoeSize', label: 'Shoe Size', col: 'AL', conditional: true, type: 'text', placeholder: 'UK 8', help: 'Provide the shoe size.' },
    { key: 'shoeWidth', label: 'Shoe Width', col: 'AM', conditional: true, type: 'select', options: ['Narrow', 'Medium', 'Wide', 'Extra Wide'], help: 'Provide the shoe width.' },
    { key: 'color', label: 'Color', col: 'AN', aiFillable: true, type: 'text', help: 'Provide the color of the product.' },
    { key: 'outerMaterial', label: 'Outer Material', col: 'AO', aiFillable: true, type: 'text', placeholder: 'Genuine Leather', help: 'Provide the material used for the outer/upper of the shoe.' },
    { key: 'soleMaterial', label: 'Sole Material', col: 'AP', aiFillable: true, type: 'text', placeholder: 'Rubber', help: 'Provide the material used for the sole of the shoe.' },
    { key: 'closureType', label: 'Closure Type', col: 'AQ', aiFillable: true, type: 'select', options: ['Lace-Up', 'Slip-On', 'Velcro', 'Buckle', 'Zipper'], help: 'Provide the type of closing mechanism used by the shoe.' },
    { key: 'heelType', label: 'Heel Type', col: 'AR', conditional: true, aiFillable: true, type: 'select', options: ['Flat', 'Block Heel', 'Stiletto', 'Wedge', 'Platform'], help: 'Provide the heel type, if applicable.' },
    { key: 'style', label: 'Style', col: 'AS', aiFillable: true, type: 'select', options: ['Casual', 'Formal', 'Sports', 'Sandals', 'Boots'], help: 'Provide the style of the shoe.' },
    { key: 'targetGender', label: 'Target Gender', col: 'AT', aiFillable: true, type: 'select', options: ['Female', 'Male', 'Unisex'], help: 'Provide the target gender for the product.' },
    { key: 'ageRangeDescription', label: 'Age Range Description', col: 'AU', conditional: true, aiFillable: true, type: 'select', options: ['Adult', 'Kids', 'Toddler'], help: 'Provide the intended age range for the shoe.' },
  ],
};

// One lookup for every category-specific subsection's *_BY_CATEGORY map, so the three call
// sites below (render, Generate with AI, Download) can't drift out of sync with each other about
// which subsections are category-specific vs. shared.
const CATEGORY_SPECIFIC_SUBSECTIONS = {
  productIdentity: PRODUCT_IDENTITY_BY_CATEGORY,
  productDetails: PRODUCT_DETAILS_BY_CATEGORY,
  offer: OFFER_BY_CATEGORY,
  offerIN: OFFER_IN_BY_CATEGORY,
  shipping: SHIPPING_BY_CATEGORY,
  safetyCompliance: SAFETY_COMPLIANCE_BY_CATEGORY,
};

/** Resolves one subsection's fields for the currently selected category — category-specific
 *  subsections fall back to an empty array (rendered as the "not defined yet" placeholder) when
 *  that category has no entry yet; the one remaining shared subsection (Listing Identity/
 *  Variations — Shipping joined productIdentity/offer/offerIN/safetyCompliance as a by-category
 *  map once Personal Care's real template proved its column positions shift per category too)
 *  ignores the category entirely. */
function resolveSubsectionFields(subsectionKey, category) {
  const byCategory = CATEGORY_SPECIFIC_SUBSECTIONS[subsectionKey];
  if (byCategory) return byCategory[category] || [];
  return SUBSECTION_FIELDS[subsectionKey] || [];
}

// Purely a scanability aid for the denser, category-agnostic subsections (Offer (IN) alone runs
// ~20 fields in one flat grid) — groups fields under a small sub-heading instead of changing what
// gets collected or validated. Deliberately NOT defined for Product Identity/Product Details:
// Product Details' field list differs per category (13 separate arrays), so a single grouping
// can't apply to all of them without being wrong for most; Product Identity's ~14 fields already
// read fine as one flat grid. Any field whose key isn't listed in any group here still renders
// (see the ungrouped-leftover fallback in the render logic below) — nothing silently disappears
// if this list ever drifts out of sync with a field array.
const SUBSECTION_FIELD_GROUPS = {
  offer: [
    { label: 'Availability', keys: ['skipOffer', 'merchantReleaseDate', 'maximumOrderQuantity'] },
    { label: 'Condition', keys: ['itemCondition', 'offerConditionNote'] },
    { label: 'Tax & Gifting', keys: ['productTaxCode', 'offeringCanBeGiftMessaged', 'isGiftWrapAvailable'] },
  ],
  offerIN: [
    {
      label: 'Fulfillment & Inventory',
      keys: ['fulfillmentChannelCode', 'quantity', 'handlingTime', 'restockDate', 'inventoryAlwaysAvailable', 'shippingTemplateIN'],
    },
    {
      label: 'Pricing — Sell on Amazon',
      keys: [
        'yourPriceSOA', 'maximumRetailPriceSOA', 'pricingRule', 'minimumSellerAllowedPriceSOA', 'maximumSellerAllowedPriceSOA',
        'salePriceSOA', 'saleStartDateSOA', 'saleEndDateSOA', 'offeringReleaseDateSOA', 'stopSellingDateSOA',
      ],
    },
    {
      label: 'Pricing — Amazon Business (B2B)',
      keys: [
        'yourPriceB2B', 'maximumRetailPriceB2B', 'minimumSellerAllowedPriceB2B', 'maximumSellerAllowedPriceB2B',
        'offeringReleaseDateB2B', 'stopSellingDateB2B',
      ],
    },
    {
      label: 'Quantity Discounts (B2B)',
      keys: [
        'quantityPriceType', 'quantityThresholdTier1', 'quantityPriceTier1', 'quantityThresholdTier2', 'quantityPriceTier2',
        'quantityThresholdTier3', 'quantityPriceTier3',
      ],
    },
  ],
  shipping: [
    { label: 'Item Dimensions', keys: ['itemLength', 'itemLengthUnit', 'itemWidth', 'itemWidthUnit', 'itemHeight', 'itemHeightUnit'] },
    {
      label: 'Package Dimensions & Weight',
      keys: [
        'itemPackageLength', 'packageLengthUnit', 'itemPackageWidth', 'packageWidthUnit', 'itemPackageHeight', 'packageHeightUnit',
        'packageWeight', 'packageWeightUnit',
      ],
    },
  ],
  safetyCompliance: [
    { label: 'Origin & Batteries', keys: ['countryOfOrigin', 'batteriesRequired', 'batteriesIncluded', 'batteryType', 'numberOfBatteries'] },
    {
      label: 'Hazmat & Regulatory',
      keys: [
        'dangerousGoodsRegulations1', 'dangerousGoodsRegulations2', 'ghsClass1', 'ghsClass2', 'safetyDataSheetUrl',
        'complianceRegulationTypeFU', 'regulatoryIdentificationFV', 'complianceRegulationTypeFW', 'regulatoryIdentificationFX',
      ],
    },
    {
      label: 'Compliance Documents',
      keys: [
        'responsiblePersonEmail', 'complianceMediaCertificateOfCompliance', 'complianceMediaSafetyDataSheet',
        'complianceMediaSafetyInformation', 'complianceMediaWarranty', 'complianceMediaUserManual', 'complianceMediaSpecificationSheet',
      ],
    },
    { label: 'Attestations', keys: ['buyerAgeRestrictions', 'safetyAttestation', 'shipsGlobally', 'manufacturerEmail'] },
  ],
};

// Amazon's own well-documented character limits for these — hardcoded by field key rather than
// added as a property to every one of the hundreds of individual field definitions above, since
// these specific keys (Item Name, each Bullet Point, Product Description, Generic Keyword(s)) are
// the only ones with a genuinely well-established, category-agnostic limit worth enforcing.
const MAX_LENGTH_BY_FIELD_KEY = {
  itemName: 200,
  productDescription: 2000,
};
const BULLET_POINT_MAX_LENGTH = 250;
// Amazon enforces this as a byte budget, not a character count (see byteLen in ListingPage.jsx/
// ExportPage.jsx) — non-ASCII keyword text can stay under 250 characters while still exceeding
// 249 bytes, so this can't reuse MAX_LENGTH_BY_FIELD_KEY's plain value.length check above.
const GENERIC_KEYWORD_MAX_BYTES = 249;

/**
 * Validates one field's already-non-empty, already-trimmed value against Amazon's known
 * format/length conventions — returns null if it's fine, or a short reason string (used as
 * "'{label}' {reason}." in the Fill Details banner) otherwise. Deliberately lenient beyond these
 * few checks: many numeric fields have legitimate category-specific edge cases this component
 * doesn't have visibility into (e.g. Number of Items' own placeholder is "-1", a real Amazon
 * convention for "unlimited/not applicable") — this only catches unambiguous mistakes (non-numeric
 * text in a number field, a date that matches neither format this template's own fields actually
 * use, or a hardcoded standard length limit), never a guess at a per-field business rule.
 */
function validateFieldFormat(field, value) {
  if (field.type === 'number' && !/^-?\d+(\.\d+)?$/.test(value)) {
    return 'must be a number';
  }
  if (field.type === 'text' && /date/i.test(field.label) && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(value)) {
    return 'must be a date like 2026-01-15 or 2026-01-15T00:00:01Z';
  }
  if (field.key.startsWith('bulletPoint') && value.length > BULLET_POINT_MAX_LENGTH) {
    return `must be ${BULLET_POINT_MAX_LENGTH} characters or fewer (currently ${value.length})`;
  }
  if (field.key.startsWith('genericKeyword')) {
    const bytes = byteLen(value);
    if (bytes > GENERIC_KEYWORD_MAX_BYTES) {
      return `must be ${GENERIC_KEYWORD_MAX_BYTES} bytes or fewer (currently ${bytes})`;
    }
    return null;
  }
  const maxLen = MAX_LENGTH_BY_FIELD_KEY[field.key];
  if (maxLen && value.length > maxLen) {
    return `must be ${maxLen} characters or fewer (currently ${value.length})`;
  }
  return null;
}

/** One field's problem entry for the missingRequiredFields list — either it's required and
 *  empty, or it has a value that fails validateFieldFormat above; null if neither applies. Shared
 *  by the full-form check (findMissingRequiredFields) and the live per-field re-check
 *  (updateFillValue) so the two can never drift into disagreeing about the same field. */
function buildFieldProblem(subsectionKey, subsectionLabel, field, rawValue) {
  const trimmed = (rawValue || '').trim();
  if (field.required && !trimmed) {
    return { subsectionKey, subsectionLabel, fieldKey: field.key, fieldLabel: field.label, reason: 'is required' };
  }
  if (trimmed) {
    const reason = validateFieldFormat(field, trimmed);
    if (reason) return { subsectionKey, subsectionLabel, fieldKey: field.key, fieldLabel: field.label, reason };
  }
  return null;
}

// Which Product Details field key(s) actually differentiate one child variant from the next under
// a given Variations → Variation Theme — e.g. a "SIZE/COLOR" theme means every child needs its own
// Size AND Color, but the parent listing itself doesn't. Fixed by Amazon's own variation theme
// semantics, not something a category defines differently.
const VARIATION_THEME_ATTRIBUTE_KEYS = {
  COLOR: ['color'],
  SIZE: ['size'],
  'SIZE/COLOR': ['size', 'color'],
  ITEM_WEIGHT: ['itemWeight'],
  NUMBER_OF_ITEMS: ['numberOfItems'],
};

/** "itemWeight" -> "Item Weight" — used only as a display fallback for a variation-theme
 *  attribute key the current category doesn't actually define (see resolveVariantAttributeFields
 *  below), since there's no real field label to show in that case. */
function humanizeAttributeKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

/** Resolves the current category's real Product Details field definition (label/type/options/col)
 *  for each attribute key the chosen Variation Theme requires — e.g. COLOR -> [the category's own
 *  "color" field]. A category that doesn't define one of those keys (Grocery has no color/size)
 *  resolves that entry's `field` to null rather than throwing, so the Child Variants manager can
 *  show a "this category doesn't track X" note instead of crashing. */
function resolveVariantAttributeFields(variationTheme, category) {
  const keys = VARIATION_THEME_ATTRIBUTE_KEYS[variationTheme] || [];
  const productDetailsFields = resolveSubsectionFields('productDetails', category);
  const byKey = new Map(productDetailsFields.map((f) => [f.key, f]));
  return keys.map((key) => ({ key, field: byKey.get(key) || null }));
}

/**
 * The generic column-resolution boundary for variants, mirroring how the download payload's
 * `fields[]` already keeps the server completely category/schema-agnostic (it only ever sees
 * column letters + values, never "color" or "brand"): turns one variant's `{ key: value }` attrs
 * map into the `[{ col, value }]` pairs the server actually needs, using the exact same attribute
 * field definitions the Child Variants manager renders with. Blank/untouched attrs are omitted
 * entirely (same convention the server's own row-building already uses for empty values).
 */
function variantAttrsToOverrides(attrs, attributeFields) {
  const overrides = [];
  for (const { key, field } of attributeFields) {
    if (!field) continue; // this category has no real column for this attribute key
    const value = (attrs?.[key] ?? '').toString().trim();
    if (!value) continue;
    overrides.push({ col: field.col, value });
  }
  return overrides;
}

/** Reverse of the above — reconstructs a variant's `{ key: value }` attrs map from its persisted
 *  `[{ col, value }]` overrides (what the server actually stores), so reopening the wizard can
 *  repopulate the Child Variants manager's inputs even though the server only ever sees column
 *  letters, never field keys. */
function overridesToVariantAttrs(overrides, attributeFields) {
  const byCol = new Map((overrides || []).filter((o) => o && o.col).map((o) => [o.col, o.value]));
  const attrs = {};
  for (const { key, field } of attributeFields) {
    if (field && byCol.has(field.col)) attrs[key] = byCol.get(field.col);
  }
  return attrs;
}

/** Resolves a full `variants` array (the manager's own `{ id, sku, attrs }` shape) into the wire
 *  shape sent to the server — used identically at both the autosave call site and the download
 *  call site so they can never drift apart on how a variant's attrs become overrides. */
function resolveVariantsForWire(variants, attributeFields) {
  return (variants || []).map((v) => ({
    sku: (v.sku || '').trim(),
    overrides: variantAttrsToOverrides(v.attrs, attributeFields),
  }));
}

let variantIdCounter = 0;
/** Stable client-only id for a Child Variants manager row — never sent to/read from the server
 *  (which only ever sees sku+overrides), just a React key/identity. */
function nextVariantId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `variant-${++variantIdCounter}-${Date.now()}`;
}

/**
 * Rehydrates a draft-shaped object — either the live `project.amazonListingDraft` at mount, or a
 * saved `amazonListingDraftHistory` entry via "Use as new listing" — into the wizard's own
 * editable state shape. Shared by both call sites so they can never drift on how sequenceIds get
 * filtered against the current image pool or how `variants` (the server's `{sku, overrides}[]`
 * wire shape) gets turned back into the Child Variants manager's own `{id, sku, attrs}[]` shape.
 * `byId` is the wizard's current image pool lookup (see `byId` near the top of the component) —
 * an id from an older draft/history entry that no longer resolves (e.g. the image was removed)
 * is simply dropped, same as the original mount-time restore always did.
 */
function hydrateDraftState(draft, byId) {
  const theme = draft?.fillValues?.variations?.variationTheme || '';
  const attributeFields = resolveVariantAttributeFields(theme, draft?.categoryFile || null);
  return {
    selectedCategory: draft?.categoryFile || null,
    fillValues: draft?.fillValues || {},
    aiFilledFieldKeys: new Set(draft?.aiFilledFieldKeys || []),
    sequenceIds: (draft?.sequenceIds || []).filter((id) => byId.has(id)),
    variants: (draft?.variants || []).map((v) => ({
      id: nextVariantId(),
      sku: v?.sku || '',
      attrs: overridesToVariantAttrs(v?.overrides, attributeFields),
    })),
  };
}

/**
 * Builds the POST /amazon-listing/draft.xlsx request payload from an arbitrary
 * `{categoryFile, categoryName, title, sku, fillValues, variants}` shape — shared by the live
 * Draft step download and "Download again" from a history entry, so both flatten `fillValues`
 * into the server's `fields: [{subsection, field, col, value}]` shape via the exact same code
 * and can never drift apart. `variants` must already be in the server's wire shape
 * (`{sku, overrides[]}`) — a live download resolves that via `resolveVariantsForWire` first; a
 * history entry's `variants` is already stored in that same wire shape (see the autosave effect
 * below), so it passes straight through. Does not include `images` — callers add that separately
 * from whatever image sequence they have on hand (live `sequence` state vs. a history entry's
 * `sequenceIds` resolved against the current image pool).
 */
function buildAmazonListingPayload({ categoryFile, categoryName, title, sku, fillValues, variants }) {
  return {
    categoryName: categoryName || CATEGORIES.find((c) => c.file === categoryFile)?.name || categoryFile,
    categoryFile,
    title: title || '',
    sku: sku || '',
    fields: SUBSECTIONS.flatMap((s) =>
      resolveSubsectionFields(s.key, categoryFile).map((f) => ({
        subsection: s.label,
        field: f.label,
        col: f.col,
        value: fillValues?.[s.key]?.[f.key] || '',
      })),
    ),
    variants: variants || [],
  };
}

/** "2 Jan, 3:41 PM"-style formatting for a history entry's `downloadedAt` ISO timestamp — this is
 *  a full instant (not a bare `YYYY-MM-DD` date), so `new Date(...)` is safe here; it's the
 *  Postgres DATE-column case (see CLAUDE.md) that isn't. */
function formatHistoryDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const FILL_FIELD_INPUT_CLASS =
  'block w-full px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400';

/** "AI Generated" pill next to a field's label — cleared the moment the user edits that field
 *  (see clearAiFilled), so it only ever marks what's still literally the model's unedited answer. */
function AiGeneratedBadge() {
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 text-[11px] font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
      <Sparkles size={10} /> AI Generated
    </span>
  );
}

/** One Fill Details field — text/number input, textarea, or select, with its Col letter,
 *  required/conditional badge, help text, and an "AI Generated" pill when aiGenerated is set —
 *  laid out the same way Amazon Seller Central's own template does. */
function FillField({ field, value, onChange, aiGenerated, missing }) {
  const inputClass = missing ? `${FILL_FIELD_INPUT_CLASS} border-red-400 focus:border-red-500 focus:ring-red-100` : FILL_FIELD_INPUT_CLASS;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-sm font-medium text-slate-900 flex items-center flex-wrap gap-y-1">
          {field.label}
          {field.required && <span className="text-red-600 ml-0.5">*</span>}
          {field.conditional && (
            <span className="inline-flex items-center ml-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Conditional
            </span>
          )}
          {aiGenerated && <AiGeneratedBadge />}
          {field.help && (
            <span className="relative group ml-1 inline-flex">
              <button
                type="button"
                aria-label={`Help for ${field.label}`}
                className="w-4 h-4 rounded-full grid place-items-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <HelpCircle size={13} />
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-lg bg-slate-800 text-white text-[11px] leading-snug px-2.5 py-2 opacity-0 scale-95 origin-bottom transition-all group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100"
              >
                {field.help}
              </span>
            </span>
          )}
        </label>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-50 rounded px-1.5 py-0.5 flex-shrink-0">Col {field.col}</span>
      </div>
      {field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">-- Select {field.label} --</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
      {missing && <p className="text-xs text-red-600 mt-1">This field {missing}.</p>}
    </div>
  );
}

/**
 * One selectable image grid, shared by the Main/Secondary/Reference sections of step 2 — every
 * thumbnail is a real toggle (or radio, for Main) against the shared `selectedIds` set, never
 * just a static preview. `mode="radio"` shows the amber "Main Image" ribbon on the current pick
 * and always calls `onToggle` with the clicked id (never deselects — Main always has exactly
 * one); `mode="checkbox"` toggles membership and dims+blocks new picks once `atCap` is true
 * (existing selections stay clickable so they can still be removed).
 */
function ImagePickerGrid({ images, selectedIds, onToggle, mode, atCap }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
      {images.map((img) => {
        const selected = selectedIds.has(img.id);
        const blocked = mode === 'checkbox' && !selected && atCap;
        return (
          <button
            key={img.id}
            type="button"
            onClick={() => onToggle(img.id)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all ${
              selected ? 'border-brand-600 shadow-[0_0_0_3px_rgba(2,132,199,0.15)]' : 'border-slate-200 hover:border-brand-300 hover:shadow-card-hover'
            } ${blocked ? 'opacity-50' : ''}`}
          >
            <img src={img.path} alt="" className="w-full aspect-square object-cover" />
            <span
              className={`absolute top-2 right-2 w-6 h-6 grid place-items-center border-2 ${mode === 'radio' ? 'rounded-full' : 'rounded-md'} ${
                selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white/90 border-slate-200 text-transparent'
              }`}
            >
              <Check size={13} strokeWidth={3} />
            </span>
            {mode === 'radio' && selected && (
              <span className="absolute bottom-0 inset-x-0 bg-amber-400 text-white text-[11px] font-semibold text-center py-1 flex items-center justify-center gap-1">
                <Star size={11} fill="currentColor" /> Main Image
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** One section of the Images step (Main / Secondary / Reference) — heading, empty state, and grid. */
function ImagePickerSection({ icon: Icon, title, hint, images, emptyText, ...gridProps }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-6 h-6 rounded-md bg-brand-50 text-brand-600 grid place-items-center flex-shrink-0">
          <Icon size={13} />
        </span>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className="text-xs text-slate-400">— {hint}</span>
      </div>
      {images.length === 0 ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-3 py-2.5">{emptyText}</p>
      ) : (
        <ImagePickerGrid images={images} {...gridProps} />
      )}
    </div>
  );
}

/** The wizard's step breadcrumb, as a real numbered stepper (circles + connecting lines) instead
 *  of plain text — a done step fills solid with a checkmark, the active step is outlined and
 *  color-matched to what it leads to (brand blue for every step, emerald for the final "Done"),
 *  and the connecting line between two done steps fills in to match. */
function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center flex-wrap gap-y-2">
      {steps.map((label, i) => {
        const isLastStep = i === steps.length - 1;
        const done = i < currentStep;
        const active = i === currentStep;
        const accent = isLastStep ? 'emerald' : 'brand';
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={`h-0.5 w-4 sm:w-7 rounded-full flex-shrink-0 transition-colors duration-300 ${
                  i <= currentStep ? (accent === 'emerald' ? 'bg-emerald-400' : 'bg-brand-400') : 'bg-slate-200'
                }`}
              />
            )}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold border-2 transition-colors duration-300 ${
                  done
                    ? accent === 'emerald'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-brand-600 border-brand-600 text-white'
                    : active
                      ? accent === 'emerald'
                        ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                        : 'border-brand-600 text-brand-600 bg-brand-50'
                      : 'border-slate-200 text-slate-400 bg-white'
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active
                    ? accent === 'emerald'
                      ? 'text-emerald-600'
                      : 'text-brand-600'
                    : done
                      ? 'text-slate-600'
                      : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * "Create Amazon Listing" wizard, opened from the project top bar — category picker, image
 * selection, Fill Details (category-specific subsection tabs), Draft review, and the Done
 * confirmation screen.
 */
export function CreateAmazonListingModal({ onClose, project, onProjectUpdate }) {
  // Resuming a previously-saved draft (see PATCH /projects/:id/amazon-listing/draft) — a seller
  // reopening the wizard for this project should see exactly what they left off with, including
  // whatever "Generate with AI" already produced, rather than starting blank and having to
  // regenerate. Read once at mount; the draft itself only ever changes via this component.
  const savedDraft = project?.amazonListingDraft || null;

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(savedDraft?.categoryFile || null);
  // The category card that was just clicked — kept selected (and its checkmark visible) for a
  // beat before the wizard advances, so the click reads as "confirmed" rather than an instant cut.
  const [justPicked, setJustPicked] = useState(null);

  // Three distinct, genuinely selectable pools feeding the same up-to-9 sequence: AI-generated
  // "main" candidates, AI-generated "secondary" shots, and the seller's own raw uploaded product
  // photos (project.images — plain display-URL strings, not objects, so each gets a synthetic id).
  const generatedImages = [...(project?.generatedImages ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const mainCandidates = generatedImages.filter((img) => img.role === 'primary');
  const secondaryCandidates = generatedImages.filter((img) => img.role !== 'primary');
  const referenceCandidates = (project?.images ?? []).map((url, i) => ({ id: `ref-${i}`, path: url, role: 'reference' }));
  const imagePool = [...mainCandidates, ...secondaryCandidates, ...referenceCandidates];
  const byId = new Map(imagePool.map((img) => [img.id, img]));
  // Same rehydration logic used both here (restoring the live in-progress draft at mount) and by
  // "Use as new listing" below (restoring a past download's snapshot instead) — see
  // hydrateDraftState's own comment.
  const restoredDraft = hydrateDraftState(savedDraft, byId);

  const [sequenceIds, setSequenceIds] = useState(() => {
    if (restoredDraft.sequenceIds.length) return restoredDraft.sequenceIds;
    return [...mainCandidates, ...secondaryCandidates].slice(0, MAX_IMAGES).map((img) => img.id);
  });
  const sequence = sequenceIds.map((id) => byId.get(id)).filter(Boolean);
  const [capNotice, setCapNotice] = useState(false);

  const [activeSubsection, setActiveSubsection] = useState(0);
  const [fillValues, setFillValues] = useState(() => restoredDraft.fillValues);
  // Which fields still hold an unedited AI answer — cleared field-by-field the moment the user
  // types over one (see updateFillValue), so the badge only ever marks what's still literally
  // the model's output.
  const [aiFilledFields, setAiFilledFields] = useState(() => restoredDraft.aiFilledFieldKeys);
  const clearAiFilled = (subsectionKey, fieldKey) => {
    const marker = `${subsectionKey}:${fieldKey}`;
    setAiFilledFields((prev) => {
      if (!prev.has(marker)) return prev;
      const next = new Set(prev);
      next.delete(marker);
      return next;
    });
  };
  const [missingRequiredFields, setMissingRequiredFields] = useState([]);
  const updateFillValue = (subsectionKey, fieldKey, value) => {
    setFillValues((prev) => ({ ...prev, [subsectionKey]: { ...prev[subsectionKey], [fieldKey]: value } }));
    clearAiFilled(subsectionKey, fieldKey);
    // Re-validate live rather than just clearing the whole list — a still-blank required field
    // elsewhere shouldn't disappear from the list just because a different field was edited, and
    // an edit that introduces a NEW format problem (e.g. typing non-numeric text into a number
    // field) needs to reappear immediately, not just at the next full-form check.
    setMissingRequiredFields((prev) => {
      const filtered = prev.filter((m) => !(m.subsectionKey === subsectionKey && m.fieldKey === fieldKey));
      const subsection = SUBSECTIONS.find((s) => s.key === subsectionKey);
      const field = subsection && resolveSubsectionFields(subsectionKey, selectedCategory).find((f) => f.key === fieldKey);
      if (!field) return filtered;
      const problem = buildFieldProblem(subsectionKey, subsection.label, field, value);
      return problem ? [...filtered, problem] : filtered;
    });
  };

  // Child Variants manager (Variations → Parentage Level "Parent" only) — a `variants` array
  // (`{ id, sku, attrs: { productDetailsFieldKey: value } }`) alongside fillValues/aiFilledFields,
  // restored from the saved draft's own persisted `variants` (server wire shape, see
  // resolveVariantsForWire/overridesToVariantAttrs above) the same way sequenceIds/fillValues are.
  const [variants, setVariants] = useState(() => restoredDraft.variants);
  // Recomputed every render from the live theme/category (not just at mount) — cheap, and keeps
  // the manager, the autosave payload, and the download payload all resolving variant attrs
  // against exactly the same field definitions.
  const variantAttributeFields = resolveVariantAttributeFields(fillValues.variations?.variationTheme || '', selectedCategory);
  const clearVariantsMissing = () =>
    setMissingRequiredFields((prev) => prev.filter((m) => !(m.subsectionKey === 'variations' && m.fieldKey === 'variants')));
  const addVariant = () => {
    setVariants((prev) => [...prev, { id: nextVariantId(), sku: '', attrs: {} }]);
    clearVariantsMissing();
  };
  const removeVariant = (id) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
    clearVariantsMissing();
  };
  const updateVariantSku = (id, value) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, sku: value } : v)));
    clearVariantsMissing();
  };
  const updateVariantAttr = (id, key, value) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, attrs: { ...v.attrs, [key]: value } } : v)));
  };

  /** Every required field (across every subsection, with Product Details resolved for the
   *  selected category) that's still empty — the same check the "Continue to Draft Review" and
   *  "Download XLSM File" buttons both gate on, so a seller can't reach a downloaded file with
   *  required Amazon fields left blank. Also covers the Child Variants manager: a "Parent"
   *  listing needs at least one variant, every one of them with a non-empty SKU, same gate. */
  const findMissingRequiredFields = () => {
    const missing = [];
    for (const s of SUBSECTIONS) {
      const fields = resolveSubsectionFields(s.key, selectedCategory);
      for (const f of fields) {
        const problem = buildFieldProblem(s.key, s.label, f, fillValues[s.key]?.[f.key]);
        if (problem) missing.push(problem);
      }
    }
    if (fillValues.variations?.parentageLevel === 'Parent') {
      const hasValidVariants = variants.length > 0 && variants.every((v) => (v.sku || '').trim());
      if (!hasValidVariants) {
        missing.push({
          subsectionKey: 'variations',
          subsectionLabel: 'Variations',
          fieldKey: 'variants',
          fieldLabel: 'At least one variant with a SKU',
          reason: 'is required',
        });
      }
    }
    return missing;
  };

  /** "Continue to Draft Review" — blocks advancing (and jumps to the first subsection with a
   *  problem) if any required field is still empty, rather than letting the seller reach Draft
   *  with an incomplete listing. */
  const goToDraftReview = () => {
    const missing = findMissingRequiredFields();
    setMissingRequiredFields(missing);
    if (missing.length > 0) {
      const firstIdx = SUBSECTIONS.findIndex((s) => missing.some((m) => m.subsectionKey === s.key));
      if (firstIdx !== -1) setActiveSubsection(firstIdx);
      return;
    }
    setCurrentStep(3);
  };

  const [aiLoading, setAiLoading] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(() => restoredDraft.aiFilledFieldKeys.size > 0);
  const generateWithAI = async () => {
    if (sequence.length === 0) {
      toast.error('Select at least one image in the Images step first.');
      return;
    }
    setAiLoading(true);
    try {
      // Every aiFillable field across every subsection that currently has real fields defined for
      // the selected category (see resolveSubsectionFields).
      const aiFillableFields = SUBSECTIONS.flatMap((s) =>
        resolveSubsectionFields(s.key, selectedCategory)
          .filter((f) => f.aiFillable)
          .map((f) => ({ ...f, subsectionKey: s.key })),
      );
      if (aiFillableFields.length === 0) {
        toast.error('No AI-fillable fields yet in this template.');
        return;
      }
      const values = await listingStudioApi.fillAmazonListingFields(
        project.id,
        sequenceIds,
        aiFillableFields.map((f) => ({ key: f.key, label: f.label, options: f.options, hint: f.aiHint })),
      );
      setFillValues((prev) => {
        const next = { ...prev };
        for (const f of aiFillableFields) {
          if (values[f.key]) next[f.subsectionKey] = { ...next[f.subsectionKey], [f.key]: values[f.key] };
        }
        return next;
      });
      setAiFilledFields((prev) => {
        const next = new Set(prev);
        for (const f of aiFillableFields) {
          if (values[f.key]) next.add(`${f.subsectionKey}:${f.key}`);
        }
        return next;
      });
      setHasGeneratedOnce(true);
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setAiLoading(false);
    }
  };

  const pickCategory = (file) => {
    setJustPicked(file);
    // Product Details' fields (and field keys) are category-specific — a value left over from a
    // different category's fields would be stale/meaningless, so clear just that subsection's
    // answers on an actual category change. The rest (Listing Identity/Variations/Product
    // Identity) stay, since those are the same fields regardless of category.
    if (file !== selectedCategory) {
      setFillValues((prev) => ({ ...prev, productDetails: {} }));
    }
    setSelectedCategory(file);
    window.setTimeout(() => {
      setCurrentStep(1);
      setJustPicked(null);
    }, 350);
  };

  /** Moves an image to the front of the sequence (i.e. makes it the Main image), inserting it
   *  if it wasn't already selected — capped at MAX_IMAGES. */
  const setAsMain = (id) => {
    setSequenceIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_IMAGES));
  };

  /** Checkbox toggle for Secondary/Reference images — removes if already selected, otherwise
   *  adds unless the sequence is already at MAX_IMAGES (surfaces a brief notice instead of
   *  silently doing nothing). */
  const toggleInSequence = (id) => {
    setSequenceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_IMAGES) {
        setCapNotice(true);
        window.setTimeout(() => setCapNotice(false), 2000);
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeFromSequence = (id) => setSequenceIds((prev) => prev.filter((x) => x !== id));

  // Draft step: pulled live from fillValues, so it always reflects whatever's actually been
  // typed into Fill Details — "—" only when a field is genuinely still empty.
  const draftTitle = fillValues.productIdentity?.itemName || '';
  const draftSku = fillValues.listingIdentity?.sku || '';

  // Autosaves the wizard's progress onto the project (debounced) so a seller who closes and
  // reopens this modal — or comes back another day — never has to redo "Generate with AI" or
  // retype what they already filled in. Skips the very first render (nothing's changed yet) and
  // skips entirely until a category is chosen (nothing meaningful to save before that).
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!selectedCategory || !project?.id) return;
    const timer = setTimeout(() => {
      listingStudioApi
        .saveAmazonListingDraft(project.id, {
          categoryFile: selectedCategory,
          fillValues,
          aiFilledFieldKeys: Array.from(aiFilledFields),
          sequenceIds,
          variants: resolveVariantsForWire(variants, variantAttributeFields),
        })
        .then((updatedProject) => onProjectUpdate?.(updatedProject))
        .catch(() => {
          // Best-effort — a failed autosave just means the next edit retries; nothing to surface
          // to the seller mid-typing over what's otherwise a background convenience.
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedCategory, fillValues, aiFilledFields, sequenceIds, variants, variantAttributeFields, project?.id]);

  const [draftDownloading, setDraftDownloading] = useState(false);
  const downloadDraft = async () => {
    // Belt-and-suspenders: "Continue to Draft Review" already blocks getting here with a required
    // field still empty, but re-check anyway rather than trust that gate alone — send the seller
    // straight back to Fill Details (with the problem fields highlighted) instead of downloading
    // an incomplete file.
    const missing = findMissingRequiredFields();
    if (missing.length > 0) {
      setMissingRequiredFields(missing);
      const firstIdx = SUBSECTIONS.findIndex((s) => missing.some((m) => m.subsectionKey === s.key));
      if (firstIdx !== -1) setActiveSubsection(firstIdx);
      setCurrentStep(2);
      return;
    }
    setDraftDownloading(true);
    try {
      const payload = buildAmazonListingPayload({
        categoryFile: selectedCategory,
        title: draftTitle,
        sku: draftSku,
        fillValues,
        variants: resolveVariantsForWire(variants, variantAttributeFields),
      });
      await listingStudioApi.downloadAmazonListingDraft(project.id, {
        ...payload,
        images: sequence.map((img) => ({ url: img.path, role: img.role || '' })),
      });
      setCurrentStep(4);
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setDraftDownloading(false);
    }
  };

  /** Same sanitization the backend applies to the project name for the downloaded filename —
   *  kept in sync so the Done screen's file chip shows exactly what was actually saved. */
  const draftFilename = `${(project.input.name || 'listing').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_'-]/g, '') || 'listing'}.xlsx`;

  // ---- Draft history ("draft history / duplicate listing") ----
  // Every successful download (server-side, see routes.js's recordDraftHistory) appends a full
  // snapshot onto project.amazonListingDraftHistory. This is purely display + two actions on top
  // of that — nothing here is ever read by the autosave effect above, so none of this state
  // belongs in its dependency array (history is already persisted by the download route itself).
  const draftHistory = project?.amazonListingDraftHistory || [];
  const [showHistory, setShowHistory] = useState(false);
  const [historyDownloadingId, setHistoryDownloadingId] = useState(null);

  /** "Download again" — rebuilds the exact same download payload from a past snapshot (never the
   *  live wizard state) using the same buildAmazonListingPayload helper the live Draft step uses,
   *  so the two can't drift on how fillValues get flattened into the server's fields[] shape. */
  const handleDownloadAgain = async (entry) => {
    setHistoryDownloadingId(entry.id);
    try {
      const payload = buildAmazonListingPayload({
        categoryFile: entry.categoryFile,
        categoryName: entry.categoryName,
        title: entry.title,
        sku: entry.sku,
        fillValues: entry.fillValues,
        variants: entry.variants, // already the server's {sku, overrides} wire shape
      });
      const images = (entry.sequenceIds || [])
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((img) => ({ url: img.path, role: img.role || '' }));
      await listingStudioApi.downloadAmazonListingDraft(project.id, { ...payload, images });
    } catch {
      // The shared axios instance's response interceptor already shows a toast for this.
    } finally {
      setHistoryDownloadingId(null);
    }
  };

  /** "Use as new listing" — restores a past snapshot into the live editable wizard state (same
   *  rehydration hydrateDraftState already does at mount for the in-progress draft), then clears
   *  just the SKU (a duplicate almost always needs its own) and jumps to Fill Details so the
   *  seller lands right where they can see/adjust it. Purely client-side: the existing debounced
   *  autosave effect persists this restored state back onto project.amazonListingDraft on its own,
   *  no extra server round-trip needed here. */
  const applyHistoryEntryAsNewListing = (entry) => {
    const hydrated = hydrateDraftState(entry, byId);
    setSelectedCategory(hydrated.selectedCategory);
    setFillValues({
      ...hydrated.fillValues,
      listingIdentity: { ...(hydrated.fillValues.listingIdentity || {}), sku: '' },
    });
    setAiFilledFields(hydrated.aiFilledFieldKeys);
    setSequenceIds(hydrated.sequenceIds);
    setVariants(hydrated.variants);
    setHasGeneratedOnce(hydrated.aiFilledFieldKeys.size > 0);
    setMissingRequiredFields([]);
    setActiveSubsection(0);
    setShowHistory(false);
    setCurrentStep(2);
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-start gap-3 pr-8 mb-4">
        <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white grid place-items-center flex-shrink-0 shadow-[0_4px_14px_-2px_rgba(16,185,129,0.45)]">
          <FileSpreadsheet size={21} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900">Create Amazon Listing</h2>
            {selectedCategory && (
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                {selectedCategory}
              </span>
            )}
            {draftHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  showHistory
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/50'
                }`}
              >
                <Clock size={12} />
                History
                <span className={showHistory ? 'text-brand-400' : 'text-slate-400'}>({draftHistory.length})</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Exact copy of Amazon Seller Central template preserving macros, sheet layout, and validations.
          </p>
        </div>
      </div>

      {showHistory && draftHistory.length > 0 && (
        <div className={`${CARD} !mb-4 max-h-72 overflow-y-auto animate-zoomIn`}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 grid place-items-center flex-shrink-0">
                <Clock size={11} />
              </span>
              Past downloads
            </h4>
            <button
              type="button"
              aria-label="Close history"
              onClick={() => setShowHistory(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {draftHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2.5 transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center flex-shrink-0">
                    <FileSpreadsheet size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{entry.title || '(untitled)'}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {entry.categoryName || entry.categoryFile} · SKU {entry.sku || '—'} · {formatHistoryDate(entry.downloadedAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    className={`${BTN} ${BTN_SMALL}`}
                    disabled={historyDownloadingId === entry.id}
                    onClick={() => handleDownloadAgain(entry)}
                  >
                    <Download size={13} />
                    {historyDownloadingId === entry.id ? 'Downloading…' : 'Download again'}
                  </button>
                  <button
                    type="button"
                    className={`${BTN_SMALL} inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 font-medium text-brand-700 transition-colors hover:bg-brand-100 hover:border-brand-300`}
                    onClick={() => applyHistoryEntryAsNewListing(entry)}
                  >
                    <Copy size={13} />
                    Use as new listing
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-4 mb-4 border-b border-slate-100">
        <StepIndicator steps={STEPS} currentStep={currentStep} />
      </div>

      <div>
        {currentStep === 0 && (
          <>
            <h3 className="text-base font-semibold text-slate-900 text-center">What kind of product is this?</h3>
            <p className="text-sm text-slate-500 text-center mt-1 mb-5 max-w-lg mx-auto">
              Each category uses Amazon's exact official template — the fields you'll fill in are different depending on
              what you pick.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {CATEGORIES.map((cat) => {
                const picked = justPicked === cat.file;
                return (
                  <button
                    key={cat.file}
                    type="button"
                    onClick={() => pickCategory(cat.file)}
                    className={`${CARD} hover-lift !mb-0 w-full text-left relative transition-all hover:border-brand-400 hover:shadow-card-hover ${
                      picked ? 'border-brand-600 shadow-[0_0_0_2px_rgba(2,132,199,0.15)]' : ''
                    }`}
                  >
                    {picked && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-600 text-white grid place-items-center animate-zoomIn">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                    <div className="font-semibold text-slate-900 text-sm">{cat.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{cat.file}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {currentStep === 1 && (
          <>
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center flex-shrink-0">
                  <ImageIcon size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Select &amp; Order Amazon Product Images</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select up to {MAX_IMAGES} images. The first image will be set as your Amazon <strong>Main Image</strong> (Col U).
                  </p>
                </div>
              </div>
              <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-600">
                {sequence.length} of {MAX_IMAGES} Selected
              </span>
            </div>

            {capNotice && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle size={13} className="flex-shrink-0" /> You've selected {MAX_IMAGES} images already — remove one below before adding another.
              </p>
            )}

            <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-3.5 mb-6 shadow-sm">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600 mb-2.5">
                <Sparkles size={12} /> Amazon Image Upload Sequence
              </h4>
              {sequence.length === 0 ? (
                <p className="text-xs text-slate-500">No images selected yet — pick images from the sections below to get started.</p>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {sequence.map((img, i) => (
                    <div
                      key={img.id}
                      className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 ${
                        i === 0 ? 'border-amber-400' : 'border-slate-200'
                      }`}
                    >
                      <img src={img.path} alt="" className="w-full h-full object-cover" />
                      <span
                        className={`absolute top-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          i === 0 ? 'bg-amber-400 text-white' : 'bg-slate-900/70 text-white'
                        }`}
                      >
                        {i === 0 ? '★ Main' : `#${i + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAsMain(img.id)}
                        aria-label="Set as main image"
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 text-slate-400 grid place-items-center hover:text-amber-500"
                      >
                        <Star size={11} fill={i === 0 ? 'currentColor' : 'none'} className={i === 0 ? 'text-amber-400' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromSequence(img.id)}
                        aria-label="Remove from sequence"
                        className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/90 text-slate-400 grid place-items-center hover:text-red-600"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ImagePickerSection
              icon={Star}
              title="Main Image"
              hint="pick exactly one"
              images={mainCandidates}
              emptyText="No main-image candidates yet — generate images on the Images tab first."
              selectedIds={new Set(sequenceIds[0] ? [sequenceIds[0]] : [])}
              onToggle={setAsMain}
              mode="radio"
            />

            <ImagePickerSection
              icon={Layers}
              title="Secondary Images"
              hint={`select up to ${MAX_IMAGES}`}
              images={secondaryCandidates}
              emptyText="No secondary images yet — generate images on the Images tab first."
              selectedIds={new Set(sequenceIds)}
              onToggle={toggleInSequence}
              mode="checkbox"
              atCap={sequenceIds.length >= MAX_IMAGES}
            />

            <ImagePickerSection
              icon={Camera}
              title="Reference Images"
              hint={`select up to ${MAX_IMAGES}`}
              images={referenceCandidates}
              emptyText="No reference photos were uploaded for this campaign."
              selectedIds={new Set(sequenceIds)}
              onToggle={toggleInSequence}
              mode="checkbox"
              atCap={sequenceIds.length >= MAX_IMAGES}
            />

            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                className={BTN}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                disabled={sequence.length === 0}
                onClick={() => setCurrentStep(2)}
                className={BTN_PRIMARY}
              >
                Continue to Listing Details
              </button>
            </div>
          </>
        )}

        {currentStep === 2 &&
          (() => {
            const subsection = SUBSECTIONS[activeSubsection];
            const fields = resolveSubsectionFields(subsection.key, selectedCategory);
            const nextSubsection = SUBSECTIONS[activeSubsection + 1];
            const renderFieldGrid = (fieldList) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                {fieldList.map((field) => (
                  <FillField
                    key={field.key}
                    field={field}
                    value={fillValues[subsection.key]?.[field.key] ?? ''}
                    onChange={(v) => updateFillValue(subsection.key, field.key, v)}
                    aiGenerated={aiFilledFields.has(`${subsection.key}:${field.key}`)}
                    missing={missingRequiredFields.find((m) => m.subsectionKey === subsection.key && m.fieldKey === field.key)?.reason}
                  />
                ))}
              </div>
            );
            const fieldGroups = SUBSECTION_FIELD_GROUPS[subsection.key];
            return (
              <>
                <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 mb-5 flex items-start justify-between gap-4 flex-wrap shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-white grid place-items-center flex-shrink-0 shadow-[0_2px_8px_-1px_rgba(2,132,199,0.5)]">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        Generate title, bullet points, description &amp; keywords with AI
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                        Reads your selected reference images and campaign details to fill every content field below —
                        across every subsection. Mandatory fields (SKU, pricing, dimensions, contact info, etc.) are
                        always filled by you.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateWithAI}
                    disabled={aiLoading}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-sm"
                  >
                    {hasGeneratedOnce ? <RefreshCw size={14} /> : <Sparkles size={14} />}
                    {aiLoading ? 'Generating…' : hasGeneratedOnce ? 'Regenerate with AI' : 'Generate with AI'}
                  </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5">
                  {SUBSECTIONS.map((s, i) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setActiveSubsection(i)}
                      title={s.shortLabel ? s.label : undefined}
                      className={`relative flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                        i === activeSubsection
                          ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-[0_2px_10px_-2px_rgba(2,132,199,0.5)]'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600'
                      }`}
                    >
                      <Tag size={13} /> {s.shortLabel || s.label}
                      {missingRequiredFields.some((m) => m.subsectionKey === s.key) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                      )}
                    </button>
                  ))}
                </div>

                {missingRequiredFields.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-2">
                      <AlertTriangle size={15} className="flex-shrink-0" /> Fix these fields before continuing:
                    </p>
                    <ul className="space-y-1">
                      {missingRequiredFields.map((m) => (
                        <li key={`${m.subsectionKey}:${m.fieldKey}`} className="text-xs text-red-600">
                          •[{m.subsectionLabel}] '{m.fieldLabel}' {m.reason}.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={`${CARD} !mb-0`}>
                  <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                    <h3 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
                      <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 grid place-items-center flex-shrink-0">
                        <Tag size={14} />
                      </span>
                      {subsection.label}
                    </h3>
                    {fields && (
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1 flex-shrink-0">
                        {fields.length} field{fields.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  {!fields || fields.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Fields for this subsection haven't been defined yet — tell me what belongs here.
                    </p>
                  ) : !fieldGroups ? (
                    renderFieldGrid(fields)
                  ) : (
                    (() => {
                      const byKey = new Map(fields.map((f) => [f.key, f]));
                      const used = new Set();
                      const groupSections = fieldGroups
                        .map((g) => {
                          const groupFields = g.keys.map((k) => byKey.get(k)).filter(Boolean);
                          groupFields.forEach((f) => used.add(f.key));
                          if (groupFields.length === 0) return null;
                          return (
                            <div key={g.label} className="mb-6 last:mb-0">
                              <h5 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3">{g.label}</h5>
                              {renderFieldGrid(groupFields)}
                            </div>
                          );
                        })
                        .filter(Boolean);
                      const leftover = fields.filter((f) => !used.has(f.key));
                      return (
                        <>
                          {groupSections}
                          {leftover.length > 0 && renderFieldGrid(leftover)}
                        </>
                      );
                    })()
                  )}

                  {subsection.key === 'variations' && fillValues.variations?.parentageLevel === 'Parent' && (
                    <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/30 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="w-7 h-7 rounded-lg bg-brand-100 text-brand-600 grid place-items-center flex-shrink-0">
                            <Layers size={14} />
                          </span>
                          Child Variants
                        </h4>
                        {variants.length > 0 && (
                          <span className="text-xs font-medium text-brand-700 bg-white border border-brand-200 rounded-full px-2.5 py-1">
                            {variants.length} variant{variants.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>

                      {!fillValues.variations?.variationTheme ? (
                        <p className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <AlertTriangle size={13} className="flex-shrink-0" /> Pick a Variation Theme above first.
                        </p>
                      ) : (
                        <>
                          {variantAttributeFields.some(({ field }) => !field) && (
                            <p className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                              <HelpCircle size={12} className="flex-shrink-0 mt-0.5" />
                              This category doesn't define{' '}
                              {variantAttributeFields
                                .filter(({ field }) => !field)
                                .map(({ key }) => humanizeAttributeKey(key))
                                .join(', ')}{' '}
                              — variants will only track SKU.
                            </p>
                          )}

                          {missingRequiredFields.some((m) => m.subsectionKey === 'variations' && m.fieldKey === 'variants') && (
                            <p className="flex items-center gap-1.5 text-xs text-red-600 mb-3">
                              <AlertTriangle size={13} className="flex-shrink-0" /> At least one variant with a SKU is required.
                            </p>
                          )}

                          {variants.length > 0 && (
                            <div className="space-y-2.5 mb-3">
                              {variants.map((variant, i) => (
                                <div
                                  key={variant.id}
                                  className="flex items-end gap-2.5 flex-wrap rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-card-hover"
                                >
                                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold grid place-items-center mb-2">
                                    {i + 1}
                                  </span>
                                  <div className="min-w-[140px] flex-1">
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">SKU</label>
                                    <input
                                      type="text"
                                      value={variant.sku}
                                      onChange={(e) => updateVariantSku(variant.id, e.target.value)}
                                      placeholder="e.g. abc123-red-m"
                                      className={FILL_FIELD_INPUT_CLASS}
                                    />
                                  </div>
                                  {variantAttributeFields.map(({ key, field }) =>
                                    field ? (
                                      <div key={key} className="min-w-[140px] flex-1">
                                        <label className="block text-[11px] font-medium text-slate-500 mb-1">{field.label}</label>
                                        {field.type === 'select' ? (
                                          <select
                                            value={variant.attrs?.[key] || ''}
                                            onChange={(e) => updateVariantAttr(variant.id, key, e.target.value)}
                                            className={FILL_FIELD_INPUT_CLASS}
                                          >
                                            <option value="">-- Select {field.label} --</option>
                                            {field.options.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type={field.type === 'number' ? 'number' : 'text'}
                                            value={variant.attrs?.[key] || ''}
                                            onChange={(e) => updateVariantAttr(variant.id, key, e.target.value)}
                                            placeholder={field.placeholder}
                                            className={FILL_FIELD_INPUT_CLASS}
                                          />
                                        )}
                                      </div>
                                    ) : null,
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(variant.id)}
                                    aria-label="Remove variant"
                                    className="flex-shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-400 grid place-items-center transition-colors hover:border-red-300 hover:text-red-600"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <button type="button" onClick={addVariant} className={`${BTN} !bg-white`}>
                            <Plus size={14} /> Add Variant
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {nextSubsection && (
                    <div className="flex justify-end mt-5">
                      <button
                        type="button"
                        onClick={() => setActiveSubsection(activeSubsection + 1)}
                        className={BTN}
                      >
                        Next: {nextSubsection.label} <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className={BTN}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    onClick={goToDraftReview}
                    className={BTN_PRIMARY}
                  >
                    Continue to Draft Review <ChevronRight size={14} />
                  </button>
                </div>
              </>
            );
          })()}

        {currentStep === 3 && (
          <>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center flex-shrink-0">
                <FileSpreadsheet size={16} />
              </span>
              <h3 className="text-base font-semibold text-slate-900">Review your draft</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5 ml-[42px]">Confirm everything looks right, then download the Amazon-ready file.</p>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mb-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-500">Category</span>
                <span className="text-sm font-semibold text-slate-900">
                  {CATEGORIES.find((c) => c.file === selectedCategory)?.name || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-500">Title</span>
                <span className="text-sm font-semibold text-slate-900 text-right">{draftTitle || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-500">SKU</span>
                <span className="text-sm font-semibold text-slate-900 font-mono">{draftSku || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-slate-500">Images</span>
                <span className="text-sm font-semibold text-brand-600">{sequence.length} selected</span>
              </div>
              {variants.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-slate-500">Variants</span>
                  <span className="text-sm font-semibold text-brand-600">
                    +{variants.length} variant{variants.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={BTN}
              >
                <ArrowLeft size={14} /> Back to Details
              </button>
              <button
                type="button"
                onClick={downloadDraft}
                disabled={draftDownloading}
                className={BTN_PRIMARY}
              >
                <Download size={14} /> {draftDownloading ? 'Preparing…' : 'Download XLSM File'}
              </button>
            </div>
          </>
        )}

        {currentStep === 4 && (
          <>
            <div className="flex flex-col items-center text-center py-2">
              <span className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white grid place-items-center mb-4 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.55)] animate-zoomIn">
                <CheckCircle2 size={36} />
              </span>
              <h3 className="text-xl font-semibold text-slate-900 mb-1.5">Amazon XLSM Listing Ready!</h3>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                Your file has been generated and downloaded to your computer.
              </p>

              <div className="w-full rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white p-4 mb-4 text-left space-y-2.5 shadow-sm">
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  Listing information and descriptive attributes completed
                </p>
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  Fill Details fields carried over as entered
                </p>
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  {sequence.length} campaign image{sequence.length === 1 ? '' : 's'} mapped to the Images sheet
                </p>
                {variants.length > 0 && (
                  <p className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    +{variants.length} child variant{variants.length === 1 ? '' : 's'} written as additional rows
                  </p>
                )}
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  Built against the {CATEGORIES.find((c) => c.file === selectedCategory)?.name || selectedCategory} ({selectedCategory}) template
                </p>
              </div>

              <div className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 mb-2 shadow-sm">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center flex-shrink-0">
                  <FileSpreadsheet size={16} />
                </span>
                <span className="text-sm text-slate-700 font-mono truncate flex-1 text-left">{draftFilename}</span>
                <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">.xlsx Workbook</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={downloadDraft}
                disabled={draftDownloading}
                className={BTN}
              >
                <Download size={14} /> {draftDownloading ? 'Preparing…' : 'Download Again'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-transparent bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-semibold text-white shadow-[0_2px_10px_-2px_rgba(16,185,129,0.45)] transition-all hover:shadow-[0_6px_18px_-2px_rgba(16,185,129,0.5)] hover:-translate-y-0.5"
              >
                Done &amp; Close
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

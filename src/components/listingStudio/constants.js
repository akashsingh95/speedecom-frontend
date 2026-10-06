// Mirrors server/listingStudio/types.js's IMAGE_MODELS catalog — kept in sync manually,
// same as speed-listing's own frontend/backend types.ts pair (no shared package).

// Mirrors server/listingStudio/routes/shared/upload.js's multer limits.
export const MAX_UPLOAD_FILES = 10;
export const MAX_UPLOAD_FILE_SIZE_MB = 15;

export const IMAGE_MODELS = [
  { id: 'openai:gpt-image-1', label: 'OpenAI — GPT Image 1', provider: 'openai', description: 'Moderate cost, high quality' },
  { id: 'openai:gpt-image-1-mini', label: 'OpenAI — GPT Image 1 Mini', provider: 'openai', description: 'Low cost, moderate quality' },
  { id: 'openai:gpt-image-2', label: 'OpenAI — GPT Image 2', provider: 'openai', description: 'High cost, highest quality' },
  { id: 'openai:gpt-image-2.5-flare', label: 'OpenAI — GPT Image 2.5', provider: 'openai', description: 'Lower cost, highest quality' },
  { id: 'openai:gpt-image-2.5-sunburst', label: 'OpenAI — GPT Image 2.5 Sunburst', provider: 'openai', description: 'Precision detail, highest quality' },
  { id: 'gemini:gemini-2.5-flash-image', label: 'Gemini — Nano Banana', provider: 'gemini', description: 'Low cost, moderate quality' },
  { id: 'gemini:gemini-3.1-flash-lite-image', label: 'Gemini — Nano Banana 2 Lite', provider: 'gemini', description: 'Lowest cost, low quality' },
  { id: 'gemini:gemini-3.1-flash-image', label: 'Gemini — Nano Banana 2', provider: 'gemini', description: 'Moderate cost, high quality' },
];

export const DEFAULT_IMAGE_MODEL = 'openai:gpt-image-2.5-sunburst';

export const SHOW_IMAGE_MODEL_PICKER = false;

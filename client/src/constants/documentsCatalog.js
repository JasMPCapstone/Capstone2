/**
 * Document type and tag catalogs for upload UI.
 * Keep in sync with `lib/services/documentsList.js` (DOCUMENT_TYPES + TAG_LABELS).
 */
export const DOCUMENT_TYPES = [
  'Facility Accreditation Certificate',
  'Procurement Policy',
  'Floor Plan',
  'Inventory Report',
  'Compliance Certificate',
  'Other',
];

/** { slug, label } — slugs are stored lowercase in the database. */
export const DOCUMENT_TAG_OPTIONS = [
  { slug: 'compliance', label: 'Compliance' },
  { slug: 'inventory', label: 'Inventory' },
  { slug: 'accreditation', label: 'Accreditation' },
  { slug: 'safety', label: 'Safety' },
  { slug: 'quality', label: 'Quality' },
  { slug: 'procurement', label: 'Procurement' },
  { slug: 'regulatory', label: 'Regulatory' },
  { slug: 'financial', label: 'Financial' },
  { slug: 'other', label: 'Other' },
];

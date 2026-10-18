import { apiBlob } from './api';

/** Hospital verification documents (server: utils/documents.ts). */
export type DocumentKind = 'registration_certificate' | 'authorisation_letter' | 'blood_centre_licence';

export interface StoredDocument {
  kind: DocumentKind;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export const DOCUMENTS: { kind: DocumentKind; label: string; required: boolean; hint: string }[] = [
  {
    kind: 'registration_certificate',
    label: 'Registration certificate',
    required: true,
    hint: "Your hospital's registration under the Clinical Establishments Act or your state's own act (for example a nursing home registration). It must show the hospital's name and address and still be valid.",
  },
  {
    kind: 'authorisation_letter',
    label: 'Authorisation letter',
    required: true,
    hint: "On hospital letterhead, signed and stamped by the medical superintendent, director or owner. It names the staff member who manages LifeLink for the hospital.",
  },
  {
    kind: 'blood_centre_licence',
    label: 'Blood centre licence',
    required: false,
    hint: 'Only if your hospital runs a blood centre: its licence from the State Drugs Control authority (Form 28-C under the Drugs and Cosmetics Rules).',
  },
];

export const documentLabel = (kind: string) => DOCUMENTS.find((d) => d.kind === kind)?.label ?? kind;

const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const ACCEPT = TYPES.join(',');

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export const typeLabel = (type: string) => (type === 'application/pdf' ? 'PDF' : type.replace('image/', '').toUpperCase());

/**
 * Photos straight from a phone camera are often several MB. Large images are
 * scaled down (longest side 2000 px) and saved as JPEG, which keeps text
 * readable and drops the photo's metadata. PDFs are sent as they are.
 */
const shrinkImage = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize the photo. Try a smaller file.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo.'))), 'image/jpeg', 0.85));
};

/** The file to upload (resized if it is a big photo), or an Error saying what is wrong. */
export const prepareDocument = async (file: File): Promise<Blob> => {
  if (!TYPES.includes(file.type)) throw new Error('Choose a PDF, or a photo or scan as JPG, PNG or WebP.');
  if (file.type.startsWith('image/') && file.size > 1.5 * 1024 * 1024) {
    const smaller = await shrinkImage(file);
    if (smaller.size < file.size) return smaller;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(file.type === 'application/pdf'
      ? `This PDF is ${formatSize(file.size)}. The limit is 3 MB: scan it at a lower resolution or upload a photo instead.`
      : 'This photo is too large even after resizing. Try a smaller one.');
  }
  return file;
};

/**
 * Reads a document with the page's session and returns a local link to it.
 * The type comes from our own list, never from the response, so the browser
 * only ever shows it as a PDF or an image.
 */
export const openDocument = async (endpoint: string, contentType: string): Promise<{ url: string; blob: Blob }> => {
  if (!TYPES.includes(contentType)) throw new Error('This document cannot be shown.');
  const blob = new Blob([await apiBlob(endpoint)], { type: contentType });
  return { url: URL.createObjectURL(blob), blob };
};

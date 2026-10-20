/**
 * Test photos are shrunk in the browser before upload (plan §4.4): long edge at most 2,576 px,
 * the most Opus 5.5 reads at full resolution, re-encoded as JPEG at quality 0.9 (the old demo
 * used 1,000 px / 0.75 and misread digits). Re-encoding also applies the EXIF orientation and
 * drops the rest of the EXIF data (GPS) before anything leaves the phone.
 *
 * HEIC: the file input only accepts JPEG/PNG/WebP/GIF, so iOS Safari converts library photos to
 * JPEG itself. A HEIC file that still arrives (desktop browsers, file managers) is refused with
 * a message saying how to convert it.
 */

export const TEST_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const TEST_IMAGE_MAX_EDGE = 2576;
export const TEST_IMAGE_JPEG_QUALITY = 0.9;
/** Refuse absurd inputs before decoding them (a 48 MP phone photo is about 25 MB). */
export const TEST_IMAGE_MAX_INPUT_BYTES = 40 * 1024 * 1024;
/** Same limit as the database (session_test_assets_page_check). */
export const TEST_PAGES_MAX = 20;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

export const HEIC_REFUSED_MESSAGE =
  "Ảnh HEIC (định dạng ảnh iPhone) chưa đọc được trên trình duyệt này. Trên iPhone, chọn ảnh từ Thư viện ảnh để máy tự đổi sang JPEG; trên máy tính, đổi ảnh sang JPEG rồi tải lại.";

export type TestImageCheck = { message: string; ok: false } | { ok: true };

export function checkTestImageFile(file: { name: string; size: number; type: string }): TestImageCheck {
  const type = file.type.toLowerCase();
  if (HEIC_TYPES.has(type) || HEIC_EXTENSIONS.test(file.name)) return { message: HEIC_REFUSED_MESSAGE, ok: false };
  if (!ACCEPTED_TYPES.has(type) && !(type === "" && ACCEPTED_EXTENSIONS.test(file.name))) {
    return { message: "Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF.", ok: false };
  }
  if (file.size > TEST_IMAGE_MAX_INPUT_BYTES) return { message: "Ảnh quá lớn (tối đa 40 MB trước khi thu nhỏ).", ok: false };
  if (file.size === 0) return { message: "Tệp ảnh rỗng.", ok: false };
  return { ok: true };
}

/** Scale down so the long edge fits; never scale up. */
export function fitWithinLongEdge(width: number, height: number, maxEdge = TEST_IMAGE_MAX_EDGE): { height: number; width: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { height, width };
  const scale = maxEdge / longEdge;
  return { height: Math.max(1, Math.round(height * scale)), width: Math.max(1, Math.round(width * scale)) };
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface PreparedTestImage {
  blob: Blob;
  height: number;
  mimeType: "image/jpeg";
  sha256: string;
  width: number;
}

export class TestImageError extends Error {}

export interface DecodedImage {
  close?: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
}

/** Browser seams, replaced in tests (jsdom has no image decoder or canvas). */
export interface TestImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encodeJpeg(image: DecodedImage, size: { height: number; width: number }, quality: number): Promise<Blob>;
}

export const browserTestImageCodec: TestImageCodec = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { close: () => bitmap.close(), height: bitmap.height, source: bitmap, width: bitmap.width };
  },
  async encodeJpeg(image, size, quality) {
    const canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(size.width, size.height)
        : Object.assign(document.createElement("canvas"), { height: size.height, width: size.width });
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new TestImageError("Trình duyệt không xử lý được ảnh.");
    // Transparent PNG/GIF areas would turn black in a JPEG; paper is white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, size.width, size.height);
    if (canvas instanceof HTMLCanvasElement) {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new TestImageError("Không nén được ảnh."))), "image/jpeg", quality);
      });
    }
    return canvas.convertToBlob({ quality, type: "image/jpeg" });
  },
};

/** Decode, shrink to the long-edge limit, re-encode as JPEG 0.9 and hash the result. */
export async function prepareTestImage(file: Blob, codec: TestImageCodec = browserTestImageCodec): Promise<PreparedTestImage> {
  let image: DecodedImage;
  try {
    image = await codec.decode(file);
  } catch {
    throw new TestImageError("Không đọc được ảnh (tệp hỏng hoặc trình duyệt không hỗ trợ định dạng này).");
  }
  try {
    const size = fitWithinLongEdge(image.width, image.height);
    const blob = await codec.encodeJpeg(image, size, TEST_IMAGE_JPEG_QUALITY);
    const sha256 = await sha256Hex(await blob.arrayBuffer());
    return { blob, height: size.height, mimeType: "image/jpeg", sha256, width: size.width };
  } finally {
    image.close?.();
  }
}

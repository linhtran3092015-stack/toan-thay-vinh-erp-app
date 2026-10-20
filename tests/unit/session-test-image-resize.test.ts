// Value: protects=test photos are checked and shrunk in the browser before upload: JPEG/PNG/WebP/GIF only, HEIC refused (by type or extension) with the conversion hint, absurd or empty files refused, the long edge capped at 2,576 px without upscaling, re-encoded as JPEG at quality 0.9, hashed (sha256 of the uploaded bytes) and the decoded bitmap released even when encoding fails;
// fails_when=a HEIC file slips through to a decoder that cannot read it, a portrait photo is scaled on the wrong edge, small photos are upscaled, quality/size drift from the plan (2576 / 0.9), the hash is of the original instead of the uploaded JPEG, or a decode error leaks a raw exception;
// why_new=new upload helper for "Bài kiểm tra";
// seam=the image codec (jsdom has no decoder or canvas); no_claim=does not prove a real browser's canvas output or iOS Safari's HEIC conversion
import { describe, expect, it, vi } from "vitest";

import {
  HEIC_REFUSED_MESSAGE,
  TEST_IMAGE_JPEG_QUALITY,
  TEST_IMAGE_MAX_EDGE,
  TestImageError,
  checkTestImageFile,
  fitWithinLongEdge,
  prepareTestImage,
  sha256Hex,
  type TestImageCodec,
} from "@/features/session-tests/image-resize";

describe("checkTestImageFile", () => {
  it("accepts the four web image types, also by extension when the type is missing", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(checkTestImageFile({ name: "de", size: 10, type })).toEqual({ ok: true });
    }
    expect(checkTestImageFile({ name: "trang-1.JPG", size: 10, type: "" })).toEqual({ ok: true });
  });

  it("refuses HEIC by type or extension with a way out", () => {
    expect(checkTestImageFile({ name: "IMG_0001.jpg", size: 10, type: "image/heic" })).toEqual({ message: HEIC_REFUSED_MESSAGE, ok: false });
    expect(checkTestImageFile({ name: "IMG_0001.HEIF", size: 10, type: "" })).toEqual({ message: HEIC_REFUSED_MESSAGE, ok: false });
    expect(HEIC_REFUSED_MESSAGE).toContain("JPEG");
  });

  it("refuses other types, empty files and files over 40 MB", () => {
    expect(checkTestImageFile({ name: "de.pdf", size: 10, type: "application/pdf" })).toEqual({ message: "Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF.", ok: false });
    expect(checkTestImageFile({ name: "de.jpg", size: 0, type: "image/jpeg" })).toEqual({ message: "Tệp ảnh rỗng.", ok: false });
    expect(checkTestImageFile({ name: "de.jpg", size: 41 * 1024 * 1024, type: "image/jpeg" }).ok).toBe(false);
  });
});

describe("fitWithinLongEdge", () => {
  it("caps the long edge at 2,576 px for landscape and portrait photos", () => {
    expect(TEST_IMAGE_MAX_EDGE).toBe(2576);
    expect(fitWithinLongEdge(4032, 3024)).toEqual({ height: 1932, width: 2576 });
    expect(fitWithinLongEdge(3024, 4032)).toEqual({ height: 2576, width: 1932 });
  });

  it("never upscales", () => {
    expect(fitWithinLongEdge(1200, 900)).toEqual({ height: 900, width: 1200 });
    expect(fitWithinLongEdge(2576, 10)).toEqual({ height: 10, width: 2576 });
  });

  it("keeps at least one pixel on a very thin image", () => {
    expect(fitWithinLongEdge(100000, 1)).toEqual({ height: 1, width: 2576 });
  });
});

describe("prepareTestImage", () => {
  function codec(overrides: Partial<TestImageCodec> = {}) {
    const close = vi.fn();
    const encoded = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    const fake: TestImageCodec = {
      decode: vi.fn(async () => ({ close, height: 3024, source: {} as CanvasImageSource, width: 4032 })),
      encodeJpeg: vi.fn(async () => encoded),
      ...overrides,
    };
    return { close, encoded, fake };
  }

  it("shrinks to 2576 px, encodes JPEG 0.9 and hashes the uploaded bytes", async () => {
    const { close, encoded, fake } = codec();
    const result = await prepareTestImage(new Blob(["original"]), fake);
    expect(fake.encodeJpeg).toHaveBeenCalledWith(expect.objectContaining({ width: 4032 }), { height: 1932, width: 2576 }, TEST_IMAGE_JPEG_QUALITY);
    expect(TEST_IMAGE_JPEG_QUALITY).toBe(0.9);
    expect(result).toEqual({
      blob: encoded,
      height: 1932,
      mimeType: "image/jpeg",
      sha256: await sha256Hex(await encoded.arrayBuffer()),
      width: 2576,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("turns a decode failure into a readable error", async () => {
    const { fake } = codec({ decode: vi.fn(async () => Promise.reject(new Error("InvalidStateError"))) });
    await expect(prepareTestImage(new Blob(["x"]), fake)).rejects.toThrow(TestImageError);
    await expect(prepareTestImage(new Blob(["x"]), fake)).rejects.toThrow("Không đọc được ảnh");
  });

  it("releases the decoded bitmap when encoding fails", async () => {
    const { close, fake } = codec({ encodeJpeg: vi.fn(async () => Promise.reject(new TestImageError("Không nén được ảnh."))) });
    await expect(prepareTestImage(new Blob(["x"]), fake)).rejects.toThrow("Không nén được ảnh.");
    expect(close).toHaveBeenCalledOnce();
  });

  it("hashes with sha256", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

// Core of «Have I seen this label before?» in the browser: preprocessing, DINOv2 embedding, 1-bit code search.
// Everything runs locally; the photo is never uploaded. Used by index.html and parity.html.
import { AutoModel, Tensor, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.allowLocalModels = false; // model files come from the Hugging Face CDN (cached by the browser after the first visit)

export const MODEL_ID = "Xenova/dinov2-base";
const SIZE = 224;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const MAX_SIDE = 2400; // larger photos are first reduced (same bicubic filter), to keep phones responsive

// ------------------------------------------------------------------ index
export async function loadIndex(base = "data/") {
  const get = async (f) => {
    const r = await fetch(base + f);
    if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
    return r;
  };
  const [meta, backs, mean, matrix, codes, windows] = await Promise.all([
    get("meta.json").then((r) => r.json()),
    get("backs.json").then((r) => r.json()),
    get("pca_mean.f32").then((r) => r.arrayBuffer()),
    get("pca_matrix.f32").then((r) => r.arrayBuffer()),
    get("codes.u8").then((r) => r.arrayBuffer()),
    get("windows.u16").then((r) => r.arrayBuffer()),
  ]);
  return {
    meta, backs, dims: meta.dims,
    mean: new Float32Array(mean), matrix: new Float32Array(matrix),
    codes: new Uint8Array(codes), windows: new Uint16Array(windows),
  };
}

// ------------------------------------------------------------------ model
export async function loadModel(onProgress = () => {}) {
  const files = {};
  const progress_callback = (p) => {
    if (p.status === "progress" && p.total) {
      files[p.file] = [p.loaded, p.total];
      const v = Object.values(files);
      onProgress(v.reduce((a, x) => a + x[0], 0), v.reduce((a, x) => a + x[1], 0));
    }
  };
  // WASM only, on purpose. Parity test (parity.html, 5 eval photos): fp16 on WASM gives cosine 0.9993-0.9996 to the
  // PyTorch vectors, but fp16 on WebGPU only 0.88-0.96 (it computes in half precision) and the top 20 drift.
  // q4 gives 0.95-0.97 on both backends; fp32 (347 MB) would be needed for WebGPU and is too big for phones.
  // ?device=webgpu forces WebGPU for experiments.
  const forced = new URLSearchParams(location.search).get("device");
  const devices = forced ? [forced, "wasm"] : ["wasm"];
  let lastErr;
  for (const device of devices) {
    try {
      const model = await AutoModel.from_pretrained(MODEL_ID, { dtype: "fp16", device, progress_callback });
      // one warm-up run so that a broken backend falls back here and not during the search
      await model({ pixel_values: new Tensor("float32", new Float32Array(3 * SIZE * SIZE), [1, 3, SIZE, SIZE]) });
      return { model, device };
    } catch (e) {
      console.warn(`model on ${device} failed`, e);
      lastErr = e;
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------------ preprocessing (same as embeddings.py)
// PIL's bicubic resampling (Pillow ImagingResample, a = -0.5, antialiased, 22-bit fixed point, two passes
// with an 8-bit intermediate), reimplemented so that the browser input equals the Python input.
const PREC = 22;
function bicubic(x) {
  const a = -0.5;
  if (x < 0) x = -x;
  if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
  return 0;
}
function coeffs(inSize, outSize) {
  const scale = inSize / outSize;
  const fscale = Math.max(scale, 1);
  const support = 2 * fscale;
  const bounds = new Int32Array(outSize * 2);
  const ks = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5); if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5); if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    const k = new Float64Array(xmax);
    let ww = 0;
    for (let x = 0; x < xmax; x++) { k[x] = bicubic((x + xmin - center + 0.5) / fscale); ww += k[x]; }
    const ki = new Int32Array(xmax);
    for (let x = 0; x < xmax; x++) {
      const v = ww !== 0 ? k[x] / ww : k[x];
      ki[x] = v < 0 ? Math.trunc(-0.5 + v * (1 << PREC)) : Math.trunc(0.5 + v * (1 << PREC));
    }
    bounds[2 * xx] = xmin; bounds[2 * xx + 1] = xmax; ks.push(ki);
  }
  return { bounds, ks };
}
const clip8 = (ss) => { const v = Math.floor(ss / (1 << PREC)); return v < 0 ? 0 : v > 255 ? 255 : v; };

// src: Uint8 RGB (3 bytes per pixel), w x h -> Uint8 RGB, W x H
export function resizeBicubic(src, w, h, W, H) {
  let cur = src, cw = w;
  if (W !== w) {
    const { bounds, ks } = coeffs(w, W);
    const out = new Uint8Array(W * h * 3);
    for (let y = 0; y < h; y++) {
      const row = y * w * 3;
      for (let xx = 0; xx < W; xx++) {
        const xmin = bounds[2 * xx], n = bounds[2 * xx + 1], k = ks[xx];
        let r = 1 << (PREC - 1), g = r, b = r;
        for (let x = 0; x < n; x++) {
          const p = row + (xmin + x) * 3, kk = k[x];
          r += src[p] * kk; g += src[p + 1] * kk; b += src[p + 2] * kk;
        }
        const o = (y * W + xx) * 3;
        out[o] = clip8(r); out[o + 1] = clip8(g); out[o + 2] = clip8(b);
      }
    }
    cur = out; cw = W;
  }
  if (H !== h) {
    const { bounds, ks } = coeffs(h, H);
    const out = new Uint8Array(cw * H * 3);
    for (let yy = 0; yy < H; yy++) {
      const ymin = bounds[2 * yy], n = bounds[2 * yy + 1], k = ks[yy];
      for (let x = 0; x < cw; x++) {
        let r = 1 << (PREC - 1), g = r, b = r;
        for (let y = 0; y < n; y++) {
          const p = ((ymin + y) * cw + x) * 3, kk = k[y];
          r += cur[p] * kk; g += cur[p + 1] * kk; b += cur[p + 2] * kk;
        }
        const o = (yy * cw + x) * 3;
        out[o] = clip8(r); out[o + 1] = clip8(g); out[o + 2] = clip8(b);
      }
    }
    cur = out;
  }
  return cur;
}

// Decode an image (File/Blob or URL) into RGB bytes, optionally cropped to {x, y, w, h} in image pixels.
export async function decodeImage(source, crop = null) {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none", imageOrientation: "from-image" });
  const c = crop || { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const canvas = new OffscreenCanvas(c.w, c.h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, c.w, c.h).data;
  const rgb = new Uint8Array(c.w * c.h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
  return { rgb, w: c.w, h: c.h };
}

// quadrat() + resize: pad to a square with the (truncated) mean colour, centred, then bicubic to 224.
export function squareAndResize({ rgb, w, h }) {
  if (Math.max(w, h) > MAX_SIDE) {
    const f = MAX_SIDE / Math.max(w, h);
    const nw = Math.max(1, Math.round(w * f)), nh = Math.max(1, Math.round(h * f));
    rgb = resizeBicubic(rgb, w, h, nw, nh); w = nw; h = nh;
  }
  const s = Math.max(w, h);
  const sum = [0, 0, 0];
  for (let i = 0; i < rgb.length; i += 3) { sum[0] += rgb[i]; sum[1] += rgb[i + 1]; sum[2] += rgb[i + 2]; }
  const col = sum.map((v) => Math.trunc(v / (w * h)));
  const sq = new Uint8Array(s * s * 3);
  for (let i = 0; i < sq.length; i += 3) { sq[i] = col[0]; sq[i + 1] = col[1]; sq[i + 2] = col[2]; }
  const ox = Math.floor((s - w) / 2), oy = Math.floor((s - h) / 2);
  for (let y = 0; y < h; y++) sq.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), ((y + oy) * s + ox) * 3);
  return resizeBicubic(sq, s, s, SIZE, SIZE);
}

export function toTensor(rgb224) {
  const n = SIZE * SIZE, data = new Float32Array(3 * n);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 3; c++) data[c * n + i] = (rgb224[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  return new Tensor("float32", data, [1, 3, SIZE, SIZE]);
}

// concat(CLS, mean of patch tokens), L2-normalised -> Float32Array(1536)
export async function embed(model, rgb224) {
  const { last_hidden_state: h } = await model({ pixel_values: toTensor(rgb224) });
  const [, T, D] = h.dims;
  const x = h.data instanceof Float32Array ? h.data : Float32Array.from(h.data);
  const v = new Float32Array(2 * D);
  for (let d = 0; d < D; d++) v[d] = x[d];
  for (let t = 1; t < T; t++) for (let d = 0; d < D; d++) v[D + d] += x[t * D + d];
  for (let d = 0; d < D; d++) v[D + d] /= T - 1;
  let nrm = 0; for (const a of v) nrm += a * a; nrm = Math.sqrt(nrm);
  for (let i = 0; i < v.length; i++) v[i] /= nrm;
  return v;
}

// ------------------------------------------------------------------ search
// q256 = (q - mean) @ matrix; score of a window = sum_d sign_d * q256_d (asymmetric: float query vs 1-bit codes),
// evaluated with one 256-entry lookup table per code byte. A back scores as its best window.
export function search(idx, vec, topK = 20) {
  const D = idx.dims, IN = idx.mean.length, nB = D / 8;
  const q = new Float32Array(D);
  for (let i = 0; i < IN; i++) {
    const a = vec[i] - idx.mean[i], row = i * D;
    for (let d = 0; d < D; d++) q[d] += a * idx.matrix[row + d];
  }
  const lut = new Float32Array(nB * 256);
  for (let b = 0; b < nB; b++)
    for (let v = 0; v < 256; v++) {
      let s = 0;
      for (let k = 0; k < 8; k++) s += (v >> (7 - k)) & 1 ? q[8 * b + k] : -q[8 * b + k];
      lut[b * 256 + v] = s;
    }
  const codes = idx.codes, results = [];
  for (let bi = 0; bi < idx.backs.length; bi++) {
    const { start, count } = idx.backs[bi];
    let best = -Infinity, bestW = start;
    for (let w = start; w < start + count; w++) {
      let s = 0;
      const o = w * nB;
      for (let b = 0; b < nB; b++) s += lut[b * 256 + codes[o + b]];
      if (s > best) { best = s; bestW = w; }
    }
    results.push({ back: bi, score: best, window: bestW });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK).map((r) => {
    const o = r.window * 5, W = idx.windows;
    return { ...r, rank: 0, info: idx.backs[r.back], box: { x: W[o + 1], y: W[o + 2], w: W[o + 3], h: W[o + 4] } };
  }).map((r, i) => ({ ...r, rank: i + 1 }));
}

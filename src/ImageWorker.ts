const ctx = self as unknown as Worker;

import {computeIntensity, detectEdges, carve, toRgba} from "./imageProcessing"

export type CarveTransformation =
  { command: "carve", width: number, height: number };

export type Transformation =
  CarveTransformation |
  { command: "edges" } |
  { command: "intens" } |
  { command: "original" };

export type Request =
  Transformation |
  { command: "set", image: TransferableImageData };

export type Response = TransferableImageData;

export type TransferableImageData = {
  buffer: ArrayBuffer,
  width: number,
  height: number,
};

type ImageState = {
  rgba: Uint8Array,
  intens: Uint8Array,
  edges: Uint16Array,
  width: number,
  height: number,
};

let state: ImageState | null = null;

const getState = () => {
  if (state === null) {
    throw new Error("Image state not set");
  }
  return state;
};

function stopwatch(memo: string, f: () => void) {
  const startedAt = performance.now();
  f();
  console.log(`${memo}: ${performance.now() - startedAt}ms`);
}

ctx.addEventListener("message", event => {
  const message = event.data as Request;

  stopwatch(message.command, () => {
    switch (message.command) {
    case "set": {
      const { buffer, width, height } = message.image;
      const rgba = new Uint8Array(buffer);
      const intens = computeIntensity(rgba, width, height);
      const edges = detectEdges(intens, width, height);
      state = {
        rgba,
        intens,
        edges,
        width,
        height
      };
      break;
    }

    case "carve": {
      const carvedWidth = message.width;
      const carvedHeight = message.height;

      ctx.postMessage({
        buffer: carve(getState(), carvedWidth, carvedHeight),
        width: carvedWidth,
        height: carvedHeight,
      });
      break;
    }

    case "edges": {
      const { edges, width, height } = getState();
      ctx.postMessage({
        buffer: toRgba(edges),
        width,
        height,
      });
      break;
    }

    case "intens": {
      const { intens, width, height } = getState();
      ctx.postMessage({
        buffer: toRgba(intens),
        width,
        height,
      });
      break;
    }

    case "original": {
      const { rgba, width, height } = getState();
      ctx.postMessage({
        buffer: rgba,
        width,
        height,
      });
      break;
    }
    }
  });
});
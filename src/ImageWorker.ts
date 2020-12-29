const ctx = self as unknown as Worker;

export type Request =
  { command: "set", image: TransferableImageData } |
  { command: "carve", width: number, height: number } |
  { command: "seams", width: number, height: number } |
  { command: "edges" } |
  { command: "original" };

export type Response = TransferableImageData;

type TransferableImageData = {
  buffer: ArrayBuffer,
  width: number,
  height: number,
};

type ImageState = {
  rgba: Uint8Array,
  intens: Uint8Array,
  edges: Int16Array,
  width: number,
  height: number,
}

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
      const intens = imageIntensity(rgba, width, height);
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

    case "edges": {
      const { edges, width, height } = getState();
      ctx.postMessage({
        buffer: toRgba(edges),
        width,
        height,
      });
      break;
    }

    case "carve":
    case "seams":
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

function toRgba(plane: Uint8Array | Int16Array): ArrayBuffer {
  const rgba = new Uint8ClampedArray(4 * plane.length);

  for (let i = 0; i < plane.length; i++) {
    const byte = Math.max(0, Math.min(255, plane[i]));
    rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = byte;
    rgba[4 * i + 3] = 255;
  }

  return rgba.buffer;
}

function imageIntensity(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const intens = new Uint8Array(width * height);

  for (let i = 0; i < intens.length; i++) {
    const r = rgba[4 * i];
    const g = rgba[4 * i + 1];
    const b = rgba[4 * i + 2];
    intens[i] = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  }

  return intens;
}

function sobel(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
  const g_x = -a + c - 2 * d + 2 * e - h + f;
  const g_y = a + 2 * b + c - f - 2 * g - h;
  return Math.round(Math.sqrt(g_x * g_x + g_y * g_y));
}

function detectEdges(intens: Uint8Array, width: number, height: number): Int16Array {
  const edges = new Int16Array(intens.length);

  if (intens.length <= 1) {
    return edges;
  }

  if (width === 1 || height === 1) {
    let a = intens[0], b = a, c = intens[1];

    edges[0] = sobel(a, a, a, b, b, c, c, c);

    for (let i = 1; i < intens.length - 1; i++) {
      a = b;
      b = c;
      c = intens[i + 1];
      edges[i] = sobel(a, a, a, b, b, c, c, c);
    }

    a = b;
    b = c;
    edges[intens.length - 1] = sobel(a, a, a, b, b, c, c, c);

    return edges;
  }

  for (let y = 0; y < height; y++) {
    const prev = ((y == 0) ? 0 : (y - 1)) * width;
    const curr = y * width;
    const next = ((y == height - 1) ? y : (y + 1)) * width;

    edges[curr] = sobel(
      intens[prev], intens[prev], intens[prev + 1],
      intens[curr], intens[curr + 1],
      intens[next], intens[next], intens[next + 1]
    );

    for (let x = 1; x < width - 1; x++) {
      edges[curr + x] = sobel(
        intens[prev + x - 1], intens[prev + x], intens[prev + x + 1],
        intens[curr + x - 1], intens[curr + x + 1],
        intens[next + x - 1], intens[next + x], intens[next + x + 1],
      );
    }

    edges[curr + width - 1] = sobel(
      intens[prev + width - 2], intens[prev + width - 1], intens[prev + width - 1],
      intens[curr + width - 2], intens[curr + width - 1],
      intens[next + width - 2], intens[next + width - 1], intens[next + width - 2],
    );
  }

  return edges;
}
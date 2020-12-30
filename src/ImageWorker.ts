const ctx = self as unknown as Worker;

export type CarveTransformation =
  { command: "carve", width: number, height: number } |
  { command: "seams", width: number, height: number };

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

type TypedArray = Uint8Array | Uint16Array | Uint32Array;

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

    case "carve": {
      const carved = carve(getState(), message.width, message.height);
      ctx.postMessage(carved);
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

function toRgba(plane: Uint8Array | Uint16Array): ArrayBuffer {
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

function detectEdges(intens: Uint8Array, width: number, height: number): Uint16Array {
  const edges = new Uint16Array(intens.length);

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

function carve(
  state: ImageState,
  carvedWidth: number,
  carvedHeight: number,
): TransferableImageData {
  const { width, height } = state;

  if (carvedWidth === width && carvedHeight === height) {
    return {
      buffer: state.rgba.buffer,
      width,
      height,
    };
  }

  const maxImageSize = Math.max(
    width * height,
    carvedWidth * height,
    carvedWidth * carvedHeight,
  );

  const result = new Uint32Array(maxImageSize);
  result.set(new Uint32Array(state.rgba.buffer), 0);

  const { intens, edges, table, seam, scratch } = (() => {
    const maxSeamSize = Math.max(width, height, carvedWidth, carvedHeight);

    const buffer = new ArrayBuffer(11 * maxImageSize + 2 * maxSeamSize);

    return {
      table: new Uint32Array(buffer, 0, maxImageSize),
      scratch: new Uint32Array(buffer, 4 * maxImageSize, maxImageSize),
      edges: new Uint16Array(buffer, 8 * maxImageSize, maxImageSize),
      seam: new Uint16Array(buffer, 10 * maxImageSize, maxSeamSize),
      intens: new Uint8Array(buffer, 10 * maxImageSize + 2 * maxSeamSize, maxImageSize),
    };
  })();

  intens.set(state.intens, 0);
  edges.set(state.edges, 0);

  const carveVertically = (steps: number, width: number, height: number, remove: boolean) => {
    for (let i = 0; i < steps; i++) {
      findVerticalSeam(seam, table, edges, width, height);

      console.log(seam);

      if (remove) {
        [result, intens, edges].forEach(array => {
          removeVerticalSeam(array, width, height, seam);
        });

        width--;

        for (let y = 0; y < height; y++) {
          const curr = y * width;
          const prev = Math.max(0, y - 1) * width;
          const next = Math.min(height - 1, y + 1) * width;

          for (let x = Math.max(0, seam[y] - 2); x <= Math.min(width - 1, seam[y] + 2); x++) {
            const xl = Math.max(0, x - 1);
            const xr = Math.min(width - 1, x + 1);

            edges[curr + x] = sobel(
              intens[prev + xl], intens[prev + x], intens[prev + xr],
              intens[curr + xl], intens[curr + xr],
              intens[next + xl], intens[next + x], intens[next + xr],
            );
          }
        }
      } else {
        [result, intens, edges].forEach(array => {
          expandVerticalSeam(array, width, height, seam);
        });

        // FIXME

        width++;
      }
    }
  };

  carveVertically(Math.abs(width - carvedWidth), width, height, carvedWidth < width);

  if (height !== carvedHeight) {
    [result, intens, edges].forEach(array => {
      transpose(array, carvedWidth, height, scratch);
    });
    carveVertically(Math.abs(height - carvedHeight), height, carvedWidth, carvedHeight < height);
    transpose(result, carvedHeight, carvedWidth, scratch);
  }

  return {
    buffer: result.buffer,
    width: carvedWidth,
    height: carvedHeight,
  };
}

function findVerticalSeam(
  seam: Uint16Array,
  table: Uint32Array,
  edges: Uint16Array,
  width: number,
  height: number,
) {
  for (let x = 0; x < width; x++) {
    table[x] = edges[x] << 2;
  }

  for (let y = 1; y < height; y++) {
    const curr = y * width;
    const prev = (y - 1) * width;

    for (let x = 0; x < width; x++) {
      let prevValue = table[prev + x] & (~3);
      if (x > 0) {
        prevValue = Math.min(prevValue, table[prev + x - 1] & (~3) | 1);
      }
      if (x < width - 1) {
        prevValue = Math.min(prevValue, table[prev + x + 1] & (~3) | 2);
      }
      table[curr + x] = prevValue + (edges[curr + x] << 2);
    }
  }

  const lastRow = (height - 1) * width;

  let tail = {
    value: table[lastRow],
    x: 0,
  };

  for (let x = 1; x < width; x++) {
    const value = table[lastRow + x];
    if (value < tail.value) {
      tail = { value, x };
    }
  }

  for (let y = height - 1, x = tail.x; y >= 0; y--) {
    seam[y] = x;

    const value = table[y * width + x];

    if ((value & 1) !== 0) {
      x--;
    } else if ((value & 2) !== 0) {
      x++;
    }
  }
}

function removeVerticalSeam(array: TypedArray, width: number, height: number, seam: Uint16Array) {
  for (let y = 0; y < height; y++) {
    const sourceRow = y * width;
    const destRow = y * (width - 1);
    const x = seam[y];
    array.copyWithin(destRow, sourceRow, sourceRow + x);
    array.copyWithin(destRow + x, sourceRow + x + 1, sourceRow + width);
  }
}

function expandVerticalSeam(
  array: TypedArray,
  width: number,
  height: number,
  seam: Uint16Array,
) {
  for (let y = height - 1; y >= 0; y--) {
    const sourceRow = y * width;
    const destRow = sourceRow + y;
    const x = seam[y];
    array.copyWithin(destRow + x + 2, sourceRow + x + 1, width - 1 - x);
    array.copyWithin(destRow, sourceRow, x);
  }
}

function transpose(array: TypedArray, width: number, height: number, scratch: TypedArray) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      scratch[x * height + y] = array[y * width + x];
    }
  }
  array.set(scratch);
}
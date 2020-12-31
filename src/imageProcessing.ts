type TypedArray = Uint8Array | Uint16Array | Uint32Array;

export function toRgba(plane: Uint8Array | Uint16Array): ArrayBuffer {
  const rgba = new Uint8ClampedArray(4 * plane.length);

  for (let i = 0; i < plane.length; i++) {
    const byte = Math.max(0, Math.min(255, plane[i]));
    rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = byte;
    rgba[4 * i + 3] = 255;
  }

  return rgba.buffer;
}

export function computeIntensity(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const intens = new Uint8Array(width * height);
  computeIntensityToArray(intens, rgba, width, height);
  return intens;
}

function computeIntensityToArray(intens: Uint8Array, rgba: Uint8Array, width: number, height: number) {
  for (let i = 0; i < width * height; i++) {
    const r = rgba[4 * i];
    const g = rgba[4 * i + 1];
    const b = rgba[4 * i + 2];
    intens[i] = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  }
}

function sobel(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
  const g_x = -a + c - 2 * d + 2 * e - h + f;
  const g_y = a + 2 * b + c - f - 2 * g - h;
  return Math.round(Math.sqrt(g_x * g_x + g_y * g_y));
}

export function detectEdges(intens: Uint8Array, width: number, height: number): Uint16Array {
  const edges = new Uint16Array(width * height);
  detectEdgesToArray(edges, intens, width, height);
  return edges;
}

function detectEdgesToArray(edges: Uint16Array, intens: Uint8Array, width: number, height: number) {
  if (width * height === 0) {
    return;
  }

  if (width === 1 || height === 1) {
    let a = intens[0], b = a, c = intens[1];

    edges[0] = sobel(a, a, a, b, b, c, c, c);

    for (let i = 1; i < width * height - 1; i++) {
      a = b;
      b = c;
      c = intens[i + 1];
      edges[i] = sobel(a, a, a, b, b, c, c, c);
    }

    a = b;
    b = c;
    edges[width * height - 1] = sobel(a, a, a, b, b, c, c, c);

    return edges;
  }

  for (let y = 0; y < height; y++) {
    const prev = ((y == 0) ? 0 : (y - 1)) * width;
    const curr = y * width;
    const next = ((y == height - 1) ? y : (y + 1)) * width;

    for (let x = 0; x < width; x++) {
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);

      edges[curr + x] = sobel(
        intens[prev + xl], intens[prev + x], intens[prev + xr],
        intens[curr + xl], intens[curr + xr],
        intens[next + xl], intens[next + x], intens[next + xr],
      );
    }
  }
}

export function carveImage(
  rgba: Uint8Array,
  intens: Uint8Array,
  edges: Uint16Array,
  width: number,
  height: number,
  carvedWidth: number,
  carvedHeight: number,
) {
  if (width === carvedWidth && height === carvedHeight) {
    return;
  }

  const maxImageSize = Math.max(width, carvedWidth) * Math.max(height, carvedHeight);

  const verticalCount = Math.abs(width - carvedWidth);
  const horizontalCount = Math.abs(height - carvedHeight);

  const arrays = (() => {

    const maxIntermediateSize = Math.max(width, carvedWidth) * height;

    const maxSeamsSize = Math.max(
      height * verticalCount,
      carvedWidth * horizontalCount,
    );

    const size = 4 * maxImageSize + 3 * maxIntermediateSize + 2 * maxSeamsSize;

    const buffer = new ArrayBuffer(size);

    const scratch = new Uint32Array(buffer, 0, maxImageSize);
    const edges = new Uint16Array(buffer, 4 * maxImageSize, maxIntermediateSize);
    const seams = new Uint16Array(buffer, 4 * maxImageSize + 2 * maxIntermediateSize, maxSeamsSize);
    const intens = new Uint8Array(
      buffer,
      4 * maxImageSize + 2 * (maxIntermediateSize + maxSeamsSize),
      maxIntermediateSize
    );

    return { scratch, edges, seams, intens };
  })();

  arrays.intens.set(intens);
  arrays.edges.set(edges);

  findAndRemoveVerticalSeams(
    arrays.seams,
    verticalCount,
    arrays.intens,
    arrays.edges,
    width,
    height,
    arrays.scratch,
  );

  const image = new Uint32Array(maxImageSize);
  (new Uint8Array(image.buffer)).set(rgba);

  if (horizontalCount !== 0) {
    transpose(image, carvedWidth, height, arrays.scratch);

    if (carvedWidth <= width) {
      transpose(intens, carvedWidth, height, new Uint8Array(arrays.scratch.buffer));
      transpose(edges, carvedWidth, height, new Uint16Array(arrays.scratch.buffer));
    } else {
      computeIntensityToArray(intens, rgba, height, carvedWidth);
      detectEdgesToArray(edges, intens, height, carvedWidth);
    }

    carveVerticalSeams(
      image,
      seams,
      intens,
      edges,
      table,
      height,
      carvedHeight,
      carvedWidth,
    );

    transpose(image, carvedHeight, carvedWidth, arrays.scratch);
  }

  return image.buffer;
}

function findAndRemoveVerticalSeams(
  seams: Uint16Array,
  count: number,
  intens: Uint8Array,
  edges: Uint16Array,
  width: number,
  height: number,
  table: Uint32Array,
) {

}

function carve(
  image:
    carvedWidth: number,
  carvedHeight: number,
): ArrayBuffer {
  const { width, height } = state;

  if (carvedWidth === width && carvedHeight === height) {
    return state.rgba;
  }

  const image = new Uint32Array(maxImageSize);
  const rgba = new Uint8Array(image.buffer);
  rgba.set(state.rgba);

  const { intens, edges, table, seams, scratch } = (() => {
    const maxSeamsSize = Math.max(
      Math.abs(width - carvedWidth) * height,
      Math.abs(height - carvedHeight) * carvedWidth,
    );


  })();

  intens.set(state.intens, 0);
  edges.set(state.edges, 0);

  carveVerticalSeams(
    image,
    seams,
    intens,
    edges,
    table,
    width,
    carvedWidth,
    height,
  );

  if (height !== carvedHeight) {
    transpose(image, carvedWidth, height, scratch);

    if (carvedWidth <= width) {
      transpose(intens, carvedWidth, height, scratch);
      transpose(edges, carvedWidth, height, scratch);
    } else {
      computeIntensityToArray(intens, rgba, carvedWidth, height);
      detectEdgesToArray(edges, intens, carvedWidth, height);
    }

    carveVerticalSeams(
      image,
      seams,
      intens,
      edges,
      table,
      height,
      carvedHeight,
      carvedWidth,
    );

    transpose(image, carvedHeight, carvedWidth, scratch);
  }

  return image.buffer;
}

function carveVerticalSeams(
  image: Uint32Array,
  seams: Uint16Array,
  intens: Uint8Array,
  edges: Uint16Array,
  table: Uint32Array,
  width: number,
  carvedWidth: number,
  height: number,
) {
  const count = Math.abs(width - carvedWidth);
  const remove = width > carvedWidth;

  findVerticalSeams(
    seams,
    count,
    intens,
    edges,
    table,
    width,
    height,
  );

  for (let i = 0; i < count; i++) {
    const seam = seams.subarray(i * height, (i + 1) * height);

    if (remove) {
      removeVerticalSeam(image, width, height, seam);
      width--;
    } else {
      expandVerticalSeam(image, width, height, seam, expandImageSeam);
      width++;

      for (let j = i + 1; j < count; j++) {
        const other = seams.subarray(j * height, (j + 1) * height);

        for (let y = 0; y < height; y++) {
          if (seam[y] <= other[y]) {
            other[y] += 2;
          }
        }
      }
    }
  }
}

function findVerticalSeams(
  seams: Uint16Array,
  count: number,
  intens: Uint8Array,
  edges: Uint16Array,
  table: Uint32Array,
  width: number,
  height: number,
) {
  for (let i = 0; i < count; i++) {
    const seam = seams.subarray(i * height, (i + 1) * height);

    findVerticalSeam(seam, table, edges, width, height);
    removeVerticalSeam(intens, width, height, seam);
    removeVerticalSeam(edges, width, height, seam);

    width--;

    for (let y = 0; y < height; y++) {
      const curr = y * width;
      const prev = (y == 0) ? curr : (curr - width);
      const next = (y == height - 1) ? curr : (curr + width);

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
  }
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
      let predecessor = table[prev + x] & (~3);

      if (x > 0) {
        predecessor = Math.min(predecessor, table[prev + x - 1] & (~3) | 1);
      }

      if (x < width - 1) {
        predecessor = Math.min(predecessor, table[prev + x + 1] & (~3) | 2);
      }

      table[curr + x] = predecessor + (edges[curr + x] << 2);
    }
  }

  const last = (height - 1) * width;

  let tail = {
    value: table[last],
    x: 0,
  };

  for (let x = 1; x < width; x++) {
    const value = table[last + x];
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
  values: (left: number, middle: number, right: number) => [number, number],
) {
  for (let y = height - 1; y >= 0; y--) {
    const sourceRow = y * width;
    const destRow = y * (width + 1);
    const x = seam[y];

    const left = array[sourceRow + Math.max(x - 1, 0)];
    const middle = array[sourceRow + x];
    const right = array[sourceRow + Math.min(x + 1, width - 1)];

    array.copyWithin(destRow + x + 2, sourceRow + x + 1, sourceRow + width);
    array.set(values(left, middle, right), destRow + x);
    array.copyWithin(destRow, sourceRow, sourceRow + x);
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

function expandImageSeam(left: number, middle: number, right: number): [number, number] {
  function bytes(u32: number): Array<number> {
    return [
      u32 & 0xff,
      (u32 >> 8) & 0xff,
      (u32 >> 16) & 0xff,
      u32 >> 24,
    ];
  }

  function u32(bytes: Array<number>): number {
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
  }

  function averageBytes(x: Array<number>, y: Array<number>): Array<number> {
    return x.map((byte, i) => (byte + y[i]) / 2);
  }

  const leftBytes = bytes(left);
  const middleBytes = bytes(middle);
  const rightBytes = bytes(right);

  return [
    u32(averageBytes(leftBytes, middleBytes)),
    u32(averageBytes(middleBytes, rightBytes)),
  ];
}
type TypedArray = Uint8Array | Uint16Array | Uint32Array;

export function toRgba(image: Uint8Array | Uint16Array): ArrayBuffer {
  const rgba = new Uint8ClampedArray(4 * image.length);

  for (let i = 0; i < image.length; i++) {
    const byte = Math.max(0, Math.min(255, image[i]));
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
  const g_y = 0; //a + 2 * b + c - f - 2 * g - h;
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
): ArrayBuffer {
  if (width === carvedWidth && height === carvedHeight) {
    return rgba.buffer;
  }

  const verticalSeams = Math.abs(width - carvedWidth);
  const horizontalSeams = Math.abs(height - carvedHeight);

  const maxImageSize = Math.max(width, carvedWidth) * Math.max(height, carvedHeight);

  const arrays = (() => {
    const maxIntensEdgesSize = Math.max(width, carvedWidth) * height;

    const maxSeamsSize = Math.max(verticalSeams * height, horizontalSeams * carvedWidth);

    const [
      [scratch32],
      [seams, edges],
      [intens]
    ] = allocateArrays(
      [maxImageSize],
      [maxSeamsSize, maxIntensEdgesSize],
      [maxIntensEdgesSize],
    );

    return { scratch32, seams, edges, intens };
  })();

  const scratch8 = new Uint8Array(
    arrays.scratch32.buffer,
    arrays.scratch32.byteOffset,
    4 * arrays.scratch32.length
  );

  const scratch16 = new Uint16Array(
    arrays.scratch32.buffer,
    arrays.scratch32.byteOffset,
    2 * arrays.scratch32.length
  );

  arrays.intens.set(intens);
  arrays.edges.set(edges);

  const image = new Uint32Array(Math.max(width, carvedWidth) * Math.max(height, carvedHeight));
  (new Uint8Array(image.buffer)).set(rgba);

  const carve = (width: number, height: number, count: number, remove: boolean) => {
    findAndRemoveVerticalSeams(
      arrays.seams,
      count,
      arrays.intens,
      arrays.edges,
      width,
      height,
      arrays.scratch32,
    );

    transpose(arrays.seams, height, count, scratch16);

    let w = 0;

    for (let y = 0; y < height; y++) {
      const row = y * width;

      const xs = arrays.seams.subarray(count * y, count * (y + 1));
      xs.sort();

      let prev = 0;

      const copySegment = (begin: number, end: number) => {
        if (remove) {
          image.copyWithin(w, row + begin, row + end);
        } else {
          arrays.scratch32.set(image.subarray(row + begin, row + end), w);
        }
        w += end - begin;
      };

      xs.forEach(x => {
        copySegment(prev, x);

        if (!remove) {
          const xl = Math.max(0, x - 1);
          const xr = Math.min(width - 1, x + 1);
          arrays.scratch32[w++] = rgbaAverage(image[row + xl], image[row + x]);
          arrays.scratch32[w++] = rgbaAverage(image[row + x], image[row + xr]);
        }

        prev = x + 1;
      });

      copySegment(prev, width);
    }

    if (!remove) {
      image.set(arrays.scratch32.subarray(0, w));
    }
  };

  if (width !== carvedWidth) {
    carve(width, height, verticalSeams, carvedWidth < width);
  }

  if (height !== carvedHeight) {
    transpose(image, carvedWidth, height, arrays.scratch32);

    if (carvedWidth <= width) {
      transpose(arrays.intens, carvedWidth, height, scratch8);
      transpose(arrays.edges, carvedWidth, height, scratch16);
    } else {
      const imageRgba = new Uint8Array(image.buffer, image.byteOffset, 4 * height * carvedWidth);
      computeIntensityToArray(arrays.intens, imageRgba, height, carvedWidth);
      detectEdgesToArray(arrays.edges, arrays.intens, height, carvedWidth);
    }

    carve(height, carvedWidth, horizontalSeams, carvedHeight < height);

    transpose(image, carvedHeight, carvedWidth, arrays.scratch32);
  }

  return image.buffer;
}

export function highlightSeams(
  rgba: Uint8Array,
  intens: Uint8Array,
  edges: Uint16Array,
  width: number,
  height: number,
  axis: "vertical" | "horizontal",
  count: number,
): ArrayBuffer {
  if (count === 0) {
    return rgba.buffer;
  }

  const imageSize = width * height;

  const arrays = (() => {
    const seamLength = (axis === "horizontal") ? width : height;

    const [
      [scratch32],
      [seams, edges],
      [intens],
    ] = allocateArrays(
      [imageSize],
      [seamLength * count, imageSize],
      [imageSize],
    );

    return { seams, intens, edges, scratch32 };
  })();

  const image = new Uint32Array(width * height);
  const imageRgba = new Uint8Array(image.buffer);

  const highlight = (width: number, height: number) => {
    findAndRemoveVerticalSeams(
      arrays.seams,
      count,
      arrays.intens,
      arrays.edges,
      width,
      height,
      arrays.scratch32,
    );

    for (let i = 0; i < count; i++) {
      const seam = arrays.seams.subarray(i * height, (i + 1) * height);

      for (let y = 0; y < height; y++) {
        const x = seam[y];
        imageRgba.set([0xff, 0x00, 0xff, 0xff], 4 * (y * width + x));
      }
    }
  };

  const original = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);

  if (axis === "vertical") {
    arrays.intens.set(intens);
    arrays.edges.set(edges);
    image.set(original);
    highlight(width, height);
  } else {
    transposeToArray(arrays.intens, intens, width, height);
    transposeToArray(arrays.edges, edges, width, height);
    transposeToArray(image, original, width, height);
    highlight(height, width);
    transpose(image, height, width, arrays.scratch32);
  }

  return image.buffer;
}

function allocateArrays(
  lengths32: Array<number>,
  lengths16: Array<number>,
  lengths8: Array<number>
): [Array<Uint32Array>, Array<Uint16Array>, Array<Uint8Array>] {
  const sum = (values: Array<number>) => values.reduce((x, y) => x + y);
  const size = 4 * sum(lengths32) + 2 * sum(lengths16) + sum(lengths8);

  const buffer = new ArrayBuffer(size);

  let offset = 0;

  const arrays32 = lengths32.map(length => {
    const array = new Uint32Array(buffer, offset, length);
    offset += 4 * length;
    return array;
  });

  const arrays16 = lengths16.map(length => {
    const array = new Uint16Array(buffer, offset, length);
    offset += 2 * length;
    return array;
  });

  const arrays8 = lengths8.map(length => {
    const array = new Uint8Array(buffer, offset, length);
    offset += length;
    return array;
  });

  return [
    arrays32,
    arrays16,
    arrays8,
  ];
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

  for (let i = count - 1; i >= 0; i--) {
    const seam = seams.subarray(i * height, (i + 1) * height);

    for (let j = i - 1; j >= 0; j--) {
      const other = seams.subarray(j * height, (j + 1) * height);

      for (let k = 0; k < height; k++) {
        if (other[k] <= seam[k]) {
          seam[k]++;
        }
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

function transpose(array: TypedArray, width: number, height: number, scratch: TypedArray) {
  transposeToArray(scratch, array, width, height);
  array.set(scratch.subarray(0, width * height));
}

function transposeToArray(transposed: TypedArray, array: TypedArray, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      transposed[x * height + y] = array[y * width + x];
    }
  }
}

function rgbaAverage(x: number, y: number): number {
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

  return u32(averageBytes(bytes(x), bytes(y)));
}
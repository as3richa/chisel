type TypedArray = Uint8Array | Uint16Array | Uint32Array;

export function mapToRgba(map: Uint8Array | Uint16Array, length: number): Uint8Array {
  const rgba = new Uint8Array(4 * length);

  for (let i = 0; i < length; i++) {
    const byte = Math.max(0, Math.min(0xff, map[i]));
    rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = byte;
    rgba[4 * i + 3] = 0xff;
  }

  return rgba;
}

export function intensityMap(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const intens = new Uint8Array(width * height);
  intensityMapToArray(intens, rgba, width, height);
  return intens;
}

function intensityMapToArray(intens: Uint8Array, rgba: Uint8Array, width: number, height: number) {
  for (let i = 0; i < width * height; i++) {
    const r = rgba[4 * i];
    const g = rgba[4 * i + 1];
    const b = rgba[4 * i + 2];
    intens[i] = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  }
}

export function horizontalGradientMap(intens: Uint8Array, width: number, height: number): Uint16Array {
  const grad = new Uint16Array(width * height);
  horizontalGradientMapToArray(grad, intens, width, height);
  return grad;
}

function horizontalGradientMapToArray(grad: Uint16Array, intens: Uint8Array, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    horizontalGradientRowToArray(grad, intens, width, height, y, 0, width - 1);
  }
}

function horizontalGradientRowToArray(grad: Uint16Array, intens: Uint8Array, width: number, height: number, y: number, left: number, right: number) {
  const curr = y * width;
  const prev = (y == 0) ? curr : (curr - width);
  const next = (y == height - 1) ? curr : (curr + width);

  for (let x = left; x <= right; x++) {
    const xl = Math.max(0, x - 1);
    const xr = Math.min(width - 1, x + 1);

    grad[curr + x] = horizontalGradient(
      intens[prev + xl], intens[prev + xr],
      intens[curr + xl], intens[curr + xr],
      intens[next + xl], intens[next + xr],
    );
  }
}

function horizontalGradient(a: number, b: number, c: number, d: number, e: number, f: number) {
  return Math.abs(-a + b - 2 * c + 2 * d - f + e);
}

export function verticalGradientMap(intens: Uint8Array, width: number, height: number): Uint16Array {
  const grad = new Uint16Array(width * height);

  for (let y = 0; y < height; y++) {
    const curr = width * y;
    const prev = (y === 0) ? 0 : (curr - width);
    const next = (y === height - 1) ? curr : (curr + width);

    for (let x = 0; x < width; x++) {
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);

      grad[curr + x] = verticalGradient(
        intens[prev + xl], intens[prev + x], intens[prev + xr],
        intens[next + xl], intens[next + x], intens[next + xr],
      );
    }
  }

  return grad;
}

function verticalGradient(a: number, b: number, c: number, d: number, e: number, f: number) {
  return Math.abs(-a - 2 * b - c + d + 2 * e + f);
}

export function carveImage(
  rgba: Uint8Array,
  width: number,
  height: number,
  carvedWidth: number,
  carvedHeight: number,
): Uint8Array {
  if (width === carvedWidth && height === carvedHeight) {
    return rgba;
  }

  const image = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);

  const verticalSeams = Math.abs(width - carvedWidth);
  const horizontalSeams = Math.abs(height - carvedHeight);

  const maxImageSize = Math.max(width, carvedWidth) * Math.max(height, carvedHeight);
  const maxIntensgradsSize = Math.max(width, carvedWidth) * height;
  const maxSeamsSize = Math.max(verticalSeams * height, horizontalSeams * carvedWidth);

  const [
    [scratch32],
    [seams, grad],
    [intens]
  ] = allocateArrays(
    [maxImageSize],
    [maxSeamsSize, maxIntensgradsSize],
    [maxIntensgradsSize],
  );

  const scratch16 = new Uint16Array(scratch32.buffer, scratch32.byteOffset, 2 * scratch32.length);

  const result = new Uint32Array(carvedWidth * Math.max(height, carvedHeight));
  const resultRgba = new Uint8Array(result.buffer);

  const carve = (image: Uint32Array, width: number, height: number, count: number, remove: boolean) => {
    findAndRemoveVerticalSeams(
      seams,
      count,
      intens,
      grad,
      width,
      height,
      scratch32,
    );

    transpose(seams, height, count, scratch16);

    const out = (image === result)
      ? scratch32
      : result;

    let offset = 0;

    for (let y = 0; y < height; y++) {
      const row = y * width;

      const xs = seams.subarray(count * y, count * (y + 1));
      xs.sort();

      let prev = 0;

      const copySegment = (begin: number, end: number) => {
        out.set(image.subarray(row + begin, row + end), offset);
        offset += end - begin;
      };

      xs.forEach(x => {
        copySegment(prev, x);

        if (!remove) {
          const xl = Math.max(0, x - 1);
          const xr = Math.min(width - 1, x + 1);
          out[offset++] = rgbaAverage(image[row + xl], image[row + x]);
          out[offset++] = rgbaAverage(image[row + x], image[row + xr]);
        }

        prev = x + 1;
      });

      copySegment(prev, width);
    }

    if (out !== result) {
      result.set(out.subarray(0, offset));
    }
  };

  if (width !== carvedWidth) {
    intensityMapToArray(intens, rgba, width, height);
    horizontalGradientMapToArray(grad, intens, width, height);
    carve(image, width, height, verticalSeams, carvedWidth < width);
  }

  if (height !== carvedHeight) {
    if (width === carvedWidth) {
      transposeToArray(result, image, width, height);
    } else {
      transpose(result, carvedWidth, height, scratch32);
    }

    intensityMapToArray(intens, resultRgba, height, carvedWidth);
    horizontalGradientMapToArray(grad, intens, height, carvedWidth);
    carve(result, height, carvedWidth, horizontalSeams, carvedHeight < height);
    transpose(result, carvedHeight, carvedWidth, scratch32);
  }

  return resultRgba.subarray(0, 4 * carvedWidth * carvedHeight);
}

export function highlightSeams(
  rgba: Uint8Array,
  width: number,
  height: number,
  vertical: boolean,
  count: number,
): Uint8Array {
  if (count === 0) {
    return rgba;
  }

  const image = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);

  const imageSize = width * height;
  const seamLength = vertical ? height : width;

  const [
    [scratch32],
    [seams, grad],
    [intens],
  ] = allocateArrays(
    [imageSize],
    [seamLength * count, imageSize],
    [imageSize],
  );

  const result = new Uint32Array(width * height);
  const resultRgba = new Uint8Array(result.buffer);

  const highlight = (width: number, height: number) => {
    findAndRemoveVerticalSeams(
      seams,
      count,
      intens,
      grad,
      width,
      height,
      scratch32,
    );

    for (let i = 0; i < count; i++) {
      const seam = seams.subarray(i * height, (i + 1) * height);

      for (let y = 0; y < height; y++) {
        const x = seam[y];
        resultRgba.set([0xff, 0x00, 0xff, 0xff], 4 * (y * width + x));
      }
    }
  };

  if (vertical) {
    result.set(image.subarray(0, width * height));
    intensityMapToArray(intens, rgba, width, height);
    horizontalGradientMapToArray(grad, intens, width, height);
    highlight(width, height);
  } else {
    transposeToArray(result, image, width, height);
    intensityMapToArray(intens, resultRgba, height, width);
    horizontalGradientMapToArray(grad, intens, height, width);
    highlight(height, width);
    transpose(result, height, width, scratch32);
  }

  return resultRgba;
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
  grad: Uint16Array,
  width: number,
  height: number,
  table: Uint32Array,
) {
  for (let i = 0; i < count; i++) {
    const seam = seams.subarray(i * height, (i + 1) * height);

    findVerticalSeam(seam, table, grad, width, height);
    removeVerticalSeam(intens, width, height, seam);
    removeVerticalSeam(grad, width, height, seam);

    width--;

    for (let y = 0; y < height; y++) {
      const x = seam[y];
      horizontalGradientRowToArray(
        grad,
        intens,
        width,
        height,
        y,
        Math.max(0, x - 2),
        Math.max(width - 1, x + 2)
      );
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
  grads: Uint16Array,
  width: number,
  height: number,
) {
  for (let x = 0; x < width; x++) {
    table[x] = grads[x] << 2;
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

      table[curr + x] = predecessor + (grads[curr + x] << 2);
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
    const source = y * width;
    const dest = y * (width - 1);
    const x = seam[y];
    array.copyWithin(dest, source, source + x);
    array.copyWithin(dest + x, source + x + 1, source + width);
  }
}

function transpose<T extends TypedArray>(array: T, width: number, height: number, scratch: T) {
  transposeToArray(scratch, array, width, height);
  array.set(scratch.subarray(0, width * height));
}

function transposeToArray<T extends TypedArray>(transposed: T, array: T, width: number, height: number) {
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
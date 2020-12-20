export function carveSeams(imageData: ImageData, edges: Uint16Array, x: number, y: number): ImageData {
  let {width} = imageData;
  const {height} = imageData;

  const carvedWidth = width + x, carvedHeight = height + y;
  const maxSize = Math.max(
    width * height,
    carvedWidth * height,
    carvedWidth * carvedHeight,
  );

  const data = new Uint32Array(maxSize);
  data.set(new Uint32Array(imageData.data.buffer), 0);

  const table = new Uint32Array(maxSize);
  const seam = new Uint16Array(Math.max(width, height));

  if (x < 0) {
    for (let i = 0; i < -x; i++) {
      findVerticalSeam();
      removeVerticalSeam();
    }
  }

  function findVerticalSeam() {
    for (let j = 0; j < width; j ++) {
      table[j] = edges[j] << 2;
    }

    for (let i = 1; i < height; i++) {
      const prevTableRow = table.subarray((i - 1)*width, i*width);
      const tableRow = table.subarray(i * width, (i + 1) * width);
      const edgesRow = edges.subarray(i * width, (i + 1) * width);

      for (let j = 0; j < width; j ++) {
        let pred = prevTableRow[j];

        if (j > 0) {
          pred = Math.min(pred, (prevTableRow[j - 1] & (~3)) | 2);
        }

        if (j < width - 1) {
          pred = Math.min(pred, (prevTableRow[j + 1] & (~3)) | 1);
        }

        tableRow[j] = pred + ((edgesRow[j] >> 4) << 2);
      }
    }

    const lastTableRow = table.subarray(width * (height - 1));

    let j = 0;
    for (let k = 1; k < width; k++) {
      if (lastTableRow[k] < lastTableRow[j]) {
        j = k;
      }
    }

    for (let i = height - 1; i >= 0; i--) {
      seam[i] = j;
      const row = table.subarray(i * width, (i + 1) * width);
      if (row[j] & 1) {
        j++;
      } else if (row[j] & 2) {
        j--;
      }
    }
  }

  function removeVerticalSeam() {
    for (let i = 0; i < height; i++) {
      const j = seam[i];
      data.copyWithin(i * (width - 1), i * width, i * width + j);
      data.copyWithin(i * (width - 1) + j, i * width + j + 1, (i + 1) * width);
      edges.copyWithin(i * (width - 1), i * width, i * width + j);
      edges.copyWithin(i * (width - 1) + j, i * width + j + 1, (i + 1) * width);
    }
    console.log(seam);
    width--;
  }
    
  return new ImageData(new Uint8ClampedArray(data.buffer, 0, 4 * width*height), width, height);
}
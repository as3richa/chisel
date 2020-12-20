export function detectEdges(data: ImageData): Float32Array {
  const {width: w, height: h} = data;
  function dataIndex(y: number, x: number) {
    return 4 * (y * w + x);
  }

  const intensity = new Float32Array((w + 2) * (h + 2));

  function intensityIndex(y: number, x: number) {
    return y * (w + 2) + x;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x ++) {
      const i = dataIndex(y, x);
      const [r, g, b] = [data.data[i], data.data[i+1], data.data[i+2]];
      const value = (0.3 * r + 0.59 * g + 0.11 * b)/255;
      intensity[intensityIndex(y + 1, x + 1)] = value;
    }
  }

  for (let y = 1; y <= h; y ++) {
    intensity[intensityIndex(y, 0)] = intensity[intensityIndex(y, 1)];
    intensity[intensityIndex(y, w + 1)] = intensity[intensityIndex(y, w)];
  }

  for (let x = 1; x <= w; x ++) {
    intensity[intensityIndex(0, x)] = intensity[intensityIndex(1, x)];
    intensity[intensityIndex(h + 1, x)] = intensity[intensityIndex(h, x)];
  }

  intensity[intensityIndex(0, 0)] = intensity[intensityIndex(1, 1)];
  intensity[intensityIndex(0, w + 1)] = intensity[intensityIndex(1, w)];
  intensity[intensityIndex(h + 1, 0)] = intensity[intensityIndex(h, 1)];
  intensity[intensityIndex(h + 1, w + 1)] = intensity[intensityIndex(h, w)];

  const edges = new Float32Array(w * h);

  let min = intensity[0], max = intensity[0];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = intensityIndex(y, x);

      const [[a, b, c], [d, e], [f, g, h]] = [
        [intensity[i], intensity[i + 1], intensity[i + 2]],
        [intensity[i + w + 2], intensity[i + w + 4]],
        [intensity[i + 2*w + 4], intensity[i + 2*w + 5], intensity[i + 2*w + 6]],
      ];

      const gx = -a + c - 2*d + 2*e - f + h;
      const gy = -a - 2*b - c + f + 2*g + h;
      const value = Math.sqrt(gx*gx + gy*gy);

      edges[y * w + x] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const range = max - min <= 1e-4 ? 1 : (max - min);

  for (let i = 0; i < w * h; i ++) {
    edges[i] = (edges[i] - min) / range;
  }

  return edges;
}

export function intensityToImageData(intensity: Float32Array, width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(4 * width * height);

  for (let i = 0; i < width * height; i++) {
    data[4 * i] = data[4 * i + 1] = data[4 * i + 2] = Math.round(255 * intensity[i]);
    data[4 * i + 3] = 255;
  }

  return new ImageData(data, width, height);
}
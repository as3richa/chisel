export function detectEdges(data: ImageData): Uint16Array {
  const {data: bytes, width, height} = data;

  const energy = new Uint8ClampedArray((width + 2) * (height + 2));

  function energyIndex(y: number, x: number) {
    return y * (width + 2) + x;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x ++) {
      const i = 4 * (y * width + x);
      const [r, g, b] = [bytes[i], bytes[i+1], bytes[i+2]];

      const value = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
      energy[energyIndex(y + 1, x + 1)] = value;
    }
  }

  for (let y = 1; y <= height; y ++) {
    energy[energyIndex(y, 0)] = energy[energyIndex(y, 1)];
    energy[energyIndex(y, width + 1)] = energy[energyIndex(y, width)];
  }

  for (let x = 1; x <= width; x ++) {
    energy[energyIndex(0, x)] = energy[energyIndex(1, x)];
    energy[energyIndex(height + 1, x)] = energy[energyIndex(height, x)];
  }

  energy[energyIndex(0, 0)] = energy[energyIndex(1, 1)];
  energy[energyIndex(0, width + 1)] = energy[energyIndex(1, width)];
  energy[energyIndex(height + 1, 0)] = energy[energyIndex(height, 1)];
  energy[energyIndex(height + 1, width + 1)] = energy[energyIndex(height, width)];

  const edges = new Uint16Array(width * height);

  let min = energy[0], max = energy[0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = energyIndex(y, x);

      const [[a, b, c], [d, e], [f, g, h]] = [
        [energy[i], energy[i + 1], energy[i + 2]],
        [energy[i + width + 2], energy[i + width + 4]],
        [energy[i + 2*width + 4], energy[i + 2*width + 5], energy[i + 2*width + 6]],
      ];

      const value = sobel(a, b, c, d, e, f, g, h);
      edges[y * width + x] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  const range = max - min == 0 ? 1 : (max - min);

  for (let i = 0; i < width * height; i ++) {
    edges[i] = Math.round((edges[i] - min) / range * 65535);
  }

  return edges;
}

export function sobel(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number): number {
  const gx = -a + c - 2*d + 2*e - f + h;
  const gy = -a - 2*b - c + f + 2*g + h;
  return Math.round(Math.sqrt(gx*gx + gy*gy));
}

export function edgesToImageData(edges: Uint16Array, width: number, height: number): ImageData {
  const bytes = new Uint8ClampedArray(4 * width * height);

  for (let i = 0; i < width * height; i++) {
    bytes[4 * i] = bytes[4 * i + 1] = bytes[4 * i + 2] = Math.round(edges[i] / 255);
    bytes[4 * i + 3] = 255;
  }

  return new ImageData(bytes, width, height);
}
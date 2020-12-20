export function energyToImageData(energy: Float32Array, width: number, height: number): ImageData {
  const bytes = new Uint8ClampedArray(4 * width * height);
  
  for (let i = 0; i < width * height; i++) {
    bytes[4 * i] = bytes[4 * i + 1] = bytes[4 * i + 2] = Math.round(255 * energy[i]);
    bytes[4 * i + 3] = 255;
  }
  
  return new ImageData(bytes, width, height);
}
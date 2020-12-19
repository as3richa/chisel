const ctxError = new Error("HTMLCanvasElement#getContext(\"2d\") returned null");
const loadError = new Error("Error loading image");
const imageError = new Error("Invalid or empty image");

let rasterizer: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

export function loadImageData(src: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    function onLoad(this: HTMLImageElement) {
      if (this.width === 0 || this.height === 0) {
        reject(imageError);
      }

      if (rasterizer === null) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (ctx === null) {
          throw ctxError;
        }
                
        rasterizer = [canvas, ctx];
      }

      const [canvas, ctx] = rasterizer;

      canvas.width = this.width;
      canvas.height = this.height;
      ctx.drawImage(this, 0, 0);

      const rgbaBuffer = ctx.getImageData(0, 0, this.width, this.height).data.buffer;
      const rgbaBytes = new Uint8Array(rgbaBuffer);

      const buffer = new ArrayBuffer(3*this.width*this.height);
      const bytes = new Uint8Array(buffer);

      for (let i = 0; i < this.width*this.height; i++) {
        for (let j = 0; j < 3; j++) {
          bytes[3*i + j] = rgbaBytes[4*i + j];
        }
      }
            
      resolve(buffer);
    }

    const img = document.createElement("img");
    img.addEventListener("load", onLoad);
    img.addEventListener("error", () => {
      reject(loadError);
    });
    img.src = src;
  });
}
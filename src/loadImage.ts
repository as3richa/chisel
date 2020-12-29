const ctxError = new Error("HTMLCanvasElement#getContext(\"2d\") returned null");
const loadError = new Error("Error loading image");
const imageError = new Error("Invalid or empty image");

let rasterizer: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

export function loadImage(src: string): Promise<ImageData> {
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

      const img = ctx.getImageData(0, 0, this.width, this.height);

      for (let i = 0; i < this.width*this.height; i++) {
        img.data[4*i + 3] = 0xff;
      }

      resolve(img);
    }

    const img = document.createElement("img");
    img.addEventListener("load", onLoad);
    img.addEventListener("error", () => {
      reject(loadError);
    });
    img.src = src;
  });
}
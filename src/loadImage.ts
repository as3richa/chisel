let rasterizer: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

export function loadImage(name: string, src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    function onLoad(this: HTMLImageElement) {
      if (this.width === 0 || this.height === 0) {
        reject(new Error(`Error loading ${name}: invalid or empty image`));
      }

      if (rasterizer === null) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (ctx === null) {
          reject(new Error(`Error loading ${name}: couldn't create a 2D context`));
          return;
        }
                
        rasterizer = [canvas, ctx];
      }

      const [canvas, ctx] = rasterizer;

      canvas.width = this.width;
      canvas.height = this.height;
      ctx.drawImage(this, 0, 0);

      const image = ctx.getImageData(0, 0, this.width, this.height);

      for (let i = 0; i < this.width*this.height; i++) {
        image.data[4*i + 3] = 0xff;
      }

      resolve(image);
    }

    const img = document.createElement("img");
    img.addEventListener("load", onLoad);
    img.addEventListener("error", error => {
      reject(new Error(`Error loading ${name}: ${error.message || "something went wrong"}`));
    });
    img.src = src;
  });
}
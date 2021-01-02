import { useMemo } from "react";
import ImageWorker from "worker-loader!./ImageWorker.ts";
import type { Request, Response, Transformation } from "./ImageWorker";

export type WorkerApi = {
  transformImage: (image: ImageData, trans: Transformation) => Promise<ImageData>,
}

export function useImageWorker(): WorkerApi {
  const transformImage = useMemo(() => {
    const worker = new ImageWorker();
    const outstanding: Array<(image: ImageData) => void> = [];

    const send = (req: Request) => {
      worker.postMessage(req);
    };

    const receive = () => {
      return new Promise<ImageData>(resolve => {
        outstanding.push(resolve);
      });
    };

    worker.addEventListener("message", event => {
      const resolve = outstanding.shift();

      if (!resolve) {
        throw new Error("Received response from worker, but no requests pending");
      }

      const { rgba, width, height } = event.data as Response;
      const data = new Uint8ClampedArray(rgba, rgba.byteOffset, 4 * width * height);
      resolve(new ImageData(data, width, height));
    });

    const transformImage = (image: ImageData, trans: Transformation) => {
      const rgba = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length);
      send({
        image: {
          rgba,
          width: image.width,
          height: image.height,
        },
        trans,
      });
      return receive();
    };

    return transformImage;
  }, []);

  return { transformImage };
}
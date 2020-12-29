import { useMemo, useState } from "react";
import ImageWorker from "worker-loader!./ImageWorker.ts";
import type { Request, Response, Transformation } from "./ImageWorker";

export type WorkerApi = {
  imageMeta: ImageMeta | null,
  setImage: (image: ImageData) => void,
  transformImage: (trans: Transformation) => Promise<ImageData>,
}

export type ImageMeta = {
  width: number,
  height: number,
};

export function useImageWorker(): WorkerApi {
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

  const { setImage, transformImage } = useMemo(() => {
    const worker = new ImageWorker();
    const outstanding: Array<(image: ImageData) => void> = [];

    const send = (req: Request, transfer?: Array<ArrayBuffer>) => {
      worker.postMessage(req, transfer || []);
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

      const { buffer, width, height } = event.data as Response;
      const data = new Uint8ClampedArray(buffer);
      resolve(new ImageData(data, width, height));
    });

    const setImage = (image: ImageData) => {
      send({
        command: "set",
        image: {
          buffer: image.data.buffer,
          width: image.width,
          height: image.height,
        }
      }, [image.data.buffer]);
      setImageMeta({ width: image.width, height: image.height });
    };

    const transformImage = (trans: Transformation) => {
      send(trans);
      return receive();
    };

    return { setImage, transformImage };
  }, []);

  return { imageMeta, setImage, transformImage };
}
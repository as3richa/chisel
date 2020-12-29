import { useMemo, useState } from "react";
import ImageWorker from "worker-loader!./ImageWorker.ts";
import type { Request, Response } from "./ImageWorker";

export type WorkerApi = {
  imageMeta: ImageMeta | null,
  setImage: (image: ImageData) => void,
  carve: (width: number, height: number) => Promise<ImageData>,
  seams: (width: number, height: number) => Promise<ImageData>,
  edges: () => Promise<ImageData>,
  original: () => Promise<ImageData>,
}

export type ImageMeta = {
  width: number,
  height: number,
};

export function useImageWorker(): WorkerApi {
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

  const methods = useMemo(() => {
    const worker = new ImageWorker();
    const outstanding: Array<(image: ImageData) => void> = [];

    const send = (req: Request, transfer?: Array<ArrayBuffer>) => {
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

      const { buffer, width, height } = event.data as Response;
      const data = new Uint8ClampedArray(buffer);
      resolve(new ImageData(data, width, height));
    });

    const setImage = (image: ImageData) => {
      send({
        command: "set",
        image: {
          buffer: image.data,
          width: image.width,
          height: image.height,
        }
      }, [image.data]);
      setImageMeta({ width: image.width, height: image.height });
    };

    const carve = (width: number, height: number) => {
      send({
        command: "carve",
        width,
        height,
      });
      return receive();
    };

    const seams = (width: number, height: number) => {
      send({
        command: "seams",
        width,
        height,
      });
      return receive();
    };

    const edges = () => {
      send({ command: "edges" });
      return receive();
    };

    const original = () => {
      send({ command: "original" });
      return receive();
    };

    return { setImage, carve, seams, edges, original };
  }, []);

  return {
    imageMeta,
    ...methods,
  };
}
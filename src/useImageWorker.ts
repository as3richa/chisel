import { useCallback, useEffect, useMemo, useState } from "react";
import ImageWorker from "worker-loader!./ImageWorker.ts";
import type { Request, Response, Transformation as WorkerTransformation } from "./ImageWorker";

export type Transformation =
  WorkerTransformation |
  { command: "original" };

export type Api = {
  transformImage: (image: ImageData, transformation: Transformation) => Promise<ImageData | null>,
  transformationPending: boolean,
  cancelPendingTransformations: () => void,
};

type Resolve = (transformed: ImageData | null) => void;
type QueuedRequest = { image: ImageData, transformation: Transformation, resolve: Resolve };

export function useImageWorker(): Api {
  const [pending, setPending] = useState<Resolve | null>(null);
  const [queued, setQueued] = useState<QueuedRequest | null>(null);

  const worker = useMemo(() => {
    const worker = new ImageWorker();

    worker.addEventListener("message", event => {
      const { rgba, width, height } = event.data as Response;
      const data = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length);
      const image = new ImageData(data, width, height);

      setPending((pending: Resolve | null) => {
        if (pending === null) {
          throw new Error("Received response from worker, but no request was pending");
        }
        pending(image);
        return null;
      });
    });

    return worker;
  }, []);

  useEffect(() => {
    if (pending === null && queued !== null) {
      const { image, transformation, resolve } = queued;
      setQueued(null);

      if (transformation.command === "original") {
        resolve(image);
        return;
      }

      const { data, width, height } = image;
      const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);

      const request: Request = {
        image: { rgba, width, height },
        transformation: transformation,
      };

      worker.postMessage(request);
      setPending(() => resolve);
    }
  }, [pending, queued, worker]);

  const transformImage = useCallback((image: ImageData, transformation: Transformation) => {
    return new Promise<ImageData | null>(resolve => {
      setQueued(queued => {
        if (queued !== null) {
          queued.resolve(null);
        }

        return {
          image,
          transformation,
          resolve,
        };
      });
    });
  }, []);

  const cancelPendingTransformations = useCallback(() => {
    setQueued(queued => {
      if (queued !== null) {
        queued.resolve(null);
      }
      return null;
    });

    setPending((pending: Resolve | null) => {
      if (pending !== null) {
        pending(null);
        return () => { /**/ };
      }
      return null;
    });
  }, []);

  return {
    transformImage,
    transformationPending: queued !== null || pending !== null,
    cancelPendingTransformations,
  };
}
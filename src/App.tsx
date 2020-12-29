import React, { useMemo, ReactElement, useEffect, useState, CSSProperties } from "react";
import { Controls, Operation, defaultOperation } from "./Controls";
import { loadImage as loadImageData } from "./loadImage";
import { useViewportSize } from "./useViewportSize";
import { ImageDataCanvas } from "./ImageDataCanvas";
import { useImageWorker } from "./useImageWorker";
import { workerData } from "worker_threads";


export function App(): ReactElement {
  const [transformedImageData, setTransformedImageData] = useState<ImageData | null>(null);
  const [scale, setScale] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(defaultOperation);
  const [justLoaded, setJustLoaded] = useState<boolean>(false);

  const worker = useImageWorker();

  const viewportSize = useViewportSize();

  function loadImage(src: string) {
    loadImageData(src)
      .then(image => {
        worker.setImage(image);
      })
      .catch(err => setErrorMessage(err.message || "Oops!"));
  }

  function fitToViewport() {
    if (transformedImageData === null) {
      return;
    }
    const scale = 0.9 * Math.min(
      viewportSize[0] / transformedImageData.width,
      viewportSize[1] / transformedImageData.height
    );
    setScale(Math.max(0.05, Math.min(2, scale)));
  }

  useEffect(() => loadImage("the-persistence-of-memory.jpg"), []);

  useEffect(() => {
    if (transformedImageData !== null && justLoaded) {
      fitToViewport();
      setJustLoaded(false);
    }
  }, [transformedImageData, justLoaded]);

  useEffect(() => {
    if (worker.imageMeta === null) {
      return;
    }

    worker.edges().then(setTransformedImageData);
  }, [worker.imageMeta]);

  const canvasStyle: CSSProperties = useMemo(() => {
    if (transformedImageData === null) {
      return {};
    }

    const scaledWidth = Math.round(scale * transformedImageData.width);
    const scaledHeight = Math.round(scale * transformedImageData.height);

    return {
      position: "absolute",
      width: scaledWidth,
      height: scaledHeight,
      left: scaledWidth < viewportSize[0] ? (viewportSize[0] - scaledWidth) / 2 : 0,
      top: scaledHeight < viewportSize[1] ? (viewportSize[1] - scaledHeight) / 2 : 0
    };
  }, [scale, viewportSize]);

  return (
    <div>
      {transformedImageData && <ImageDataCanvas data={transformedImageData} style={canvasStyle} />}
      <div style={{ position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16 }}>
        <Controls
          loading={false}
          errorMessage={errorMessage}
          scale={scale}
          operation={operation}
          seamCarveRanges={[[1, 1000], [1, 1000]]}
          onUpload={file => loadImage(URL.createObjectURL(file))}
          onScaleChange={setScale}
          onFitToViewport={fitToViewport}
          onOperationChange={setOperation} />
      </div>
    </div>
  );
}
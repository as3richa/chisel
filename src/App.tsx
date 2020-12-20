import React, {useMemo, ReactElement, useEffect, useState, CSSProperties} from "react";
import {Controls, Operation ,defaultOperation} from "./Controls";
import {loadImageData} from "./loadImageData";
import {useViewportSize} from "./useViewportSize";
import {ImageDataCanvas} from "./ImageDataCanvas";
import {detectEdges, edgesToImageData} from "./detectEdges";
import { carveSeams } from "./carveSeam";

export function App(): ReactElement {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [transformedImageData, setTransformedImageData] = useState<ImageData | null>(null);
  const [scale, setScale] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(defaultOperation);
  const [justLoaded, setJustLoaded] = useState<boolean>(false);

  const viewportSize = useViewportSize();

  function loadImage(src: string) {
    loadImageData(src)
      .then(data => {
        setImageData(data);
        setOperation(defaultOperation);
        setJustLoaded(true);
      })
      .catch(err => setErrorMessage(err.message || "Oops!"));
  }

  function fitToViewport() {
    if (transformedImageData === null) {
      return;
    }
    const scale = 0.9*Math.min(
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
    if(imageData === null) {
      return;
    }

    const edges = detectEdges(imageData);

    if (operation.mode === "edge-detect") {
      const data = edgesToImageData(edges, imageData.width, imageData.height);
      setTransformedImageData(data);
    } else {
      setTransformedImageData(carveSeams(imageData, edges, operation.size[0], operation.size[1]));
    }
  }, [imageData, operation]);

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
      <div style={{position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16}}>
        <Controls
          loading={imageData === null}
          errorMessage={errorMessage}
          scale={scale}
          operation={operation}
          seamCarveRanges={imageData === null ? [[0, 0], [0, 0]] : [[-imageData.width + 1, imageData.width], [-imageData.height + 1, imageData.height]]}
          onUpload={file => loadImage(URL.createObjectURL(file))}
          onScaleChange={setScale}
          onFitToViewport={fitToViewport}
          onOperationChange={setOperation} />
      </div>
    </div>
  );
}
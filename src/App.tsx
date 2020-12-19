import React, { ReactElement, useEffect, useState } from "react";
import {Controls, Operation ,defaultOperation} from "./Controls";
import {loadImage, Image} from "./loadImage";
import { useViewportSize } from "./useViewportSize";

export function App(): ReactElement {
  const [viewportWidth, viewportHeight] = useViewportSize();
  const [image, setImage] = useState<Image | null>(null);
  const [scale, setScale] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(defaultOperation);

  useEffect(() => {
    loadImage("the-persistence-of-memory.jpg")
      .then(setImage)
      .catch(err => setErrorMessage(err.message || "Oops!"));
  }, []);

  useEffect(() => {
    setOperation(defaultOperation);
    fitToViewport();
  }, [image]);

  let canvas = null;
  
  if (image !== null) {
    const scaledWidth = Math.round(scale * image.width);
    const scaledHeight = Math.round(scale * image.height);

    canvas = (
      <canvas
        width={image.width}
        height={image.height}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          backgroundColor: "white",
          position: "absolute",
          left: scaledWidth < viewportWidth ? (viewportWidth - scaledWidth) / 2 : 0,
          top: scaledHeight < viewportHeight ? (viewportHeight - scaledHeight) / 2 : 0
        }} />
    );
  }

  function fitToViewport() {
    if (image === null) {
      return;
    }

    const scale = 0.9*Math.min(viewportWidth / image.width, viewportHeight / image.height);
    setScale(Math.max(0.05, Math.min(2, scale)));
  }

  return (
    <div>
      {canvas}
      <div style={{position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16}}>
        <Controls
          loading={image === null}
          errorMessage={errorMessage}
          scale={scale}
          operation={operation}
          seamCarveRanges={image === null ? [[0, 0], [0, 0]] : [[-image.width + 1, image.width], [-image.height + 1, image.height]]}
          onUpload={file => {
            loadImage(URL.createObjectURL(file))
              .then(setImage)
              .catch(err => setErrorMessage(err.message || "Oops!"));
          }}
          onScaleChange={setScale}
          onFitToViewport={fitToViewport}
          onOperationChange={setOperation} />
      </div>
    </div>
  );
}
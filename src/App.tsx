import React, { ReactElement, useEffect, useState } from "react";
import {Controls, Operation} from "./Controls";
import {loadImage, Image} from "./loadImage";
import { useViewportSize } from "./useViewportSize";

export function App(): ReactElement {
  const [viewportWidth, viewportHeight] = useViewportSize();
  const [image, setImage] = useState<Image | null>(null);
  const [scale, setScale] = useState(1);

  const [operation, setOperation] = useState<Operation>({
    mode: "shrink",
    horizontal: 0,
    vertical: 0
  });

  useEffect(() => {
    loadImage("the-persistence-of-memory.jpg").then(image => {
      setImage(image);
    });
  }, []);

  useEffect(() => {
    setOperation({
      mode: "shrink",
      horizontal: 0,
      vertical: 0
    });
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

    const scale = Math.min(viewportWidth / image.width, viewportHeight / image.height);
    setScale(Math.max(0.05, Math.min(2, scale)));
  }

  return (
    <div>
      {canvas}
      <div style={{position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16}}>
        <Controls
          loading={false}
          errorMessage={null}
          scale={scale}
          operation={operation}
          imageSize={image === null ? [1, 1] : [image.width, image.height]}
          onUpload={file => {
            loadImage(URL.createObjectURL(file)).then(setImage).catch(alert);
          }}
          setScale={setScale}
          fitToViewport={fitToViewport}
          setOperation={setOperation} />
      </div>
    </div>
  );
}
import React, { useMemo, ReactElement, useEffect, useState, CSSProperties, useCallback } from "react";
import { Controls } from "./Controls";
import { loadImage as loadImageData } from "./loadImage";
import { useViewportSize } from "./useViewportSize";
import { ImageDataCanvas } from "./ImageDataCanvas";
import { useImageWorker } from "./useImageWorker";
import type { Transformation } from "./ImageWorker";

const placeholderTrans: Transformation = { command: "carve", width: 1, height: 1 };

const minScale = 0.05;
const maxScale = 2;

export function App(): ReactElement {
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);

  const viewport = useViewportSize();

  const [trans, setTrans] = useState<Transformation | null>(null);

  const [transformed, setTransformed] = useState<ImageData | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { imageMeta, setImage, transformImage } = useImageWorker();

  const loadImage = useCallback((src: string) => {
    setTrans(null);

    return loadImageData(src)
      .then(image => {
        setImage(image);
        setTrans({ command: "carve", width: image.width, height: image.height });
      })
      .catch(err => { setErrorMessage(err.message || "Oops!"); });
  }, [setImage]);

  useEffect(() => { loadImage("the-persistence-of-memory.jpg"); }, [loadImage]);

  useEffect(() => {
    if (imageMeta === null || trans === null) {
      return;
    }
    console.log([imageMeta, transformImage, trans]);
    transformImage(trans).then(setTransformed);
  }, [trans, imageMeta, transformImage]);

  useEffect(() => {
    if (!fit || transformed === null) {
      return;
    }

    const scale = 0.85 * Math.min(
      viewport.width / transformed.width,
      viewport.height / transformed.height,
    );

    setScale(Math.min(maxScale, Math.max(minScale, scale)));
  }, [fit, viewport, transformed]);

  const canvasStyle: CSSProperties = useMemo(() => {
    if (transformed === null) {
      return {};
    }

    const width = Math.round(scale * transformed.width);
    const height = Math.round(scale * transformed.height);
    const left = width < viewport.width ? (viewport.width - width) / 2 : 0;
    const top = height < viewport.height ? (viewport.height - height) / 2 : 0;

    return {
      position: "absolute",
      width,
      height,
      left,
      top,
    };
  }, [scale, viewport, transformed]);

  return (
    <div>
      {transformed && <ImageDataCanvas data={transformed} style={canvasStyle} />}
      <div style={{ position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16 }}>
        <Controls
          errorMessage={errorMessage}
          scale={scale}
          minScale={minScale}
          maxScale={maxScale}
          setScale={setScale}
          fit={fit}
          setFit={setFit}
          imageWidth={imageMeta === null ? 1 : imageMeta.width}
          imageHeight={imageMeta === null ? 1 : imageMeta.height}
          trans={trans !== null ? trans : placeholderTrans}
          setTrans={setTrans}
          uploadFile={file => {
            const url = URL.createObjectURL(file);
            loadImage(url).then(() => URL.revokeObjectURL(url));
          }}
        />
      </div>
    </div>
  );
}
import React, { useMemo, ReactElement, useEffect, useState, CSSProperties, useCallback } from "react";
import { Controls } from "./Controls";
import { loadImage } from "./loadImage";
import { useViewportSize } from "./useViewportSize";
import { ImageDataCanvas } from "./ImageDataCanvas";
import { useImageWorker, Transformation } from "./useImageWorker";
import { useImagePasteHandler, useImageDropHandler } from "./useImagePasteDropHandler";

import dali from "./dali.jpg";

const minScale = 0.05;
const maxScale = 2;

export function App(): ReactElement {
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(true);

  const viewport = useViewportSize();

  const [image, setImage] = useState<ImageData | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const [transformation, setTransformation] = useState<Transformation>({
    command: "carve",
    width: 1,
    height: 1
  });

  const [transformedImage, setTransformedImage] = useState<ImageData | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    transformImage,
    transformationPending,
    cancelPendingTransformations
  } = useImageWorker();

  const loadImageFromUrl = useCallback((name: string, src: string) => {
    cancelPendingTransformations();
    setImage(null);
    setImageLoading(true);
    setErrorMessage(null);
    setScale(1);
    setTransformation({
      command: "carve",
      width: 1,
      height: 1,
    });

    return loadImage(name, src)
      .then(image => {
        setTransformation({
          command: "carve",
          width: image.width,
          height: image.height
        });
        setImage(image);
      })
      .catch(err => { setErrorMessage(err.message || "Something went wrong"); })
      .finally(() => setImageLoading(false));
  }, [cancelPendingTransformations]);

  const loadImageFromFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    return loadImageFromUrl(file.name, url).then(() => URL.revokeObjectURL(url));
  }, [loadImageFromUrl]);

  useImagePasteHandler(loadImageFromFile);
  useImageDropHandler(loadImageFromFile);

  useEffect(() => { loadImageFromUrl("dali.jpg", dali); }, [loadImageFromUrl]);

  useEffect(() => {
    if (image === null) {
      setTransformedImage(null);
      return;
    }

    transformImage(image, transformation).then(result => {
      if (result === null) {
        return;
      }
      setTransformedImage(result);
    });
  }, [image, transformation, transformImage]);

  useEffect(() => {
    if (!fit || transformedImage === null) {
      return;
    }

    const scale = 0.85 * Math.min(
      viewport.width / transformedImage.width,
      viewport.height / transformedImage.height,
    );

    setScale(Math.min(maxScale, Math.max(minScale, scale)));
  }, [fit, viewport, transformedImage]);

  const canvasStyle: CSSProperties = useMemo(() => {
    if (transformedImage === null) {
      return {};
    }

    const width = Math.round(scale * transformedImage.width);
    const height = Math.round(scale * transformedImage.height);
    const left = width < viewport.width ? (viewport.width - width) / 2 : 0;
    const top = height < viewport.height ? (viewport.height - height) / 2 : 0;

    return {
      position: "absolute",
      width,
      height,
      left,
      top,
    };
  }, [scale, viewport, transformedImage]);

  return (
    <div>
      {transformedImage && <ImageDataCanvas data={transformedImage} style={canvasStyle} />}
      <div style={{ position: "fixed", top: 16, right: 16, marginLeft: 16, marginBottom: 16 }}>
        <Controls
          loading={imageLoading || transformationPending}
          errorMessage={errorMessage}
          uploadFile={loadImageFromFile}
          uploadDisabled={imageLoading}
          scale={scale}
          minScale={minScale}
          maxScale={maxScale}
          setScale={setScale}
          fit={fit}
          setFit={setFit}
          scaleDisabled={image === null}
          imageWidth={image === null ? 1 : image.width}
          imageHeight={image === null ? 1 : image.height}
          transformation={transformation}
          setTransformation={setTransformation}
          transformationDisabled={image === null}
        />
      </div>
    </div>
  );
}
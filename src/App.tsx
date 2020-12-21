import React, {useMemo, ReactElement, useEffect, useState, CSSProperties} from "react";
import {Controls, Operation ,defaultOperation} from "./Controls";
import {loadImageData} from "./loadImageData";
import {useViewportSize} from "./useViewportSize";
import {ImageDataCanvas} from "./ImageDataCanvas";
import {detectEdges, edgesToImageData} from "./detectEdges";
import { carveSeams } from "./carveSeam";
import type {EnergyMap} from "./gouge/pkg";

type Gouge = {
  rgba_to_energy: (rgba: Uint8Array, width: number, height: number) => EnergyMap,
  energy_to_rgba: (energy: EnergyMap) => Uint8Array,
  detect_edges: (energy: EnergyMap) => EnergyMap,
};

export function App(): ReactElement {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [transformedImageData, setTransformedImageData] = useState<ImageData | null>(null);
  const [scale, setScale] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operation, setOperation] = useState<Operation>(defaultOperation);
  const [justLoaded, setJustLoaded] = useState<boolean>(false);
  const [gouge, setGouge] = useState<Gouge | null>(null);

  const viewportSize = useViewportSize();

  useEffect(() => { 
    import("./gouge/pkg")
      .then(setGouge)
      .catch(alert);
  }, []);

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
    if(imageData === null || gouge === null) {
      return;
    }

    const energy = gouge.rgba_to_energy(new Uint8Array(imageData.data.buffer), imageData.width, imageData.height);
    const edges = gouge.detect_edges(energy);
    const rgba = gouge.energy_to_rgba(edges);

    console.log(rgba);

    setTransformedImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), imageData.width, imageData.height));
  }, [imageData, operation, gouge]);

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
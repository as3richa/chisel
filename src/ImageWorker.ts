const ctx = self as unknown as Worker;

import {
  carveImage,
  highlightSeams,
  horizontalGradientMap,
  intensityMap,
  mapToRgba,
  verticalGradientMap,
} from "./imageProcessing";

export type Axis = "horizontal" | "vertical";

export type CarveTransformation = {
  command: "carve",
  width: number,
  height: number,
};

export type HighlightTransformation = {
  command: "highlight",
  axis: Axis,
  count: number,
};

export type GradientTransformation = {
  command: "gradient",
  axis: Axis,
};

export type IntensityTransformation = { command: "intensity" };

export type Transformation =
  CarveTransformation |
  HighlightTransformation |
  GradientTransformation |
  IntensityTransformation;

export type TransferableImageData = {
  rgba: Uint8Array,
  width: number,
  height: number,
};

export type Request = {
  image: TransferableImageData,
  trans: Transformation,
};

export type Response = TransferableImageData;

function sendImage(rgba: Uint8Array, width: number, height: number) {
  ctx.postMessage({
    rgba: rgba,
    width,
    height
  }, [rgba.buffer]);
}

ctx.addEventListener("message", event => {
  const message = event.data as Request;

  const { rgba, width, height } = message.image;

  const startedAt = performance.now();
  let memo = `${message.trans.command} ${width}x${height}`;

  switch (message.trans.command) {
  case "carve": {
    const { width: carvedWidth, height: carvedHeight } = message.trans;
    memo += ` -> ${carvedWidth}x${carvedHeight}`;
    const carved = carveImage(
      rgba,
      width,
      height,
      carvedWidth,
      carvedHeight
    );
    sendImage(carved, carvedWidth, carvedHeight);
    break;
  }

  case "highlight": {
    const { axis, count } = message.trans;
    memo += ` ${count} ${axis}`;
    const highlighted = highlightSeams(
      rgba,
      width,
      height,
      axis === "vertical",
      count,
    );
    sendImage(highlighted, width, height);
    break;
  }

  case "gradient": {
    const { axis } = message.trans;
    memo += ` ${axis}`;
    const intens = intensityMap(rgba, width, height);
    const grad = (axis === "vertical")
      ? verticalGradientMap(intens, width, height)
      : horizontalGradientMap(intens, width, height);
    sendImage(mapToRgba(grad, width * height), width, height);
    break;
  }

  case "intensity": {
    const intens = intensityMap(rgba, width, height);
    sendImage(mapToRgba(intens, width * height), width, height);
    break;
  }
  }

  console.log(`${memo}: ${performance.now() - startedAt}ms`);
});
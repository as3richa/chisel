import React, { CSSProperties, ReactElement, useCallback, useEffect, useState } from "react";

export type ImageDataCanvasProps = {
  data: ImageData,
  style: CSSProperties,  
};

export function ImageDataCanvas({data, style}: ImageDataCanvasProps): ReactElement {
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  const setCanvas = useCallback(canvas => {
    setCtx(canvas?.getContext("2d"));
  }, []);

  useEffect(() => {
    if (ctx === null) {
      return;
    }
    ctx.putImageData(data, 0, 0);
  }, [data, ctx]);

  return (
    <canvas width={data.width} height={data.height} style={style} ref={setCanvas} />
  );
}
import React, { CSSProperties, ReactElement, useCallback, useEffect, useMemo, useRef } from "react";

const ctxError = new Error("HTMLCanvasElement#getContext(\"2d\") returned null");

export type ImageDataCanvasProps = {
  data: ImageData,
  style: CSSProperties,  
};

export function ImageDataCanvas({data, style}: ImageDataCanvasProps): ReactElement {
  const canvasSize = useMemo<[number, number]>(() => {
    return [data.width, data.height];
  }, [data]);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const setCanvas = useCallback(canvas => {
    if (canvas === null) {
      ctxRef.current = null;
    } else {
      const ctx = canvas.getContext("2d");
      if (ctx === null) {
        throw ctxError;
      }
      ctxRef.current = ctx;
    }
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx === null) {
      return;
    }
    ctx.putImageData(data, 0, 0);
  }, [canvasSize]);

  return (
    <canvas width={data.width} height={data.height} style={style} ref={setCanvas} />
  );
}
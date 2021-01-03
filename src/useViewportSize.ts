import { useEffect, useState } from "react";

export type ViewportSize = {
  width: number,
  height: number,
};

export function useViewportSize(): ViewportSize {
  const html = document.documentElement;

  const [viewportSize, setViewportSize] = useState<ViewportSize>({
    width: html.clientWidth,
    height: html.clientHeight,
  });

  useEffect(() => {
    const onResize = () => {
      setViewportSize({
        width: html.clientWidth,
        height: html.clientHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [html]);

  return viewportSize;
}
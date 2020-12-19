import { useEffect, useState } from "react";

export function useViewportSize(): [number, number] {
  const html = document.documentElement;
  const [viewportSize, setViewportSize] = useState<[number, number]>([
    html.clientWidth, html.clientHeight
  ]);

  useEffect(() => {
    function onResize() {
      const html = document.documentElement;
      setViewportSize([html.clientWidth, html.clientHeight]);
    }
    window.addEventListener("resize", onResize);

    return () => { window.removeEventListener("resize", onResize); };
  }, []);

  return viewportSize;
}
import React, { ReactElement, useState } from "react";
import {Controls, Operation} from "./Controls";

export function App(): ReactElement {
  const [scale, setScale] = useState(1);

  const [operation, setOperation] = useState<Operation>({
    mode: "shrink",
    horizontal: 0,
    vertical: 0
  });

  return (
    <div style={{position: "absolute", top: 16, right: 16, marginLeft: 16, marginBottom: 16}}>
      <Controls
        loading={false}
        errorMessage={null}
        scale={scale}
        operation={operation}
        imageSize={[13, 37]}
        onUpload={() => alert("upload")}
        setScale={setScale}
        fitToViewport={() => alert("fit")}
        setOperation={setOperation} />
    </div>
  );
}
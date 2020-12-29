import React, { ReactElement } from "react";
import type { CarveTransformation, Transformation } from "./ImageWorker";

type Props = {
  errorMessage: string | null,
  scale: number,
  minScale: number,
  maxScale: number,
  setScale: (scale: number) => void,
  fit: boolean,
  setFit: (fit: boolean) => void,
  imageWidth: number,
  imageHeight: number,
  trans: Transformation,
  setTrans: (trans: Transformation) => void,
  uploadFile: (file: File) => void,
};

export function Controls(props: Props): ReactElement {
  const {
    errorMessage,
    scale,
    minScale,
    maxScale,
    setScale,
    fit,
    setFit,
    trans,
    setTrans,
    imageWidth,
    imageHeight,
    uploadFile,
  } = props;

  const errorBanner = errorMessage && (
    <div style={{ marginBottom: 12, color: "#ff0000" }}>{errorMessage}</div>
  );

  let carveControls = null;

  if (trans.command === "carve" || trans.command === "seams") {
    carveControls = (
      <Carve
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        trans={trans}
        setTrans={setTrans}
        disabled={false}
      />
    );
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid grey",
        padding: "12px",
        color: "#333",
        backgroundColor: "#eee",
        width: 200,
        fontSize: 12
      }}>
      {errorBanner}
      <UploadInput uploadFile={uploadFile} />
      <Scale
        scale={scale}
        min={minScale}
        max={maxScale}
        setScale={setScale}
        fit={fit}
        setFit={setFit}
        disabled={false}
      />
      <CommandSelect
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        trans={trans}
        setTrans={setTrans}
        disabled={false}
      />
      {carveControls}
    </div>
  );
}

type LabeledNumericInputProps = {
  label: string,
  value: number,
  min: number,
  max: number,
  def: number
  units: string,
  disabled: boolean,
  onChange: (value: number) => void,
}

function LabeledNumericInput(props: LabeledNumericInputProps): ReactElement {
  const { label, value, min, max, def, units, disabled, onChange } = props;

  function handleEvent(event: React.ChangeEvent<HTMLInputElement>) {
    let value = parseInt(event.target.value);
    if (isNaN(value)) {
      value = def;
    } else if (value < min) {
      value = min;
    } else if (value > max) {
      value = max;
    }
    onChange(value);
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>{label}:</div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="number"
          style={{ fontSize: 12, width: 80 }}
          value={value}
          min={min}
          max={max}
          onChange={handleEvent}
          disabled={disabled} />
        {" "}{units}
      </div>
      <input
        type="range"
        style={{ margin: "0 0 8px 0", display: "block" }}
        value={value}
        min={min}
        max={max}
        onChange={handleEvent}
        disabled={disabled} />
    </div>
  );
}

type UploadInputProps = {
  uploadFile: (file: File) => void,
};

function UploadInput({ uploadFile }: UploadInputProps): ReactElement {
  return (
    <label style={{
      display: "block",
      cursor: "pointer",
      textDecoration: "underline",
      marginBottom: 12
    }}>
      <input
        type="file"
        style={{ display: "none" }}
        accept="image/*"
        onChange={event => {
          const file = event.target.files && event.target.files[0];
          if (file !== null) {
            uploadFile(file);
          }
        }}
      />
    Upload image...
    </label>
  );
}

type ScaleProps = {
  scale: number,
  min: number,
  max: number,
  setScale: (scale: number) => void,
  fit: boolean,
  setFit: (fit: boolean) => void,
  disabled: boolean,
};

function Scale({ scale, min, max, setScale, fit, setFit, disabled }: ScaleProps): ReactElement {
  return (
    <div style={{ marginBottom: 12 }}>
      <LabeledNumericInput
        label="Scale"
        value={Math.round(100 * scale)}
        min={Math.round(100 * min)}
        max={Math.round(100 * max)}
        def={100}
        onChange={value => {
          setFit(false);
          setScale(value / 100);
        }}
        units="%"
        disabled={disabled}
      />
      <label style={{ display: "block" }}>
        <input type="checkbox" checked={fit} onChange={event => setFit(event.target.checked)} />
        <span style={{ marginLeft: 4, verticalAlign: 3 }}>Fit to viewport</span>
      </label>
    </div>
  );
}

type CommandSelectProps = {
  imageWidth: number,
  imageHeight: number,
  trans: Transformation,
  setTrans: (trans: Transformation) => void,
  disabled: boolean,
};

function CommandSelect({ imageWidth, imageHeight, trans, setTrans, disabled }: CommandSelectProps): ReactElement {
  const options = [
    { value: "carve", memo: "Carve seams" },
    { value: "seams", memo: "Highlight seams" },
    { value: "edges", memo: "Detect edges" },
    { value: "intens", memo: "Compute Intensity" },
    { value: "original", memo: "Show original" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 8 }}>Operation:</div>
      <select
        style={{ width: "100%", fontSize: 12, display: "block", marginBottom: 12 }}
        value={trans.command}
        disabled={disabled}
        onChange={event => {
          const command = event.target.value;

          if (command === trans.command) {
            return;
          }

          if (command === "carve" || command === "seams") {
            const [width, height] = (trans.command === "carve" || trans.command === "seams")
              ? [trans.width, trans.height]
              : [imageWidth, imageHeight];
            setTrans({ command, width, height });
          } else {
            if (command !== "edges" && command !== "intens" && command !== "original") {
              throw new Error("Bad command");
            }
            setTrans({ command });
          }
        }}>
        {options.map(({ value, memo }) => <option key={value} value={value}>{memo}</option>)}
      </select>
    </div>
  );
}

type CarveProps = {
  imageWidth: number,
  imageHeight: number,
  trans: CarveTransformation,
  setTrans: (trans: Transformation) => void,
  disabled: boolean,
}

function Carve({ imageWidth, imageHeight, trans, setTrans, disabled }: CarveProps): ReactElement {
  return (
    <div>
      <LabeledNumericInput
        label="Width"
        value={trans.width}
        min={1}
        max={2 * imageWidth}
        def={imageWidth}
        units="pixels"
        disabled={disabled}
        onChange={value => {
          setTrans({
            command: trans.command,
            width: value,
            height: trans.height,
          });
        }}
      />
      <LabeledNumericInput
        label="Height"
        value={trans.height}
        min={1}
        max={2 * imageHeight}
        def={imageHeight}
        units="pixels"
        disabled={disabled}
        onChange={value => {
          setTrans({
            command: trans.command,
            width: trans.width,
            height: value,
          });
        }}
      />
    </div>
  );
}
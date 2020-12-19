import React, { ReactElement } from "react";

export type Operation =
  { mode: "shrink", horizontal: number, vertical: number } |
  { mode: "enlarge", horizontal: number, vertical: number } |
  { mode: "detect-edges" };

export type ControlProps = {
  loading: boolean,
  errorMessage: string | null,
  scale: number,
  operation: Operation,
  imageSize: [number, number],
  onUpload: (file: File) => void,
  setScale: (scale: number) => void,
  fitToViewport: () => void,
  setOperation: (op: Operation) => void
};

type LabeledNumericInputProps = {
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
  units: string,
  disabled: boolean
}

function LabeledNumericInput(props: LabeledNumericInputProps): ReactElement {
  const {label, value, min, max, onChange, units, disabled} = props;
  
  function handleEvent(event: React.ChangeEvent<HTMLInputElement>) {
    let value = parseInt(event.target.value);
    if (isNaN(value) || value < min) {
      value = min;
    } else if (value > max) {
      value = max;
    }
    onChange(value);
  }

  return (
    <div>
      <div style={{marginBottom: 8}}>{label}:</div>
      <div style={{marginBottom: 8}}>
        <input
          type="number"
          style={{fontSize: 12, width: 80}}
          value={value}
          min={min}
          max={max}
          onChange={handleEvent}
          disabled={disabled} />
        {" "}{units}
      </div>
      <input
        type="range"
        style={{margin: "0 0 8px 0", display: "block"}}
        value={value}
        min={min}
        max={max}
        onChange={handleEvent}
        disabled={disabled} />
    </div>
  );
}

export function Controls(props: ControlProps): ReactElement {
  const {
    loading,
    errorMessage,
    scale,
    operation,
    imageSize,
    onUpload,
    setScale,
    fitToViewport,
    setOperation
  } = props;

  const upload = (
    <label style={{
      display: "block",
      cursor: "pointer",
      textDecoration: "underline",
      marginBottom: 12
    }}>
      <input
        type="file"
        style={{display: "none"}}
        accept="image/*"
        onChange={event => {
          const file = event.target.files && event.target.files[0];
          if (file !== null) {
            onUpload(file);
          }
        }}
        disabled={loading}
      />
      Upload image...
    </label>
  );

  const scaleControls = (
    <div style={{marginBottom: 12}}>
      <LabeledNumericInput
        label="Scale"
        value={Math.round(100*scale)}
        min={5}
        max={200}
        onChange={value => setScale(value / 100)}
        units="%"
        disabled={loading || errorMessage !== null}
      />
      <button
        style={{fontSize: 12, width: "100%"}}
        onClick={fitToViewport}
      >Fit to viewport</button>
    </div>
  );

  const modeSelect = (
    <div>
      <div style={{marginBottom: 8}}>Mode:</div>
      <select
        style={{width: "100%", fontSize: 12, display: "block", marginBottom: 12}}
        value={operation.mode}
        onChange={event => {
          const mode = event.target.value;

          if (mode === operation.mode) {
            return;
          }
          
          if (mode === "shrink" || mode === "enlarge") {
            setOperation({mode, horizontal: 0, vertical: 0});
          } else {
            setOperation({mode: "detect-edges"});
          }
        }}>
        <option value="shrink">
          Shrink image
        </option>
        <option value="enlarge">
          Enlarge image
        </option>
        <option value="detect-edges">
          Detect edges
        </option>
      </select>
    </div>
  );

  const operationControls = (operation.mode === "detect-edges")
    ? null
    : (
      <div>
        <LabeledNumericInput
          label="Horizontal"
          value={operation.horizontal}
          min={0}
          max={imageSize[0] - 1}
          onChange={value => {
            setOperation({
              mode: operation.mode,
              horizontal: value,
              vertical: operation.vertical
            });
          }}
          units ="pixels"
          disabled={loading || errorMessage !== null}
        />
        <LabeledNumericInput
          label="Vertical"
          value={operation.vertical}
          min={0}
          max={imageSize[1] - 1}
          onChange={value => {
            setOperation({
              mode: operation.mode,
              horizontal: operation.horizontal,
              vertical: value
            });
          }}
          units ="pixels"
          disabled={loading || errorMessage !== null}
        />
      </div>
    );

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
      {upload}
      {scaleControls}
      {modeSelect}
      {operationControls}
    </div>);
}
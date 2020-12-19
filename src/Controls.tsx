import React, { ReactElement } from "react";

export type ControlsProps = {
  loading: boolean,
  errorMessage: string | null,
  scale: number,
  operation: Operation,
  seamCarveRanges: [[number, number], [number, number]],
  onUpload: (file: File) => void,
  onScaleChange: (scale: number) => void,
  onFitToViewport: () => void,
  onOperationChange: (op: Operation) => void
};

export type Operation =
  { mode: "seam-carve", size: [number, number], highlight: boolean } |
  { mode: "edge-detect" };

export const defaultOperation: Operation = {
  mode: "seam-carve",
  size: [0, 0],
  highlight: false,
};

type LabeledNumericInputProps = {
  label: string,
  value: number,
  range: [number, number],
  def: number
  units: string,
  disabled: boolean,
  onChange: (value: number) => void,
}

function LabeledNumericInput(props: LabeledNumericInputProps): ReactElement {
  const {label, value, range: [min, max], def, units, disabled, onChange} = props;
  
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

export function Controls(props: ControlsProps): ReactElement {
  const {
    loading,
    errorMessage,
    scale,
    operation,
    seamCarveRanges: [hSeamCarveRange, vSeamCarveRange],
    onUpload,
    onScaleChange: setScale,
    onFitToViewport: fitToViewport,
    onOperationChange: setOperation
  } = props;

  const errorBanner = errorMessage && (
    <div style={{marginBottom: 12, color: "#f00"}}>{errorMessage}</div>
  );

  const uploadInput = (
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
        range={[5, 200]}
        def={100}
        onChange={value => setScale(value / 100)}
        units="%"
        disabled={loading || errorMessage !== null}
      />
      <button
        style={{fontSize: 12, width: "100%"}}
        disabled={loading || errorMessage !== null}
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
        disabled={loading || errorMessage !== null}
        onChange={event => {
          const mode = event.target.value;

          if (mode === operation.mode) {
            return;
          }
          
          if (mode === "seam-carve") {
            setOperation(defaultOperation);
          } else {
            setOperation({mode: "edge-detect"});
          }
        }}>
        <option value="seam-carve">
          Shrink/enlarge image
        </option>
        <option value="edge-detect">
          Detect edges
        </option>
      </select>
    </div>
  );

  const operationControls = (operation.mode === "edge-detect") ? null :
    (
      <div>
        <LabeledNumericInput
          label="Horizontal"
          value={operation.size[0]}
          range={hSeamCarveRange}
          def={0}
          units ="pixels"
          disabled={loading || errorMessage !== null}
          onChange={value => {
            setOperation({
              mode: operation.mode,
              size: [value, operation.size[1]],
              highlight: operation.highlight,
            });
          }}
        />
        <LabeledNumericInput
          label="Vertical"
          value={operation.size[1]}
          range={vSeamCarveRange}
          def={0}
          units ="pixels"
          disabled={loading || errorMessage !== null}
          onChange={value => {
            setOperation({
              mode: operation.mode,
              size: [operation.size[0], value],
              highlight: operation.highlight,
            });
          }}
        />
        <label>
          <input type="checkbox"
            disabled={loading || errorMessage !== null}
            checked={operation.highlight} style={{verticalAlign: "middle"}}
            onChange={event => {
              setOperation({
                mode: operation.mode,
                size: operation.size,
                highlight: event.target.checked,
              });
            }}
          />
          {" "}Highlight seams
        </label>
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
      {errorBanner}
      {uploadInput}
      {scaleControls}
      {modeSelect}
      {operationControls}
    </div>);
}
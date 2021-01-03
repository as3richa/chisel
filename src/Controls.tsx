import React, { ChangeEvent, ReactElement, ReactNode, useState } from "react";
import type { Axis, CarveTransformation, HighlightTransformation } from "./ImageWorker";
import type { Transformation } from "./useImageWorker";

import expandIcon from "./icons/expand.png";
import collapseIcon from "./icons/collapse.png";
import loadingIcon from "./icons/loading.png";
import doneIcon from "./icons/done.png";

type Props = {
  loading: boolean,
  errorMessage: string | null,
  uploadFile: (file: File) => void,
  uploadDisabled: boolean,
  scale: number,
  minScale: number,
  maxScale: number,
  setScale: (scale: number) => void,
  fit: boolean,
  setFit: (fit: boolean) => void,
  scaleDisabled: boolean,
  imageWidth: number,
  imageHeight: number,
  transformation: Transformation,
  setTransformation: (transformation: Transformation) => void,
  transformationDisabled: boolean,
};

export function Controls(props: Props): ReactElement {
  const {
    loading,
    errorMessage,
    uploadFile,
    uploadDisabled,
    scale,
    minScale,
    maxScale,
    setScale,
    fit,
    setFit,
    scaleDisabled,
    transformation,
    setTransformation: setTransformation,
    transformationDisabled,
    imageWidth,
    imageHeight,
  } = props;

  const [collapsed, setCollapsed] = useState(false);

  const icons = (
    <div style={{ textAlign: "right" }}>
      <img
        width={15}
        height={15}
        src={loading ? loadingIcon : doneIcon}
      />
      <img
        width={15}
        height={15}
        src={collapsed ? expandIcon : collapseIcon}
        style={{ marginLeft: 8, cursor: "pointer" }}
        onClick={() => setCollapsed(!collapsed)}
      />
    </div>
  );

  const errorBanner = errorMessage && (
    <div style={{ marginBottom: 12, color: "#ff0000" }}>{errorMessage}</div>
  );

  if (collapsed) {
    return (
      <Container width={65}>
        {icons}
        {errorBanner}
      </Container>
    );
  }

  let transformationControls = null;

  if (transformation.command === "carve") {
    transformationControls = (
      <Carve
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        transformation={transformation}
        setTransformation={setTransformation}
        disabled={transformationDisabled}
      />
    );
  } else if (transformation.command === "highlight") {
    transformationControls = (
      <Highlight
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        transformation={transformation}
        setTransformation={setTransformation}
        disabled={transformationDisabled}
      />
    );
  } else if (transformation.command === "gradient") {
    transformationControls = (
      <AxisSelect
        axis={transformation.axis}
        setAxis={axis => {
          setTransformation({
            command: "gradient",
            axis: axis,
          });
        }}
        disabled={transformationDisabled}
      />
    );
  }

  return (
    <Container width={200}>
      {icons}
      {errorBanner}
      <UploadInput uploadFile={uploadFile} disabled={uploadDisabled} />
      <Scale
        scale={scale}
        min={minScale}
        max={maxScale}
        setScale={setScale}
        fit={fit}
        setFit={setFit}
        disabled={scaleDisabled}
      />
      <CommandSelect
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        transformation={transformation}
        setTransformation={setTransformation}
        disabled={transformationDisabled}
      />
      {transformationControls}
    </Container>
  );
}

type ContainerProps = {
  width: number,
  children: ReactNode,
};

function Container({ children, width }: ContainerProps): ReactElement {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid grey",
        padding: "12px",
        color: "#333",
        backgroundColor: "#eee",
        width,
        fontSize: 12
      }}>
      {children}
    </div>
  );
}

type LabeledNumericInputProps = {
  label: string,
  value: number,
  min: number,
  max: number,
  setValue: (value: number) => void,
  units: string,
  disabled: boolean,
}

function LabeledNumericInput(props: LabeledNumericInputProps): ReactElement {
  const { label, value, min, max, units, disabled, setValue } = props;

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (!isNaN(value) && min <= value && value <= max) {
      setValue(value);
    }
  };

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
          onChange={onChange}
          disabled={disabled}
        />
        {" "}{units}
      </div>
      <input
        type="range"
        style={{ marginBottom: 8, display: "block" }}
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

type UploadInputProps = {
  uploadFile: (file: File) => void,
  disabled: boolean,
};

function UploadInput({ uploadFile, disabled }: UploadInputProps): ReactElement {
  return (
    <label style={{
      display: "block",
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "darkgray" : "inherit",
      textDecoration: "underline",
      marginBottom: 8,
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
        disabled={disabled}
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
        setValue={value => {
          if (Math.abs(value / 100 - scale) <= 1e-3) {
            return;
          }
          setFit(false);
          setScale(value / 100);
        }}
        units="%"
        disabled={disabled}
      />
      <label style={{ display: "block" }}>
        <input
          type="checkbox"
          checked={fit} onChange={event => setFit(event.target.checked)}
          disabled={disabled}
        />
        <span style={{ marginLeft: 4, verticalAlign: 3 }}>Fit to viewport</span>
      </label>
    </div>
  );
}

type CommandSelectProps = {
  imageWidth: number,
  imageHeight: number,
  transformation: Transformation,
  setTransformation: (transformation: Transformation) => void,
  disabled: boolean,
};

function CommandSelect({ imageWidth, imageHeight, transformation, setTransformation, disabled }: CommandSelectProps): ReactElement {
  const options = [
    { value: "carve", memo: "Carve seams" },
    { value: "highlight", memo: "Highlight seams" },
    { value: "gradient", memo: "Compute gradient" },
    { value: "intensity", memo: "Compute Intensity" },
    { value: "original", memo: "Show original" }
  ];

  return (
    <label style={{ display: "block" }}>
      <div style={{ marginBottom: 8 }}>Operation:</div>
      <select
        style={{ width: "100%", fontSize: 12, display: "block", marginBottom: 12 }}
        value={transformation.command}
        disabled={disabled}
        onChange={event => {
          const command = event.target.value;

          if (command === transformation.command) {
            return;
          }

          switch (command) {
          case "carve":
            setTransformation({ command, width: imageWidth, height: imageHeight });
            break;

          case "highlight":
            setTransformation({ command, axis: "horizontal", count: 0 });
            break;

          case "gradient":
            setTransformation({ command, axis: "horizontal" });
            break;

          case "intensity":
          case "original":
            setTransformation({ command });
            break;
          }
        }}>
        {options.map(({ value, memo }) => <option key={value} value={value}>{memo}</option>)}
      </select>
    </label>
  );
}

type CarveProps = {
  imageWidth: number,
  imageHeight: number,
  transformation: CarveTransformation,
  setTransformation: (transformation: Transformation) => void,
  disabled: boolean,
}

function Carve({ imageWidth, imageHeight, transformation, setTransformation, disabled }: CarveProps): ReactElement {
  return (
    <div>
      <LabeledNumericInput
        label="Width"
        value={transformation.width}
        min={1}
        max={2 * imageWidth}
        units="pixels"
        disabled={disabled}
        setValue={value => {
          setTransformation({
            command: "carve",
            width: value,
            height: transformation.height,
          });
        }}
      />
      <LabeledNumericInput
        label="Height"
        value={transformation.height}
        min={1}
        max={2 * imageHeight}
        units="pixels"
        disabled={disabled}
        setValue={value => {
          setTransformation({
            command: "carve",
            width: transformation.width,
            height: value,
          });
        }}
      />
      <button
        style={{ fontSize: 12, width: "100%" }}
        onClick={() => {
          setTransformation({
            command: transformation.command,
            width: imageWidth,
            height: imageHeight,
          });
        }}
        disabled={disabled}
      >
        Reset dimensions
      </button>
    </div>
  );
}

type HighlightProps = {
  imageWidth: number,
  imageHeight: number,
  transformation: HighlightTransformation,
  setTransformation: (transformation: Transformation) => void,
  disabled: boolean,
}

function Highlight(props: HighlightProps): ReactElement {
  const {
    imageWidth,
    imageHeight,
    transformation,
    setTransformation,
    disabled,
  } = props;

  return (
    <div>
      <AxisSelect
        axis={transformation.axis}
        setAxis={axis => {
          setTransformation({
            command: "highlight",
            axis: axis,
            count: 0,
          });
        }}
        disabled={disabled}
      />
      <LabeledNumericInput
        label="Count"
        value={transformation.count}
        min={0}
        max={transformation.axis === "vertical" ? imageWidth : imageHeight}
        units="seams"
        disabled={disabled}
        setValue={value => {
          setTransformation({
            command: "highlight",
            axis: transformation.axis,
            count: value,
          });
        }}
      />
    </div>
  );
}

type AxisSelectProps = {
  axis: Axis,
  setAxis: (axis: Axis) => void,
  disabled: boolean,
};

function AxisSelect({ axis, setAxis, disabled }: AxisSelectProps): ReactElement {
  return (
    <label style={{ display: "block" }}>
      <div style={{ marginBottom: 8 }}>Axis:</div>
      <select
        style={{ display: "block", width: "100%", fontSize: 12, marginBottom: 12 }}
        value={axis}
        disabled={disabled}
        onChange={event => {
          const value = event.target.value;

          if (value === axis) {
            return;
          }

          if (value !== "horizontal" && value !== "vertical") {
            return;
          }

          setAxis(value);
        }}>
        <option value={"horizontal"}>Horizontal</option>
        <option value={"vertical"}>Vertical</option>
      </select>
    </label>
  );
}
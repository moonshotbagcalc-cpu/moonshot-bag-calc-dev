import React, { useMemo, useState } from "react";

const INCH_TO_CM = 2.54;
const EIGHTH_LABELS = ["0", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"];

const CURVE_STYLES = {
  gentle: { label: "Gentle", exponent: 1.7 },
  standard: { label: "Standard", exponent: 1.35 },
  full: { label: "Full", exponent: 1.0 },
  dramatic: { label: "Dramatic", exponent: 0.85 },
};

const initialValues = {
  centerPanelWidth: 10,
  insertVisualHeight: 9,
  insertMaxWidth: 3,
  flatEndLength: 1,
  seamAllowance: 0.5,
  openTopFinishAllowance: 0,
  gussetDepth: 4,
  zipperTapeWidth: 1.25,
  visibleZipperWidth: 0.5,
  zipperSeamAllowance: 0.375,
};

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function trimNumber(value, digits = 2) {
  return Number(value.toFixed(digits)).toString();
}

function roundToEighth(value) {
  return Math.round(value * 8) / 8;
}

function formatInchesFraction(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  let abs = Math.abs(roundToEighth(value));
  let whole = Math.floor(abs);
  let eighth = Math.round((abs - whole) * 8);

  if (eighth === 8) {
    whole += 1;
    eighth = 0;
  }

  if (whole === 0 && eighth === 0) return `0\u2033`;
  if (eighth === 0) return `${sign}${whole}\u2033`;
  if (whole === 0) return `${sign}${EIGHTH_LABELS[eighth]}\u2033`;
  return `${sign}${whole} ${EIGHTH_LABELS[eighth]}\u2033`;
}

function formatMeasurement(valueInches, unitSystem, imperialMode, digits = 2) {
  if (!Number.isFinite(valueInches)) return "—";

  if (unitSystem === "metric") {
    return `${trimNumber(valueInches * INCH_TO_CM, 1)} cm`;
  }

  if (imperialMode === "decimals") {
    return `${trimNumber(valueInches, digits)}\u2033`;
  }

  return formatInchesFraction(valueInches);
}

function toCm(inches) {
  return inches * INCH_TO_CM;
}

function fromCm(cm) {
  return cm / INCH_TO_CM;
}

function profileAt(t, curveStyle) {
  const style = CURVE_STYLES[curveStyle] || CURVE_STYLES.standard;
  const base = Math.sin(Math.PI * clamp(t, 0, 1));
  return Math.pow(Math.max(0, base), style.exponent);
}

function widthAtT(flatEndLength, insertMaxWidth, t, curveStyle) {
  const flat = Math.max(0, flatEndLength);
  const max = Math.max(flat, insertMaxWidth);
  return flat + (max - flat) * profileAt(t, curveStyle);
}

function sideCurvePoints({
  side = "left",
  visualHeight,
  flatEndLength,
  insertMaxWidth,
  curveStyle,
  samples = 96,
}) {
  const points = [];
  const direction = side === "left" ? -1 : 1;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const y = t * visualHeight;
    const width = widthAtT(flatEndLength, insertMaxWidth, t, curveStyle);
    const x = direction * width / 2;
    points.push({ x, y, t });
  }

  return points;
}

function curveLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.hypot(dx, dy);
  }
  return length;
}

function pointsToPath(points, close = false) {
  if (!points.length) return "";
  const [first, ...rest] = points;
  return [
    `M ${first.x.toFixed(3)} ${first.y.toFixed(3)}`,
    ...rest.map((p) => `L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`),
    close ? "Z" : "",
  ].join(" ");
}

function insertShapePoints({ visualHeight, flatEndLength, insertMaxWidth, curveStyle, samples = 96 }) {
  const right = sideCurvePoints({
    side: "right",
    visualHeight,
    flatEndLength,
    insertMaxWidth,
    curveStyle,
    samples,
  });
  const left = sideCurvePoints({
    side: "left",
    visualHeight,
    flatEndLength,
    insertMaxWidth,
    curveStyle,
    samples,
  }).reverse();

  return [...right, ...left];
}

function addTransform(points, dx, dy) {
  return points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

function SvgDimensionLine({ x1, y1, x2, y2, label, offset = 0, orientation = "horizontal" }) {
  const isHorizontal = orientation === "horizontal";
  const ox = isHorizontal ? 0 : offset;
  const oy = isHorizontal ? offset : 0;

  return (
    <g className="ms-dim">
      <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} />
      <line x1={x1} y1={y1} x2={x1 + ox} y2={y1 + oy} />
      <line x1={x2} y1={y2} x2={x2 + ox} y2={y2 + oy} />
      <text
        x={(x1 + x2) / 2 + ox}
        y={(y1 + y2) / 2 + oy - 4}
        textAnchor="middle"
        dominantBaseline="auto"
      >
        {label}
      </text>
    </g>
  );
}

function FractionInput({ label, value, onChange, min = 0, max = 999, help }) {
  const rounded = roundToEighth(value);
  let whole = Math.floor(Math.max(0, rounded));
  let eighth = Math.round((rounded - whole) * 8);
  if (eighth === 8) {
    whole += 1;
    eighth = 0;
  }

  function update(nextWhole, nextEighth) {
    const next = Number(nextWhole || 0) + Number(nextEighth || 0) / 8;
    onChange(clamp(next, min, max));
  }

  return (
    <label className="ms-field">
      <span className="ms-label">{label}</span>
      <span className="ms-fraction-row">
        <input
          type="number"
          min="0"
          step="1"
          value={whole}
          onChange={(event) => update(event.target.value, eighth)}
        />
        <select value={eighth} onChange={(event) => update(whole, event.target.value)}>
          {EIGHTH_LABELS.map((fractionLabel, index) => (
            <option key={fractionLabel} value={index}>
              {fractionLabel}
            </option>
          ))}
        </select>
        <span className="ms-unit">in</span>
      </span>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function DecimalInput({ label, value, onChange, min = 0, max = 999, unit = "in", step = 0.01, help }) {
  return (
    <label className="ms-field">
      <span className="ms-label">{label}</span>
      <span className="ms-decimal-row">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? trimNumber(value, unit === "cm" ? 1 : 3) : ""}
          onChange={(event) => {
            const raw = Number(event.target.value);
            if (Number.isFinite(raw)) onChange(clamp(raw, min, max));
          }}
        />
        <span className="ms-unit">{unit}</span>
      </span>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function MeasurementInput({
  label,
  valueInches,
  onChangeInches,
  unitSystem,
  imperialMode,
  minInches = 0,
  maxInches = 999,
  help,
}) {
  if (unitSystem === "metric") {
    return (
      <DecimalInput
        label={label}
        value={toCm(valueInches)}
        min={toCm(minInches)}
        max={toCm(maxInches)}
        unit="cm"
        step={0.1}
        help={help}
        onChange={(cm) => onChangeInches(fromCm(cm))}
      />
    );
  }

  if (imperialMode === "decimals") {
    return (
      <DecimalInput
        label={label}
        value={valueInches}
        min={minInches}
        max={maxInches}
        unit="in"
        step={0.01}
        help={help}
        onChange={onChangeInches}
      />
    );
  }

  return (
    <FractionInput
      label={label}
      value={valueInches}
      min={minInches}
      max={maxInches}
      help={help}
      onChange={onChangeInches}
    />
  );
}

function ResultRow({ label, value, note }) {
  return (
    <div className="ms-result-row">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <em>{note}</em> : null}
    </div>
  );
}

function ShapeBadge({ status }) {
  return <span className={`ms-badge ms-badge-${status.key}`}>{status.label}</span>;
}

function FlatPatternSvg({ values, math, unitSystem, imperialMode }) {
  const {
    centerPanelWidth,
    insertVisualHeight,
    insertMaxWidth,
    flatEndLength,
    seamAllowance,
    openTopFinishAllowance,
  } = values;

  const topAllowance = math.isOpenTop ? openTopFinishAllowance : seamAllowance;
  const bottomAllowance = seamAllowance;

  const insertCut = insertShapePoints({
    visualHeight: insertVisualHeight + topAllowance + bottomAllowance,
    flatEndLength: flatEndLength + 2 * seamAllowance,
    insertMaxWidth: insertMaxWidth + 2 * seamAllowance,
    curveStyle: values.curveStyle,
  });
  const insertSeam = addTransform(
    insertShapePoints({
      visualHeight: insertVisualHeight,
      flatEndLength,
      insertMaxWidth,
      curveStyle: values.curveStyle,
    }),
    0,
    topAllowance,
  );

  const scale = Math.min(
    34,
    460 / Math.max(1, centerPanelWidth + 2 * seamAllowance),
    260 / Math.max(1, math.centerRectangleSeamHeight + topAllowance + bottomAllowance),
  );

  const insertScale = Math.min(
    38,
    145 / Math.max(1, insertMaxWidth + 2 * seamAllowance),
    260 / Math.max(1, insertVisualHeight + topAllowance + bottomAllowance),
  );

  const leftX = 105;
  const centerX = 295;
  const rightX = 675;
  const baseY = 62;
  const centerCutW = (centerPanelWidth + 2 * seamAllowance) * scale;
  const centerCutH = (math.centerRectangleSeamHeight + topAllowance + bottomAllowance) * scale;
  const centerSeamW = centerPanelWidth * scale;
  const centerSeamH = math.centerRectangleSeamHeight * scale;

  function pathForInsert(points, x, y, localScale) {
    return pointsToPath(points.map((p) => ({ x: x + p.x * localScale, y: y + p.y * localScale })), true);
  }

  const leftCutPath = pathForInsert(insertCut, leftX, baseY, insertScale);
  const leftSeamPath = pathForInsert(insertSeam, leftX, baseY, insertScale);
  const rightCutPath = pathForInsert(insertCut, rightX, baseY, insertScale);
  const rightSeamPath = pathForInsert(insertSeam, rightX, baseY, insertScale);

  const centerCutX = centerX;
  const centerCutY = baseY;
  const centerSeamX = centerCutX + seamAllowance * scale;
  const centerSeamY = centerCutY + topAllowance * scale;

  return (
    <svg className="ms-svg" viewBox="0 0 820 390" role="img" aria-label="Flat pattern diagram">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 6 3 L 0 6 z" />
        </marker>
      </defs>

      <text className="ms-svg-title" x="20" y="28">Flat pattern preview</text>
      <text className="ms-svg-note" x="20" y="48">Solid = cut line. Dashed = finished seamline.</text>

      <g>
        <text className="ms-part-label" x={leftX} y="352" textAnchor="middle">Left insert</text>
        <path className="ms-cut" d={leftCutPath} />
        <path className="ms-seam" d={leftSeamPath} />
        <line className="ms-notch" x1={leftX - 10} y1={baseY + topAllowance * insertScale} x2={leftX + 10} y2={baseY + topAllowance * insertScale} />
        <line className="ms-notch" x1={leftX - 10} y1={baseY + (topAllowance + insertVisualHeight) * insertScale} x2={leftX + 10} y2={baseY + (topAllowance + insertVisualHeight) * insertScale} />
      </g>

      <g>
        <text className="ms-part-label" x={centerX + centerCutW / 2} y="352" textAnchor="middle">Center rectangle</text>
        <rect className="ms-cut" x={centerCutX} y={centerCutY} width={centerCutW} height={centerCutH} />
        <rect className="ms-seam" x={centerSeamX} y={centerSeamY} width={centerSeamW} height={centerSeamH} />
        <SvgDimensionLine
          x1={centerSeamX}
          y1={centerSeamY + centerSeamH}
          x2={centerSeamX + centerSeamW}
          y2={centerSeamY + centerSeamH}
          offset={28}
          label={formatMeasurement(centerPanelWidth, unitSystem, imperialMode)}
        />
        <SvgDimensionLine
          x1={centerSeamX + centerSeamW}
          y1={centerSeamY}
          x2={centerSeamX + centerSeamW}
          y2={centerSeamY + centerSeamH}
          offset={34}
          orientation="vertical"
          label={formatMeasurement(math.centerRectangleSeamHeight, unitSystem, imperialMode)}
        />
      </g>

      <g>
        <text className="ms-part-label" x={rightX} y="352" textAnchor="middle">Right insert</text>
        <path className="ms-cut" d={rightCutPath} />
        <path className="ms-seam" d={rightSeamPath} />
        <line className="ms-notch" x1={rightX - 10} y1={baseY + topAllowance * insertScale} x2={rightX + 10} y2={baseY + topAllowance * insertScale} />
        <line className="ms-notch" x1={rightX - 10} y1={baseY + (topAllowance + insertVisualHeight) * insertScale} x2={rightX + 10} y2={baseY + (topAllowance + insertVisualHeight) * insertScale} />
      </g>
    </svg>
  );
}

function AssembledPreviewSvg({ values, math, unitSystem, imperialMode }) {
  const { centerPanelWidth, insertVisualHeight, insertMaxWidth, flatEndLength, curveStyle } = values;
  const samples = 96;
  const leftOuter = [];
  const leftInner = [];
  const rightInner = [];
  const rightOuter = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const y = t * insertVisualHeight;
    const width = widthAtT(flatEndLength, insertMaxWidth, t, curveStyle);
    const bow = (width - flatEndLength) / 2;

    leftOuter.push({ x: -bow, y });
    leftInner.push({ x: flatEndLength + bow, y });
    rightInner.push({ x: flatEndLength + centerPanelWidth - bow, y });
    rightOuter.push({ x: flatEndLength + centerPanelWidth + flatEndLength + bow, y });
  }

  const totalMidWidth = centerPanelWidth + 2 * insertMaxWidth;
  const totalTopWidth = centerPanelWidth + 2 * flatEndLength;
  const scale = Math.min(48, 610 / Math.max(1, totalMidWidth), 260 / Math.max(1, insertVisualHeight));
  const minX = -(insertMaxWidth - flatEndLength) / 2;
  const originX = 105 - minX * scale;
  const originY = 64;

  const outline = [
    ...leftOuter,
    ...rightOuter.slice().reverse(),
  ];

  function mapPoint(p) {
    return { x: originX + p.x * scale, y: originY + p.y * scale };
  }

  const outlinePath = pointsToPath(outline.map(mapPoint), true);
  const leftSeamPath = pointsToPath(leftInner.map(mapPoint), false);
  const rightSeamPath = pointsToPath(rightInner.map(mapPoint), false);

  const topY = originY;
  const bottomY = originY + insertVisualHeight * scale;
  const topLeftX = originX;
  const topRightX = originX + totalTopWidth * scale;
  const midLeftX = originX + minX * scale;
  const midRightX = originX + (centerPanelWidth + 2 * flatEndLength - minX) * scale;

  return (
    <svg className="ms-svg" viewBox="0 0 820 390" role="img" aria-label="Assembled panel preview">
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 6 3 L 0 6 z" />
        </marker>
      </defs>
      <text className="ms-svg-title" x="20" y="28">Assembled front/back preview</text>
      <text className="ms-svg-note" x="20" y="48">Estimated finished shape from seamline geometry; interior lines show insert-to-rectangle seams.</text>

      <path className="ms-preview-fill" d={outlinePath} />
      <path className="ms-preview-outline" d={outlinePath} />
      <path className="ms-preview-seam" d={leftSeamPath} />
      <path className="ms-preview-seam" d={rightSeamPath} />

      <text className="ms-part-label" x={(topLeftX + topRightX) / 2} y={topY - 12} textAnchor="middle">top opening / top gusset edge</text>
      <text className="ms-part-label" x={(topLeftX + topRightX) / 2} y={bottomY + 28} textAnchor="middle">bottom gusset edge</text>

      <SvgDimensionLine
        x1={topLeftX}
        y1={bottomY}
        x2={topRightX}
        y2={bottomY}
        offset={48}
        label={`top/bottom edge ${formatMeasurement(math.topEdgeSeamLength, unitSystem, imperialMode)}`}
      />
      <SvgDimensionLine
        x1={midRightX}
        y1={topY}
        x2={midRightX}
        y2={bottomY}
        offset={50}
        orientation="vertical"
        label={`visual height ${formatMeasurement(insertVisualHeight, unitSystem, imperialMode)}`}
      />
      <SvgDimensionLine
        x1={midLeftX}
        y1={originY + insertVisualHeight * scale / 2}
        x2={midRightX}
        y2={originY + insertVisualHeight * scale / 2}
        offset={-26}
        label={`max preview width ${formatMeasurement(centerPanelWidth + 2 * insertMaxWidth, unitSystem, imperialMode)}`}
      />
    </svg>
  );
}

export default function CurvedExpansionBagCalculator() {
  const [unitSystem, setUnitSystem] = useState("imperial");
  const [imperialMode, setImperialMode] = useState("fractions");
  const [bagStyle, setBagStyle] = useState("zipperedTop");
  const [values, setValues] = useState({ ...initialValues, curveStyle: "standard" });

  function updateValue(key, nextValue, min = 0, max = 999) {
    setValues((current) => ({ ...current, [key]: clamp(nextValue, min, max) }));
  }

  const math = useMemo(() => {
    const leftCurve = sideCurvePoints({
      side: "left",
      visualHeight: values.insertVisualHeight,
      flatEndLength: values.flatEndLength,
      insertMaxWidth: values.insertMaxWidth,
      curveStyle: values.curveStyle,
      samples: 256,
    });

    const sideCurveLength = curveLength(leftCurve);
    const centerRectangleSeamHeight = sideCurveLength;
    const topEdgeSeamLength = values.centerPanelWidth + 2 * values.flatEndLength;
    const bottomEdgeSeamLength = topEdgeSeamLength;
    const fullPanelSewlinePerimeter = 2 * topEdgeSeamLength + 2 * sideCurveLength;
    const openTopThreeSidePerimeter = bottomEdgeSeamLength + 2 * sideCurveLength;
    const curveInflation = sideCurveLength / Math.max(0.001, values.insertVisualHeight);
    const widthHeightRatio = values.insertMaxWidth / Math.max(0.001, values.insertVisualHeight);
    const sideToCenterRatio = values.insertMaxWidth / Math.max(0.001, values.centerPanelWidth);
    const centerMidWidth = values.centerPanelWidth - (values.insertMaxWidth - values.flatEndLength);
    const flatEndMinimum = Math.max(0.5, values.seamAllowance);
    const maxSideWidth = Math.min(values.insertVisualHeight * 0.6, values.centerPanelWidth * 0.65);
    const zipperStripFinishedWidth = (values.gussetDepth - values.visibleZipperWidth) / 2;
    const zipperStripCutWidth = zipperStripFinishedWidth + values.seamAllowance + values.zipperSeamAllowance;
    const zipperTapeUnderStripEachSide = Math.max(0, (values.zipperTapeWidth - values.visibleZipperWidth) / 2);
    const isOpenTop = bagStyle === "openTop";
    const topAllowance = isOpenTop ? values.openTopFinishAllowance : values.seamAllowance;
    const centerCutWidth = values.centerPanelWidth + 2 * values.seamAllowance;
    const centerCutHeight = centerRectangleSeamHeight + values.seamAllowance + topAllowance;

    const issues = [];
    const cautions = [];

    if (values.insertMaxWidth <= values.flatEndLength) {
      issues.push("Side insert max width must be larger than the flat end length.");
    }
    if (values.flatEndLength < flatEndMinimum) {
      issues.push("Flat end length is below the recommended minimum.");
    }
    if (widthHeightRatio > 0.6) {
      issues.push("Side insert width is too large for the visual height.");
    }
    if (sideToCenterRatio > 0.65) {
      issues.push("Side insert width is too large compared with the center rectangle.");
    }
    if (curveInflation > 1.35) {
      issues.push("Curve inflation is over the recommended hard limit.");
    }
    if (centerMidWidth <= values.centerPanelWidth * 0.25) {
      issues.push("The assembled preview pinches the center panel too severely at mid-height.");
    } else if (centerMidWidth <= values.centerPanelWidth * 0.45) {
      cautions.push("The center panel gets fairly narrow at mid-height in the preview.");
    }
    if (values.visibleZipperWidth >= values.gussetDepth) {
      issues.push("Visible zipper width must be smaller than finished gusset depth.");
    }
    if (values.visibleZipperWidth > values.zipperTapeWidth) {
      cautions.push("Visible zipper width is larger than the zipper tape width input.");
    }

    let status = { key: "subtle", label: "Subtle" };
    if (issues.length) status = { key: "out", label: "Out of range" };
    else if (curveInflation > 1.3) status = { key: "extreme", label: "Extreme" };
    else if (curveInflation > 1.18) status = { key: "dramatic", label: "Dramatic" };
    else if (curveInflation > 1.08) status = { key: "standard", label: "Standard" };

    return {
      sideCurveLength,
      centerRectangleSeamHeight,
      topEdgeSeamLength,
      bottomEdgeSeamLength,
      fullPanelSewlinePerimeter,
      closedTopSewlinePerimeter: fullPanelSewlinePerimeter,
      openTopThreeSidePerimeter,
      curveInflation,
      widthHeightRatio,
      sideToCenterRatio,
      centerMidWidth,
      flatEndMinimum,
      maxSideWidth,
      zipperStripFinishedWidth,
      zipperStripCutWidth,
      zipperTapeUnderStripEachSide,
      centerCutWidth,
      centerCutHeight,
      isOpenTop,
      status,
      issues,
      cautions,
    };
  }, [values, bagStyle]);

  const commonInputProps = { unitSystem, imperialMode };
  const sideWidthMin = values.flatEndLength + 0.125;
  const sideWidthRecommendedMax = Math.max(0.125, math.maxSideWidth);
  const sideWidthInputMax = Math.max(sideWidthMin, sideWidthRecommendedMax);
  const flatEndMax = Math.max(math.flatEndMinimum, values.insertMaxWidth - 0.125);

  return (
    <div className="moonshot-curved-calc">
      <style>{componentStyles}</style>

      <header className="ms-hero">
        <div>
          <p className="ms-kicker">MoonShot Craft prototype</p>
          <h1>Curved Side Expansion Bag Calculator</h1>
          <p>
            Draft a three-piece front/back panel using a center rectangle plus two symmetrical flat-ended curved side inserts.
          </p>
        </div>
        <ShapeBadge status={math.status} />
      </header>

      <section className="ms-card ms-control-card">
        <div className="ms-toggle-grid">
          <fieldset>
            <legend>Units</legend>
            <label>
              <input type="radio" checked={unitSystem === "imperial"} onChange={() => setUnitSystem("imperial")} /> Imperial
            </label>
            <label>
              <input type="radio" checked={unitSystem === "metric"} onChange={() => setUnitSystem("metric")} /> Metric / cm
            </label>
          </fieldset>

          {unitSystem === "imperial" ? (
            <fieldset>
              <legend>Imperial input/display</legend>
              <label>
                <input type="radio" checked={imperialMode === "fractions"} onChange={() => setImperialMode("fractions")} /> Fractions to 1/8″
              </label>
              <label>
                <input type="radio" checked={imperialMode === "decimals"} onChange={() => setImperialMode("decimals")} /> Decimals
              </label>
            </fieldset>
          ) : null}

          <fieldset>
            <legend>Bag style</legend>
            <label>
              <input type="radio" checked={bagStyle === "zipperedTop"} onChange={() => setBagStyle("zipperedTop")} /> Zippered / closed top
            </label>
            <label>
              <input type="radio" checked={bagStyle === "openTop"} onChange={() => setBagStyle("openTop")} /> Open top
            </label>
          </fieldset>
        </div>
      </section>

      <main className="ms-layout">
        <section className="ms-card">
          <h2>Panel inputs</h2>
          <div className="ms-input-grid">
            <MeasurementInput
              label="Center panel finished width"
              valueInches={values.centerPanelWidth}
              minInches={1}
              maxInches={80}
              help="Straight finished width of the center rectangle seamline."
              onChangeInches={(next) => updateValue("centerPanelWidth", next, 1, 80)}
              {...commonInputProps}
            />
            <MeasurementInput
              label="Side insert visual height"
              valueInches={values.insertVisualHeight}
              minInches={2}
              maxInches={80}
              help="Finished top-to-bottom visual height of the curved insert."
              onChangeInches={(next) => updateValue("insertVisualHeight", next, 2, 80)}
              {...commonInputProps}
            />
            <MeasurementInput
              label="Side insert max width"
              valueInches={values.insertMaxWidth}
              minInches={sideWidthMin}
              maxInches={sideWidthInputMax}
              help={`Recommended max: ${formatMeasurement(sideWidthRecommendedMax, unitSystem, imperialMode)}.`}
              onChangeInches={(next) => updateValue("insertMaxWidth", next, sideWidthMin, sideWidthInputMax)}
              {...commonInputProps}
            />
            <MeasurementInput
              label="Finished flat end length"
              valueInches={values.flatEndLength}
              minInches={math.flatEndMinimum}
              maxInches={flatEndMax}
              help={`Minimum: ${formatMeasurement(math.flatEndMinimum, unitSystem, imperialMode)}.`}
              onChangeInches={(next) => updateValue("flatEndLength", next, math.flatEndMinimum, flatEndMax)}
              {...commonInputProps}
            />
            <MeasurementInput
              label="Seam allowance"
              valueInches={values.seamAllowance}
              minInches={0.125}
              maxInches={1.5}
              onChangeInches={(next) => updateValue("seamAllowance", next, 0.125, 1.5)}
              {...commonInputProps}
            />
            {bagStyle === "openTop" ? (
              <MeasurementInput
                label="Open-top finish allowance"
                valueInches={values.openTopFinishAllowance}
                minInches={0}
                maxInches={3}
                help="Optional top-edge allowance when no top gusset is sewn."
                onChangeInches={(next) => updateValue("openTopFinishAllowance", next, 0, 3)}
                {...commonInputProps}
              />
            ) : null}
          </div>

          <label className="ms-field ms-select-field">
            <span className="ms-label">Curve style</span>
            <select value={values.curveStyle} onChange={(event) => setValues((current) => ({ ...current, curveStyle: event.target.value }))}>
              {Object.entries(CURVE_STYLES).map(([key, style]) => (
                <option key={key} value={key}>{style.label}</option>
              ))}
            </select>
            <small>Changes how quickly the insert reaches its widest point.</small>
          </label>
        </section>

        <section className="ms-card">
          <h2>Gusset & zipper inputs</h2>
          <div className="ms-input-grid">
            <MeasurementInput
              label="Finished gusset depth"
              valueInches={values.gussetDepth}
              minInches={0.75}
              maxInches={30}
              onChangeInches={(next) => updateValue("gussetDepth", next, 0.75, 30)}
              {...commonInputProps}
            />
            {bagStyle === "zipperedTop" ? (
              <>
                <MeasurementInput
                  label="Zipper tape total width"
                  valueInches={values.zipperTapeWidth}
                  minInches={0.25}
                  maxInches={4}
                  onChangeInches={(next) => updateValue("zipperTapeWidth", next, 0.25, 4)}
                  {...commonInputProps}
                />
                <MeasurementInput
                  label="Visible zipper zone"
                  valueInches={values.visibleZipperWidth}
                  minInches={0.125}
                  maxInches={Math.max(0.125, values.gussetDepth - 0.125)}
                  help="Finished width reserved between the two top strips."
                  onChangeInches={(next) => updateValue("visibleZipperWidth", next, 0.125, Math.max(0.125, values.gussetDepth - 0.125))}
                  {...commonInputProps}
                />
                <MeasurementInput
                  label="Zipper seam allowance"
                  valueInches={values.zipperSeamAllowance}
                  minInches={0.125}
                  maxInches={1}
                  onChangeInches={(next) => updateValue("zipperSeamAllowance", next, 0.125, 1)}
                  {...commonInputProps}
                />
              </>
            ) : null}
          </div>
        </section>
      </main>

      <section className="ms-card ms-status-card">
        <div>
          <h2>Shape constraints</h2>
          <p>
            Curve inflation is the main sanity check: curved seam length divided by visual insert height.
          </p>
        </div>
        <div className="ms-mini-results">
          <ResultRow label="Curve inflation" value={`${trimNumber(math.curveInflation, 3)}×`} />
          <ResultRow label="Width / height" value={`${trimNumber(math.widthHeightRatio * 100, 1)}%`} />
          <ResultRow label="Side / center" value={`${trimNumber(math.sideToCenterRatio * 100, 1)}%`} />
          <ResultRow label="Center mid-width preview" value={formatMeasurement(math.centerMidWidth, unitSystem, imperialMode)} />
        </div>
        {math.issues.length ? (
          <div className="ms-message ms-error">
            <strong>Out of range:</strong>
            <ul>{math.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}
        {math.cautions.length ? (
          <div className="ms-message ms-caution">
            <strong>Design note:</strong>
            <ul>{math.cautions.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}
      </section>

      <section className="ms-diagram-grid">
        <div className="ms-card ms-diagram-card">
          <FlatPatternSvg values={values} math={math} unitSystem={unitSystem} imperialMode={imperialMode} />
        </div>
        <div className="ms-card ms-diagram-card">
          <AssembledPreviewSvg values={values} math={math} unitSystem={unitSystem} imperialMode={imperialMode} />
        </div>
      </section>

      <section className="ms-results-grid">
        <div className="ms-card">
          <h2>Panel measurements</h2>
          <ResultRow label="Side insert visual height" value={formatMeasurement(values.insertVisualHeight, unitSystem, imperialMode)} />
          <ResultRow label="Curved seam length" value={formatMeasurement(math.sideCurveLength, unitSystem, imperialMode)} />
          <ResultRow label="Center rectangle seam height" value={formatMeasurement(math.centerRectangleSeamHeight, unitSystem, imperialMode)} />
          <ResultRow label="Center rectangle cut width" value={formatMeasurement(math.centerCutWidth, unitSystem, imperialMode)} />
          <ResultRow label="Center rectangle cut height" value={formatMeasurement(math.centerCutHeight, unitSystem, imperialMode)} />
        </div>

        <div className="ms-card">
          <h2>Perimeters</h2>
          <ResultRow label="Top edge seamline" value={formatMeasurement(math.topEdgeSeamLength, unitSystem, imperialMode)} />
          <ResultRow label="Bottom edge seamline" value={formatMeasurement(math.bottomEdgeSeamLength, unitSystem, imperialMode)} />
          <ResultRow label="Completed 3-piece panel perimeter" value={formatMeasurement(math.fullPanelSewlinePerimeter, unitSystem, imperialMode)} />
          <ResultRow label="Closed-top full sewline perimeter" value={formatMeasurement(math.closedTopSewlinePerimeter, unitSystem, imperialMode)} />
          <ResultRow label="Open-top 3-side sewline perimeter" value={formatMeasurement(math.openTopThreeSidePerimeter, unitSystem, imperialMode)} />
          <ResultRow label="Top opening edge" value={formatMeasurement(math.topEdgeSeamLength, unitSystem, imperialMode)} />
        </div>

        <div className="ms-card">
          <h2>Gusset / zipper notes</h2>
          <ResultRow label="Finished side/bottom gusset width" value={formatMeasurement(values.gussetDepth, unitSystem, imperialMode)} />
          {bagStyle === "zipperedTop" ? (
            <>
              <ResultRow label="Each top strip finished width" value={formatMeasurement(math.zipperStripFinishedWidth, unitSystem, imperialMode)} />
              <ResultRow label="Each top strip cut width" value={formatMeasurement(math.zipperStripCutWidth, unitSystem, imperialMode)} />
              <ResultRow label="Zipper tape under strip, each side" value={formatMeasurement(math.zipperTapeUnderStripEachSide, unitSystem, imperialMode)} />
              <ResultRow label="Top assembly finished width check" value={formatMeasurement(values.visibleZipperWidth + 2 * math.zipperStripFinishedWidth, unitSystem, imperialMode)} note="matches gusset depth" />
            </>
          ) : (
            <ResultRow label="Open-top gusset attachment" value={formatMeasurement(math.openTopThreeSidePerimeter, unitSystem, imperialMode)} note="left + bottom + right" />
          )}
        </div>
      </section>
    </div>
  );
}

const componentStyles = `
  .moonshot-curved-calc {
    --ms-ink: #2f2933;
    --ms-muted: #746b78;
    --ms-paper: #fffaf4;
    --ms-card: #ffffff;
    --ms-line: #d9cabe;
    --ms-accent: #6d4a7f;
    --ms-accent-soft: #f0e7f4;
    --ms-gold: #c88a2a;
    --ms-error: #9b2f2f;
    --ms-caution: #8a641d;
    min-height: 100vh;
    padding: 24px;
    background: linear-gradient(180deg, #fff8ef 0%, #f5eee8 100%);
    color: var(--ms-ink);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .moonshot-curved-calc * { box-sizing: border-box; }

  .ms-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    max-width: 1280px;
    margin: 0 auto 18px;
    padding: 24px;
    border-radius: 28px;
    background: #392543;
    color: #fffaf4;
    box-shadow: 0 16px 48px rgba(38, 24, 45, 0.18);
  }

  .ms-hero h1 { margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3.25rem); line-height: 1; }
  .ms-hero p { margin: 0; max-width: 780px; color: rgba(255,250,244,0.82); }
  .ms-kicker { text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.78rem; font-weight: 800; color: #e2b765 !important; margin-bottom: 10px !important; }

  .ms-card {
    background: var(--ms-card);
    border: 1px solid var(--ms-line);
    border-radius: 22px;
    padding: 20px;
    box-shadow: 0 10px 30px rgba(64, 47, 35, 0.08);
  }

  .ms-card h2 { margin: 0 0 14px; font-size: 1.1rem; }
  .ms-card p { color: var(--ms-muted); margin: 0; }

  .ms-control-card, .ms-status-card, .ms-diagram-grid, .ms-results-grid, .ms-layout {
    max-width: 1280px;
    margin-left: auto;
    margin-right: auto;
  }

  .ms-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18px;
    margin-top: 18px;
  }

  .ms-input-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .ms-field { display: grid; gap: 6px; }
  .ms-label { font-size: 0.86rem; font-weight: 800; color: var(--ms-ink); }
  .ms-field small { color: var(--ms-muted); line-height: 1.25; }

  .ms-fraction-row, .ms-decimal-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    align-items: center;
  }

  .ms-field input[type="number"], .ms-field select {
    width: 100%;
    min-height: 42px;
    border: 1px solid #cdbcae;
    border-radius: 12px;
    padding: 8px 10px;
    background: #fffdfa;
    color: var(--ms-ink);
    font: inherit;
  }

  .ms-select-field { margin-top: 16px; max-width: 340px; }
  .ms-unit { font-weight: 800; color: var(--ms-muted); }

  .ms-toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0;
    padding: 14px;
    border: 1px solid var(--ms-line);
    border-radius: 16px;
  }

  legend { padding: 0 6px; font-weight: 900; color: var(--ms-accent); }
  fieldset label { display: inline-flex; align-items: center; gap: 6px; color: var(--ms-ink); }

  .ms-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 132px;
    padding: 12px 18px;
    border-radius: 999px;
    font-weight: 950;
    letter-spacing: 0.02em;
    background: #fff;
    color: #392543;
  }

  .ms-badge-subtle { background: #e9f4ea; color: #27602f; }
  .ms-badge-standard { background: #e8eef8; color: #294d8f; }
  .ms-badge-dramatic { background: #fff1d2; color: #8a5b12; }
  .ms-badge-extreme { background: #ffe3d6; color: #944316; }
  .ms-badge-out { background: #ffe1e1; color: #932828; }

  .ms-status-card {
    display: grid;
    grid-template-columns: 1.1fr 1.4fr;
    gap: 18px;
    align-items: start;
    margin-top: 18px;
  }

  .ms-mini-results {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .ms-message {
    grid-column: 1 / -1;
    border-radius: 16px;
    padding: 14px 16px;
  }

  .ms-message ul { margin: 8px 0 0; padding-left: 20px; }
  .ms-error { border: 1px solid #efb8b8; background: #fff2f2; color: var(--ms-error); }
  .ms-caution { border: 1px solid #e9c97d; background: #fff8e8; color: var(--ms-caution); }

  .ms-diagram-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 18px;
  }

  .ms-diagram-card { overflow: auto; padding: 12px; }
  .ms-svg { display: block; min-width: 820px; width: 100%; height: auto; }
  .ms-svg-title { font-weight: 950; font-size: 18px; fill: var(--ms-ink); }
  .ms-svg-note { font-size: 12px; fill: var(--ms-muted); }
  .ms-part-label { font-size: 12px; font-weight: 850; fill: var(--ms-muted); }

  .ms-cut {
    fill: rgba(240, 231, 244, 0.55);
    stroke: var(--ms-accent);
    stroke-width: 2.5;
  }

  .ms-seam {
    fill: none;
    stroke: var(--ms-gold);
    stroke-width: 2;
    stroke-dasharray: 7 6;
  }

  .ms-notch {
    stroke: #d14f3f;
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .ms-dim line {
    stroke: #887f8a;
    stroke-width: 1.25;
    marker-start: url(#arrow);
    marker-end: url(#arrow);
  }

  .ms-dim text {
    font-size: 11px;
    font-weight: 850;
    fill: #5c5360;
    paint-order: stroke;
    stroke: #fffaf4;
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .ms-preview-fill { fill: rgba(240, 231, 244, 0.75); }
  .ms-preview-outline { fill: none; stroke: var(--ms-accent); stroke-width: 3; }
  .ms-preview-seam { fill: none; stroke: var(--ms-gold); stroke-width: 2.5; stroke-dasharray: 8 6; }

  .ms-results-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }

  .ms-result-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: baseline;
    padding: 10px 0;
    border-bottom: 1px solid #eee2d8;
  }

  .ms-result-row:last-child { border-bottom: 0; }
  .ms-result-row span { color: var(--ms-muted); }
  .ms-result-row strong { font-size: 1.02rem; color: var(--ms-ink); text-align: right; }
  .ms-result-row em { grid-column: 1 / -1; color: var(--ms-muted); font-size: 0.82rem; font-style: normal; text-align: right; }

  @media (max-width: 920px) {
    .moonshot-curved-calc { padding: 14px; }
    .ms-hero, .ms-layout, .ms-toggle-grid, .ms-status-card, .ms-results-grid { grid-template-columns: 1fr; }
    .ms-hero { align-items: flex-start; }
    .ms-input-grid { grid-template-columns: 1fr; }
  }
`;

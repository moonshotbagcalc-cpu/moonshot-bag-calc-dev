import { useState } from "react";
import { T } from "../utils/theme.js";
import { Card, CardTitle, RRow, InfoBox, NoteBox, SubTabs, Divider, SABar } from "../components/SharedUI.jsx";
import FracInput from "../components/FracInput.jsx";
import { roundRectPerim, ellipsePerim } from "../utils/geometry.js";
import { PI, DEFAULT_SA } from "../utils/constants.js";
import { fmtInch } from "../utils/formatting.js";

// ── Gusset SVG Diagram ────────────────────────────────────────────────────────
function GussetDiagram({ mode, panelW, panelH, cornerR, gussetCutW, gussetLen, sa }) {
  const th = T.green;
  if (!panelW || !panelH) return null;

  const SVG_W = 640;
  const PANEL_MAX_W = 300;
  const PANEL_MAX_H = 220;
  const PANEL_TOP = 64;
  const STRIP_GAP = 78;
  const STRIP_MIN_H = 14;
  const STRIP_MAX_H = 64;

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const isThreeSided = mode === "three";

  const S = Math.min(PANEL_MAX_W / panelW, PANEL_MAX_H / panelH, 16);
  const pW = panelW * S;
  const pH = panelH * S;
  const pR = clamp(cornerR * S, 0, Math.min(pW / 2, pH / 2));
  const saP = clamp(sa * S, 0, Math.max(0, Math.min(pW / 2 - 1, pH / 2 - 1)));
  const gW = gussetCutW > 0
    ? clamp(gussetCutW * S, STRIP_MIN_H, STRIP_MAX_H)
    : STRIP_MIN_H;

  const panelX = (SVG_W - pW) / 2;
  const panelY = PANEL_TOP;
  const panelBottom = panelY + pH;

  const stripY = panelBottom + STRIP_GAP;
  const stripLabelY = stripY + gW + 36;
  const SVG_H = stripLabelY + 24;

  const C = {
    fill: "#c8e8d4",
    gussetFill: "#a9dbbb",
    line: th.accent || "#1a6e3a",
    dark: "#165c30",
    text: th.label || "#165c30",
    softText: th.sub || "#3a9e60",
    callout: "#3cab64",
    bg: "#ffffff",
    fade: "#e7f6ed",
  };

  const arrowId = `gDiagramArrow-${mode}-${Math.round(panelW * 64)}-${Math.round(panelH * 64)}-${Math.round(cornerR * 64)}`;
  const fadeLeftId = `gFadeLeft-${mode}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;
  const fadeRightId = `gFadeRight-${mode}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;

  function bottomRoundedPanelPath(x, y, w, h, r) {
    if (r <= 0.01) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `
      M ${x} ${y}
      H ${x + w}
      V ${y + h - r}
      A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
      H ${x + r}
      A ${r} ${r} 0 0 1 ${x} ${y + h - r}
      V ${y}
      Z
    `;
  }

  function roundedPanelPath(x, y, w, h, r) {
    if (r <= 0.01) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `
      M ${x + r} ${y}
      H ${x + w - r}
      A ${r} ${r} 0 0 1 ${x + w} ${y + r}
      V ${y + h - r}
      A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}
      H ${x + r}
      A ${r} ${r} 0 0 1 ${x} ${y + h - r}
      V ${y + r}
      A ${r} ${r} 0 0 1 ${x + r} ${y}
      Z
    `;
  }

  function threeSideSewPath(x, y, w, h, r, inset) {
    const left = x + inset;
    const right = x + w - inset;
    const bottom = y + h - inset;

    if (r <= inset + 0.01) {
      return `
        M ${left} ${y}
        V ${bottom}
        H ${right}
        V ${y}
      `;
    }

    const rr = r - inset;
    const cornerCenterY = y + h - r;

    return `
      M ${left} ${y}
      V ${cornerCenterY}
      A ${rr} ${rr} 0 0 0 ${x + r} ${bottom}
      H ${x + w - r}
      A ${rr} ${rr} 0 0 0 ${right} ${cornerCenterY}
      V ${y}
    `;
  }

  function fourSideSewPath(x, y, w, h, r, inset) {
    const left = x + inset;
    const right = x + w - inset;
    const top = y + inset;
    const bottom = y + h - inset;

    if (r <= inset + 0.01) {
      return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
    }

    const rr = r - inset;

    return `
      M ${x + r} ${top}
      H ${x + w - r}
      A ${rr} ${rr} 0 0 1 ${right} ${y + r}
      V ${y + h - r}
      A ${rr} ${rr} 0 0 1 ${x + w - r} ${bottom}
      H ${x + r}
      A ${rr} ${rr} 0 0 1 ${left} ${y + h - r}
      V ${y + r}
      A ${rr} ${rr} 0 0 1 ${x + r} ${top}
      Z
    `;
  }

  const panelPath = isThreeSided
    ? bottomRoundedPanelPath(panelX, panelY, pW, pH, pR)
    : roundedPanelPath(panelX, panelY, pW, pH, pR);

  const sewPath = isThreeSided
    ? threeSideSewPath(panelX, panelY, pW, pH, pR, saP)
    : fourSideSewPath(panelX, panelY, pW, pH, pR, saP);

  const widthY = panelY - 34;
  const heightX = panelX + pW + 46;

  const calloutTextX = Math.max(22, panelX - 150);
  const calloutTextY = panelY + pH * 0.33;
  const calloutTargetX = panelX + saP;
  const calloutTargetY = panelY + (isThreeSided ? pH * 0.52 : pH * 0.35);
  const calloutElbowX = panelX - 24;
  const calloutElbowY = calloutTargetY;
  const calloutLabel = isThreeSided ? "(3 Sides)" : "(4 Sides)";
  const notchLabelY = panelBottom + 31;

  const notchTicks = (() => {
    if (pR <= 8) return [];
    const notchCount = cornerR <= 1 ? 3 : 5;
    const insideInset = Math.min(Math.max(1.2, pR * 0.12), Math.max(1.2, saP - 2));
    const outsideExt = Math.max(7, Math.min(10, pR * 0.26));
    const distribute = (startDeg, endDeg, count) => {
      if (count === 1) return [(startDeg + endDeg) / 2];
      const step = (endDeg - startDeg) / (count - 1);
      return Array.from({ length: count }, (_, i) => startDeg + step * i);
    };
    const makeCornerTicks = (cx, cy, startDeg, endDeg) => {
      const angles = distribute(startDeg, endDeg, notchCount).map((d) => d * PI / 180);
      return angles.map((theta) => ({
        x1: cx + Math.cos(theta) * (pR - insideInset),
        y1: cy + Math.sin(theta) * (pR - insideInset),
        x2: cx + Math.cos(theta) * (pR + outsideExt),
        y2: cy + Math.sin(theta) * (pR + outsideExt),
      }));
    };

    const ticks = [
      ...makeCornerTicks(panelX + pR, panelY + pH - pR, 180, 90),           // bottom-left
      ...makeCornerTicks(panelX + pW - pR, panelY + pH - pR, 90, 0),        // bottom-right
    ];

    if (!isThreeSided) {
      ticks.push(
        ...makeCornerTicks(panelX + pR, panelY + pR, 180, 270),             // top-left
        ...makeCornerTicks(panelX + pW - pR, panelY + pR, 270, 360),        // top-right
      );
    }

    return ticks;
  })();

  const stripPieceW = 132;
  const breakGap = 72;
  const stripTotalW = stripPieceW * 2 + breakGap;
  const stripX = (SVG_W - stripTotalW) / 2;
  const stripMidY = stripY + gW / 2;
  const leftStripX = stripX;
  const rightStripX = stripX + stripPieceW + breakGap;
  const breakLeftX = stripX + stripPieceW;
  const breakRightX = rightStripX;
  const breakOvershoot = 10;
  const breakTop = stripY - breakOvershoot;
  const breakBottom = stripY + gW + breakOvershoot;
  const breakMidY = (breakTop + breakBottom) / 2;
  const fadeW = 20;

  const breakLeftPath = `
    M ${breakLeftX + 2} ${breakTop}
    C ${breakLeftX + 12} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakLeftX + 22} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakLeftX + 30} ${breakMidY}
    C ${breakLeftX + 39} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakLeftX + 46} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakLeftX + 54} ${breakBottom}
  `;
  const breakRightPath = `
    M ${breakRightX - 54} ${breakTop}
    C ${breakRightX - 44} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakRightX - 34} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakRightX - 26} ${breakMidY}
    C ${breakRightX - 17} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakRightX - 10} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakRightX - 2} ${breakBottom}
  `;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width:"100%", height:"auto", display:"block" }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Panel and gusset diagram"
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="8"
          markerHeight="8"
          refX="4"
          refY="4"
          orient="auto-start-reverse"
        >
          <path
            d="M 1.25 1.25 L 6.75 4 L 1.25 6.75"
            fill="none"
            stroke={C.line}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <linearGradient id={fadeLeftId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor={C.fade} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={fadeRightId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.fade} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={SVG_W} height={SVG_H} fill={C.bg} />

      <path d={panelPath} fill={C.fill} stroke="none" />
      <path
        d={panelPath}
        fill="none"
        stroke={C.line}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />

      {saP > 2 && (
        <path
          d={sewPath}
          fill="none"
          stroke={C.dark}
          strokeWidth="1.45"
          strokeDasharray="6 5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.78"
        />
      )}

      {saP > 2 && (
        <>
          <path
            d={`M ${calloutTextX + 118} ${calloutTextY + 10} H ${calloutElbowX} L ${calloutTargetX} ${calloutTargetY}`}
            fill="none"
            stroke={C.callout}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={calloutTargetX} cy={calloutTargetY} r="2.8" fill={C.callout} />
          <text
            x={calloutTextX}
            y={calloutTextY}
            textAnchor="start"
            fontSize="13"
            fontWeight="800"
            fontFamily="Nunito,sans-serif"
            fill={C.callout}
          >
            <tspan x={calloutTextX} dy="0">Gusset Placement</tspan>
            <tspan x={calloutTextX} dy="15">{calloutLabel}</tspan>
          </text>
        </>
      )}

      {notchTicks.length > 0 && (
        <>
          {notchTicks.map((n, i) => (
            <g key={i}>
              <line
                x1={n.x1}
                y1={n.y1}
                x2={n.x2}
                y2={n.y2}
                stroke="#ffffff"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.96"
              />
              <line
                x1={n.x1}
                y1={n.y1}
                x2={n.x2}
                y2={n.y2}
                stroke={C.callout}
                strokeWidth="1.55"
                strokeLinecap="round"
                opacity="0.72"
              />
            </g>
          ))}
          <text
            x={SVG_W / 2}
            y={notchLabelY}
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            fontFamily="Nunito,sans-serif"
            fill={C.callout}
            opacity="0.78"
          >
            Clip/notch for easing in curves
          </text>
        </>
      )}

      <line
        x1={panelX}
        y1={widthY}
        x2={panelX + pW}
        y2={widthY}
        stroke={C.line}
        strokeWidth="1.35"
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={panelX + pW / 2}
        y={widthY - 11}
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fontFamily="DM Mono,monospace"
        fill={C.text}
      >
        {fmtInch(panelW)} W
      </text>

      {isThreeSided && (
        <text
          x={panelX + pW / 2}
          y={panelY - 12}
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fontFamily="Nunito,sans-serif"
          fill={C.softText}
          letterSpacing="0.12em"
        >
          open top
        </text>
      )}

      <line
        x1={heightX}
        y1={panelY}
        x2={heightX}
        y2={panelY + pH}
        stroke={C.line}
        strokeWidth="1.35"
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text
        x={heightX + 18}
        y={panelY + pH / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize="15"
        fontWeight="800"
        fontFamily="DM Mono,monospace"
        fill={C.text}
      >
        {fmtInch(panelH)} H
      </text>

      {/* Gusset strip with subtle continuation fade */}
      <rect x={leftStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={rightStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={leftStripX + stripPieceW - fadeW} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeLeftId})`} />
      <rect x={rightStripX} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeRightId})`} />

      {/* Outer strip outlines only — no dark interior end-caps */}
      <path d={`M ${leftStripX} ${stripY} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY + gW} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${rightStripX} ${stripY} H ${rightStripX + stripPieceW} M ${rightStripX} ${stripY + gW} H ${rightStripX + stripPieceW} M ${rightStripX + stripPieceW} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />

      <path d={breakLeftPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />
      <path d={breakRightPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />

      {gussetCutW > 0 && (
        <>
          <line
            x1={stripX - 30}
            y1={stripY}
            x2={stripX - 30}
            y2={stripY + gW}
            stroke={C.line}
            strokeWidth="1.35"
            markerStart={`url(#${arrowId})`}
            markerEnd={`url(#${arrowId})`}
          />
          <text
            x={stripX - 42}
            y={stripMidY}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="15"
            fontWeight="800"
            fontFamily="DM Mono,monospace"
            fill={C.text}
          >
            {fmtInch(gussetCutW)} W
          </text>
        </>
      )}

      <text
        x={SVG_W / 2}
        y={stripLabelY}
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fontFamily="Nunito,sans-serif"
        fill={C.softText}
      >
        {gussetLen > 0
          ? `Strip cut length: ${fmtInch(gussetLen)}`
          : "Enter gusset width to see strip dimensions"}
      </text>
    </svg>
  );
}

function RoundOvalGussetDiagram({ shape, panelW, panelH, gussetCutW, gussetLen, sa }) {
  const th = T.green;
  if (!panelW || !panelH) return null;

  const SVG_W = 640;
  const PANEL_MAX_W = 300;
  const PANEL_MAX_H = 220;
  const PANEL_TOP = 62;
  const STRIP_GAP = 78;
  const STRIP_MIN_H = 14;
  const STRIP_MAX_H = 64;

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const S = Math.min(PANEL_MAX_W / panelW, PANEL_MAX_H / panelH, 16);
  const pW = panelW * S;
  const pH = panelH * S;
  const saP = clamp(sa * S, 0, Math.max(0, Math.min(pW / 2 - 1, pH / 2 - 1)));
  const gW = gussetCutW > 0 ? clamp(gussetCutW * S, STRIP_MIN_H, STRIP_MAX_H) : STRIP_MIN_H;

  const cx = SVG_W / 2;
  const cy = PANEL_TOP + pH / 2;
  const rx = pW / 2;
  const ry = pH / 2;
  const sewRx = Math.max(0, rx - saP);
  const sewRy = Math.max(0, ry - saP);

  const stripY = PANEL_TOP + pH + STRIP_GAP;
  const stripLabelY = stripY + gW + 36;
  const SVG_H = stripLabelY + 24;

  const C = {
    fill: "#c8e8d4",
    gussetFill: "#a9dbbb",
    line: th.accent || "#1a6e3a",
    dark: "#165c30",
    text: th.label || "#165c30",
    softText: th.sub || "#3a9e60",
    callout: "#3cab64",
    bg: "#ffffff",
    fade: "#e7f6ed",
  };

  const arrowId = `roundGussetArrow-${shape}-${Math.round(panelW * 64)}-${Math.round(panelH * 64)}`;
  const fadeLeftId = `roundGussetFadeLeft-${shape}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;
  const fadeRightId = `roundGussetFadeRight-${shape}-${Math.round(panelW * 32)}-${Math.round(panelH * 32)}`;

  const widthY = PANEL_TOP - 34;
  const heightX = cx + rx + 46;

  const notchCount = Math.max(12, Math.min(20, Math.round(ellipsePerim(panelW, panelH) / 1.25)));
  const notchTicks = Array.from({ length: notchCount }, (_, i) => {
    const theta = (2 * PI * i) / notchCount;
    const x = cx + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    const nxRaw = Math.cos(theta) / Math.max(rx, 0.001);
    const nyRaw = Math.sin(theta) / Math.max(ry, 0.001);
    const nLen = Math.sqrt(nxRaw * nxRaw + nyRaw * nyRaw) || 1;
    const nx = nxRaw / nLen;
    const ny = nyRaw / nLen;
    const inner = Math.min(Math.max(1.2, Math.min(rx, ry) * 0.08), Math.max(1.2, saP - 2));
    const outer = 8;
    return {
      x1: x - nx * inner,
      y1: y - ny * inner,
      x2: x + nx * outer,
      y2: y + ny * outer,
    };
  });

  const stripPieceW = 132;
  const breakGap = 72;
  const stripTotalW = stripPieceW * 2 + breakGap;
  const stripX = (SVG_W - stripTotalW) / 2;
  const stripMidY = stripY + gW / 2;
  const leftStripX = stripX;
  const rightStripX = stripX + stripPieceW + breakGap;
  const breakLeftX = stripX + stripPieceW;
  const breakRightX = rightStripX;
  const breakOvershoot = 10;
  const breakTop = stripY - breakOvershoot;
  const breakBottom = stripY + gW + breakOvershoot;
  const breakMidY = (breakTop + breakBottom) / 2;
  const fadeW = 20;

  const breakLeftPath = `
    M ${breakLeftX + 2} ${breakTop}
    C ${breakLeftX + 12} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakLeftX + 22} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakLeftX + 30} ${breakMidY}
    C ${breakLeftX + 39} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakLeftX + 46} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakLeftX + 54} ${breakBottom}
  `;
  const breakRightPath = `
    M ${breakRightX - 54} ${breakTop}
    C ${breakRightX - 44} ${breakTop + (breakBottom - breakTop) * 0.20}, ${breakRightX - 34} ${breakTop + (breakBottom - breakTop) * 0.34}, ${breakRightX - 26} ${breakMidY}
    C ${breakRightX - 17} ${breakTop + (breakBottom - breakTop) * 0.68}, ${breakRightX - 10} ${breakTop + (breakBottom - breakTop) * 0.82}, ${breakRightX - 2} ${breakBottom}
  `;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width:"100%", height:"auto", display:"block" }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Round or oval gusset diagram"
    >
      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
          <path d="M 1.25 1.25 L 6.75 4 L 1.25 6.75" fill="none" stroke={C.line} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <linearGradient id={fadeLeftId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor={C.fade} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={fadeRightId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={C.fade} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={SVG_W} height={SVG_H} fill={C.bg} />

      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.fill} stroke={C.line} strokeWidth="2.2" />
      {sewRx > 2 && sewRy > 2 && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={sewRx}
          ry={sewRy}
          fill="none"
          stroke={C.dark}
          strokeWidth="1.45"
          strokeDasharray="6 5"
          opacity="0.78"
        />
      )}

      {notchTicks.map((n, i) => (
        <g key={i}>
          <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" opacity="0.96" />
          <line x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2} stroke={C.callout} strokeWidth="1.55" strokeLinecap="round" opacity="0.62" />
        </g>
      ))}

      <text
        x={SVG_W / 2}
        y={PANEL_TOP + pH + 31}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fontFamily="Nunito,sans-serif"
        fill={C.callout}
        opacity="0.78"
      >
        Clip/notch for easing around the full curve
      </text>

      <line x1={cx - rx} y1={widthY} x2={cx + rx} y2={widthY} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
      <text x={cx} y={widthY - 11} textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(panelW)} W</text>

      <line x1={heightX} y1={cy - ry} x2={heightX} y2={cy + ry} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
      <text x={heightX + 18} y={cy} textAnchor="start" dominantBaseline="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(panelH)} H</text>

      <rect x={leftStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={rightStripX} y={stripY} width={stripPieceW} height={gW} fill={C.gussetFill} stroke="none" />
      <rect x={leftStripX + stripPieceW - fadeW} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeLeftId})`} />
      <rect x={rightStripX} y={stripY} width={fadeW} height={gW} fill={`url(#${fadeRightId})`} />
      <path d={`M ${leftStripX} ${stripY} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY + gW} H ${leftStripX + stripPieceW} M ${leftStripX} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={`M ${rightStripX} ${stripY} H ${rightStripX + stripPieceW} M ${rightStripX} ${stripY + gW} H ${rightStripX + stripPieceW} M ${rightStripX + stripPieceW} ${stripY} V ${stripY + gW}`} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" />
      <path d={breakLeftPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />
      <path d={breakRightPath} fill="none" stroke={C.callout} strokeWidth="3.2" strokeLinecap="round" />

      {gussetCutW > 0 && (
        <>
          <line x1={stripX - 30} y1={stripY} x2={stripX - 30} y2={stripY + gW} stroke={C.line} strokeWidth="1.35" markerStart={`url(#${arrowId})`} markerEnd={`url(#${arrowId})`} />
          <text x={stripX - 42} y={stripMidY} textAnchor="end" dominantBaseline="middle" fontSize="15" fontWeight="800" fontFamily="DM Mono,monospace" fill={C.text}>{fmtInch(gussetCutW)} W</text>
        </>
      )}

      <text x={SVG_W / 2} y={stripLabelY} textAnchor="middle" fontSize="16" fontWeight="800" fontFamily="Nunito,sans-serif" fill={C.softText}>
        {gussetLen > 0 ? `Strip cut length: ${fmtInch(gussetLen)}` : "Enter gusset width to see strip dimensions"}
      </text>
    </svg>
  );
}

export default function GussetPage() {
  const th=T.green;
  const [sa,setSa]=useState(DEFAULT_SA); const [cSa,setCsa]=useState("");
  const [mode,setMode]=useState("three");
  const [roundShape,setRoundShape]=useState("circle");

  // rectangular panel inputs
  const [pLW,setPLW]=useState(0); const [pLF,setPLF]=useState(0);
  const [pHW,setPHW]=useState(0); const [pHF,setPHF]=useState(0);
  const [rW,setRW]=useState(0);   const [rF,setRF]=useState(0);

  // round / oval panel inputs
  const [dW,setDW]=useState(0);   const [dF,setDF]=useState(0);
  const [oWW,setOWW]=useState(0); const [oWF,setOWF]=useState(0);
  const [oHW,setOHW]=useState(0); const [oHF,setOHF]=useState(0);

  // shared gusset width input
  const [gWW,setGWW]=useState(0); const [gWF,setGWF]=useState(0);

  const pL=pLW+pLF, pH=pHW+pHF, rC=rW+rF;
  const Rs=Math.max(0,rC-sa);
  const gFin=gWW+gWF, gCut=gFin+2*sa;

  // Sewline dims — top edge NOT reduced by SA for 3-sided rectangular gussets.
  const Ls_open = Math.max(0, pL - 2*sa);
  const Hs_open = Math.max(0, pH - sa);
  const Ls_closed = Math.max(0, pL - 2*sa);
  const Hs_closed = Math.max(0, pH - 2*sa);

  // ── 3-sided rectangle: bottom + 2 sides, 2 corners ───────────────────────
  const bot3 = Math.max(0, Ls_open - 2*Rs);
  const side3 = Math.max(0, Hs_open - Rs);
  const arc3 = PI*Rs;
  const sewLen3 = bot3 + arc3 + 2*side3;

  // ── 4-sided rectangle: full perimeter ────────────────────────────────────
  const sewLen4 = roundRectPerim(Ls_closed, Hs_closed, Rs);
  const stripLen4 = sewLen4 + 2*sa;

  // ── Round / oval: closed-loop perimeter ──────────────────────────────────
  const circleD = dW + dF;
  const ovalW = oWW + oWF;
  const ovalH = oHW + oHF;
  const roundPanelW = roundShape === "circle" ? circleD : ovalW;
  const roundPanelH = roundShape === "circle" ? circleD : ovalH;
  const roundSewW = Math.max(0, roundPanelW - 2*sa);
  const roundSewH = Math.max(0, roundPanelH - 2*sa);
  const roundCutP = ellipsePerim(roundPanelW, roundPanelH);
  const roundSewP = ellipsePerim(roundSewW, roundSewH);
  const roundStripLen = roundSewP + 2*sa;

  const isRoundMode = mode === "round";
  const sewLen = mode==="three" ? sewLen3 : mode==="four" ? stripLen4 : roundStripLen;
  const Ls_disp = mode==="four" ? Ls_closed : Ls_open;
  const Hs_disp = mode==="four" ? Hs_closed : Hs_open;

  const rectangularReady = pL > 0 && pH > 0;
  const roundReady = roundPanelW > 0 && roundPanelH > 0;

  return (
    <div className="tab-page" data-group="bag-structures">
      <div className="tab-content-wrap">
        <div className="tab-intro-card">
          <div className="tab-intro-card-thumb" />
          <div className="tab-intro-card-text">
            <div className="tab-intro-card-title">Gusset Strip</div>
            <div className="tab-intro-card-desc">Calculates the cut length and width of a gusset strip based on the panel shape and how the strip wraps around it. Works for 3-sided rectangular bags, 4-sided closed loops, and round or oval panels.</div>
          </div>
        </div>

        <SABar th={th} sa={sa} setSa={setSa} cSa={cSa} setCsa={setCsa} />

        <SubTabs th={th} active={mode} set={setMode}
            tabs={[{id:"three",label:"3-Sided"},{id:"four",label:"4-Sided"},{id:"round",label:"Round / Oval"}]} />

          {mode==="three" && (
            <InfoBox th={th}>
              <strong>3-Sided:</strong> The strip wraps around 2 bottom corners, covering the bottom and both sides. Both short ends are raw top edges — left unsewn or finished separately. No end seam allowance is added to the strip length. Assumes 2 rounded corners (or 0 for square).
            </InfoBox>
          )}
          {mode==="four" && (
            <InfoBox th={th}>
              <strong>4-Sided:</strong> The strip wraps all 4 sides of the panel, forming a closed loop. Both short ends are sewn together — 2 seam allowances are included in the strip length. Assumes 4 rounded corners (or 0 for square).
            </InfoBox>
          )}
          {mode==="round" && (
            <InfoBox th={th}>
              <strong>Round / Oval:</strong> The strip wraps all the way around a circular or oval panel, like a round bag, train case, bucket bag bottom, or pouch end. The strip length includes 2 seam allowances for joining the short ends into a closed loop.
            </InfoBox>
          )}

          {isRoundMode ? (
            <Card th={th} style={{marginTop:12}}>
              <CardTitle th={th}>Round / Oval Panel — Cut Dimensions</CardTitle>
              <SubTabs th={th} active={roundShape} set={setRoundShape}
                tabs={[{id:"circle",label:"Circle"},{id:"oval",label:"Oval"}]} />
              {roundShape === "circle" ? (
                <FracInput th={th} label="Panel diameter (cut)" whole={dW} frac={dF} onWhole={setDW} onFrac={setDF} />
              ) : (
                <div className="frac-row">
                  <FracInput th={th} label="Panel width (cut)" whole={oWW} frac={oWF} onWhole={setOWW} onFrac={setOWF} />
                  <FracInput th={th} label="Panel height (cut)" whole={oHW} frac={oHF} onWhole={setOHW} onFrac={setOHF} />
                </div>
              )}
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:4 }}>
                <RRow th={th} label="Cut edge perimeter" value={fmtInch(roundCutP)} />
                <RRow th={th} label="Sewline perimeter" value={fmtInch(roundSewP)} accent />
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8, fontFamily:"Nunito,sans-serif" }}>
                Sewline Dimensions
              </div>
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px" }}>
                <RRow th={th} label={roundShape === "circle" ? "Sewline diameter" : "Panel sewline width"} value={fmtInch(roundSewW)} />
                {roundShape === "oval" && <RRow th={th} label="Panel sewline height" value={fmtInch(roundSewH)} />}
              </div>
              <NoteBox>
                Oval perimeter is estimated using a standard ellipse approximation and rounded for practical cutting. For unusual partial arcs, draft the partial run separately.
              </NoteBox>
            </Card>
          ) : (
            <Card th={th} style={{marginTop:12}}>
              <CardTitle th={th}>Bag Panel — Cut Dimensions</CardTitle>
              <div className="frac-row">
                <FracInput th={th} label="Panel width (cut)" whole={pLW} frac={pLF} onWhole={setPLW} onFrac={setPLF} />
                <FracInput th={th} label="Panel height (cut)" whole={pHW} frac={pHF} onWhole={setPHW} onFrac={setPHF} />
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10, fontFamily:"Nunito,sans-serif" }}>
                {mode==="three"?"Bottom Corner Radius (2 corners)":"Corner Radius (all 4 corners)"}
              </div>
              <FracInput th={th} label="Radius at cut edge" sub="— 0 for square corners" whole={rW} frac={rF} onWhole={setRW} onFrac={setRF} />
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:4 }}>
                {mode!=="four" && <RRow th={th} label="Gusset sewline run" value={fmtInch(sewLen3)} accent />}
                {mode==="four" && <RRow th={th} label="Enclosed sewline perimeter" value={fmtInch(sewLen4)} accent />}
              </div>
              <Divider th={th} />
              <div style={{ fontSize:13, fontWeight:800, color:th.sub, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8, fontFamily:"Nunito,sans-serif" }}>
                Sewline Dimensions
              </div>
              <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px" }}>
                <RRow th={th} label="Panel sewline width" value={fmtInch(Ls_disp)} />
                <RRow th={th} label="Panel sewline height" value={fmtInch(Hs_disp)} />
                <RRow th={th} label="Sewline corner radius" value={fmtInch(Rs)} />
              </div>
              {mode!=="four" && (
                <NoteBox>
                  The panel sewline height reflects SA on the bottom edge only — the top edge is assumed to be the bag opening and is left unsewn at this stage.
                </NoteBox>
              )}
            </Card>
          )}

          <Card th={th}>
            <CardTitle th={th}>Gusset Strip Dimensions</CardTitle>
            <FracInput th={th} label="Gusset finished width" sub="(finished interior depth of bag)" whole={gWW} frac={gWF} onWhole={setGWW} onFrac={setGWF} />
            <div style={{ background:th.resBg, borderRadius:8, padding:"12px 14px", marginTop:8 }}>
              <RRow th={th} label="Strip cut length" value={fmtInch(sewLen)} accent big />
              <RRow th={th} label="Strip cut width" value={fmtInch(gCut)} accent big />
              <RRow th={th} label="Strip finished width" value={fmtInch(gFin)} />
            </div>
            {mode==="three" && <NoteBox>Strip length equals the 3-sided sewline run exactly — no end seam allowance added. Both short ends are left raw as the bag's top edges.</NoteBox>}
            {mode==="four" && <NoteBox>Strip length includes 2 seam allowances for joining the short ends into a closed loop. Press the joining seam open before attaching the strip to the panel.</NoteBox>}
            {mode==="round" && <NoteBox>Strip length uses the round/oval sewline perimeter plus 2 seam allowances for joining the short ends into a closed loop. Press the joining seam open before attaching the strip to the panel.</NoteBox>}
            <NoteBox>
              <strong>Easing at curves:</strong> Clip the strip's seam allowance at rounded curves every {fmtInch(0.25)}–{fmtInch(0.375)} (into but not through the seam allowance) so it lies flat around the curve.
            </NoteBox>
          </Card>

          <Card th={th}>
            <CardTitle th={th}>Panel & Gusset Diagram</CardTitle>
            {isRoundMode ? (
              <RoundOvalGussetDiagram
                shape={roundShape}
                panelW={roundPanelW}
                panelH={roundPanelH}
                gussetCutW={gCut}
                gussetLen={sewLen}
                sa={sa}
              />
            ) : (
              <GussetDiagram
                mode={mode}
                panelW={pL}
                panelH={pH}
                cornerR={rC}
                gussetCutW={gCut}
                gussetLen={sewLen}
                sa={sa}
              />
            )}
            {((isRoundMode && !roundReady) || (!isRoundMode && !rectangularReady)) && (
              <div style={{textAlign:"center",padding:"26px 20px",color:th.sub,fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:600}}>
                Enter panel dimensions above to see the diagram.
              </div>
            )}
          </Card>
      </div>
    </div>
  );
}

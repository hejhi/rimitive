/**
 * SVG attribute types for use with el() props.
 *
 * These types define what attributes can be passed to SVG elements,
 * using string/number types that match setAttribute() behavior,
 * NOT the DOM property types (like SVGAnimatedLength) that you get
 * when reading from an SVG element.
 *
 * @see https://github.com/hejhi/rimitive/issues/41
 */

/**
 * Core SVG attributes shared by most SVG elements.
 * All values accept string | number since they're set via setAttribute().
 */
export interface SVGCoreAttributes {
  // Identification
  id?: string;
  lang?: string;
  tabindex?: number;
  'xml:base'?: string;
  'xml:lang'?: string;
  'xml:space'?: 'default' | 'preserve';

  // Styling
  class?: string;
  className?: string;
  style?: string | CSSStyleDeclaration;

  // Presentation attributes (subset - most common ones)
  color?: string;
  cursor?: string;
  display?: string;
  fill?: string;
  fillOpacity?: number | string;
  fillRule?: 'nonzero' | 'evenodd' | 'inherit';
  filter?: string;
  mask?: string;
  opacity?: number | string;
  overflow?: string;
  pointerEvents?: string;
  stroke?: string;
  strokeDasharray?: number | string;
  strokeDashoffset?: number | string;
  strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit';
  strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
  strokeMiterlimit?: number | string;
  strokeOpacity?: number | string;
  strokeWidth?: number | string;
  transform?: string;
  visibility?: string;

  // Text styling
  fontFamily?: string;
  fontSize?: number | string;
  fontStyle?: string;
  fontWeight?: number | string;
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit';
  textDecoration?: string;

  // Clipping and masking
  clipPath?: string;
  clipRule?: 'nonzero' | 'evenodd' | 'inherit';
}

/**
 * SVG element-specific attributes.
 * Maps SVG tag names to their specific attribute interfaces.
 */
export interface SVGElementAttributes {
  svg: SVGCoreAttributes & {
    width?: number | string;
    height?: number | string;
    viewBox?: string;
    preserveAspectRatio?: string;
    x?: number | string;
    y?: number | string;
    xmlns?: string;
    'xmlns:xlink'?: string;
  };

  circle: SVGCoreAttributes & {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    pathLength?: number | string;
  };

  ellipse: SVGCoreAttributes & {
    cx?: number | string;
    cy?: number | string;
    rx?: number | string;
    ry?: number | string;
    pathLength?: number | string;
  };

  line: SVGCoreAttributes & {
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
    pathLength?: number | string;
  };

  path: SVGCoreAttributes & {
    d?: string;
    pathLength?: number | string;
  };

  polygon: SVGCoreAttributes & {
    points?: string;
    pathLength?: number | string;
  };

  polyline: SVGCoreAttributes & {
    points?: string;
    pathLength?: number | string;
  };

  rect: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    rx?: number | string;
    ry?: number | string;
    pathLength?: number | string;
  };

  g: SVGCoreAttributes;

  defs: SVGCoreAttributes;

  symbol: SVGCoreAttributes & {
    viewBox?: string;
    preserveAspectRatio?: string;
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    refX?: number | string;
    refY?: number | string;
  };

  use: SVGCoreAttributes & {
    href?: string;
    'xlink:href'?: string;
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };

  image: SVGCoreAttributes & {
    href?: string;
    'xlink:href'?: string;
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    preserveAspectRatio?: string;
    crossorigin?: 'anonymous' | 'use-credentials' | '';
  };

  text: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    dx?: number | string;
    dy?: number | string;
    textLength?: number | string;
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
    rotate?: string;
  };

  tspan: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    dx?: number | string;
    dy?: number | string;
    textLength?: number | string;
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
    rotate?: string;
  };

  textPath: SVGCoreAttributes & {
    href?: string;
    'xlink:href'?: string;
    startOffset?: number | string;
    method?: 'align' | 'stretch';
    spacing?: 'auto' | 'exact';
    side?: 'left' | 'right';
    textLength?: number | string;
    lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
  };

  foreignObject: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
  };

  clipPath: SVGCoreAttributes & {
    clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  };

  mask: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  };

  marker: SVGCoreAttributes & {
    viewBox?: string;
    preserveAspectRatio?: string;
    refX?: number | string;
    refY?: number | string;
    markerUnits?: 'userSpaceOnUse' | 'strokeWidth';
    markerWidth?: number | string;
    markerHeight?: number | string;
    orient?: 'auto' | 'auto-start-reverse' | number | string;
  };

  pattern: SVGCoreAttributes & {
    viewBox?: string;
    preserveAspectRatio?: string;
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    patternUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    patternContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    patternTransform?: string;
    href?: string;
    'xlink:href'?: string;
  };

  linearGradient: SVGCoreAttributes & {
    x1?: number | string;
    y1?: number | string;
    x2?: number | string;
    y2?: number | string;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    gradientTransform?: string;
    spreadMethod?: 'pad' | 'reflect' | 'repeat';
    href?: string;
    'xlink:href'?: string;
  };

  radialGradient: SVGCoreAttributes & {
    cx?: number | string;
    cy?: number | string;
    r?: number | string;
    fx?: number | string;
    fy?: number | string;
    fr?: number | string;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    gradientTransform?: string;
    spreadMethod?: 'pad' | 'reflect' | 'repeat';
    href?: string;
    'xlink:href'?: string;
  };

  stop: SVGCoreAttributes & {
    offset?: number | string;
    stopColor?: string;
    stopOpacity?: number | string;
  };

  filter: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    filterUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    primitiveUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
  };

  feBlend: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    in2?: string;
    mode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
  };

  feColorMatrix: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    type?: 'matrix' | 'saturate' | 'hueRotate' | 'luminanceToAlpha';
    values?: string;
  };

  feComponentTransfer: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
  };

  feComposite: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    in2?: string;
    operator?: 'over' | 'in' | 'out' | 'atop' | 'xor' | 'lighter' | 'arithmetic';
    k1?: number | string;
    k2?: number | string;
    k3?: number | string;
    k4?: number | string;
  };

  feConvolveMatrix: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    order?: number | string;
    kernelMatrix?: string;
    divisor?: number | string;
    bias?: number | string;
    targetX?: number | string;
    targetY?: number | string;
    edgeMode?: 'duplicate' | 'wrap' | 'none';
    preserveAlpha?: boolean | 'true' | 'false';
  };

  feDiffuseLighting: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    surfaceScale?: number | string;
    diffuseConstant?: number | string;
  };

  feDisplacementMap: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    in2?: string;
    scale?: number | string;
    xChannelSelector?: 'R' | 'G' | 'B' | 'A';
    yChannelSelector?: 'R' | 'G' | 'B' | 'A';
  };

  feDropShadow: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    dx?: number | string;
    dy?: number | string;
    stdDeviation?: number | string;
    floodColor?: string;
    floodOpacity?: number | string;
  };

  feFlood: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    floodColor?: string;
    floodOpacity?: number | string;
  };

  feGaussianBlur: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    stdDeviation?: number | string;
    edgeMode?: 'duplicate' | 'wrap' | 'none';
  };

  feImage: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    href?: string;
    'xlink:href'?: string;
    preserveAspectRatio?: string;
    crossorigin?: 'anonymous' | 'use-credentials' | '';
  };

  feMerge: SVGCoreAttributes & SVGFilterPrimitiveAttributes;

  feMergeNode: SVGCoreAttributes & {
    in?: string;
  };

  feMorphology: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    operator?: 'erode' | 'dilate';
    radius?: number | string;
  };

  feOffset: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    dx?: number | string;
    dy?: number | string;
  };

  feSpecularLighting: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
    surfaceScale?: number | string;
    specularConstant?: number | string;
    specularExponent?: number | string;
  };

  feTile: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    in?: string;
  };

  feTurbulence: SVGCoreAttributes & SVGFilterPrimitiveAttributes & {
    baseFrequency?: number | string;
    numOctaves?: number | string;
    seed?: number | string;
    stitchTiles?: 'stitch' | 'noStitch';
    type?: 'fractalNoise' | 'turbulence';
  };

  feDistantLight: SVGCoreAttributes & {
    azimuth?: number | string;
    elevation?: number | string;
  };

  fePointLight: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    z?: number | string;
  };

  feSpotLight: SVGCoreAttributes & {
    x?: number | string;
    y?: number | string;
    z?: number | string;
    pointsAtX?: number | string;
    pointsAtY?: number | string;
    pointsAtZ?: number | string;
    specularExponent?: number | string;
    limitingConeAngle?: number | string;
  };

  feFuncR: SVGTransferFunctionAttributes;
  feFuncG: SVGTransferFunctionAttributes;
  feFuncB: SVGTransferFunctionAttributes;
  feFuncA: SVGTransferFunctionAttributes;

  animate: SVGCoreAttributes & SVGAnimationAttributes;
  animateMotion: SVGCoreAttributes & SVGAnimationAttributes & {
    path?: string;
    keyPoints?: string;
    rotate?: 'auto' | 'auto-reverse' | number | string;
  };
  animateTransform: SVGCoreAttributes & SVGAnimationAttributes & {
    type?: 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY';
  };
  set: SVGCoreAttributes & SVGAnimationAttributes;
  mpath: SVGCoreAttributes & {
    href?: string;
    'xlink:href'?: string;
  };

  switch: SVGCoreAttributes;
  desc: SVGCoreAttributes;
  metadata: SVGCoreAttributes;
  title: SVGCoreAttributes;

  view: SVGCoreAttributes & {
    viewBox?: string;
    preserveAspectRatio?: string;
  };
}

/**
 * Common filter primitive attributes
 */
interface SVGFilterPrimitiveAttributes {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  result?: string;
}

/**
 * Transfer function attributes for feFuncR/G/B/A
 */
interface SVGTransferFunctionAttributes extends SVGCoreAttributes {
  type?: 'identity' | 'table' | 'discrete' | 'linear' | 'gamma';
  tableValues?: string;
  slope?: number | string;
  intercept?: number | string;
  amplitude?: number | string;
  exponent?: number | string;
  offset?: number | string;
}

/**
 * Common animation attributes
 */
interface SVGAnimationAttributes {
  attributeName?: string;
  attributeType?: 'CSS' | 'XML' | 'auto';
  begin?: string;
  dur?: string;
  end?: string;
  min?: string;
  max?: string;
  restart?: 'always' | 'whenNotActive' | 'never';
  repeatCount?: number | string | 'indefinite';
  repeatDur?: string;
  fill?: 'freeze' | 'remove';
  calcMode?: 'discrete' | 'linear' | 'paced' | 'spline';
  values?: string;
  keyTimes?: string;
  keySplines?: string;
  from?: string;
  to?: string;
  by?: string;
  additive?: 'replace' | 'sum';
  accumulate?: 'none' | 'sum';
}

/**
 * Get SVG attribute type for a tag, falling back to core attributes for unknown tags.
 */
export type SVGAttributesFor<K extends keyof SVGElementTagNameMap> =
  K extends keyof SVGElementAttributes
    ? SVGElementAttributes[K]
    : SVGCoreAttributes;

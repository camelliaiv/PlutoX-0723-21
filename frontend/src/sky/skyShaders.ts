interface ShaderDialect {
  versionLine: string;
  vertexInput: string;
  vertexOutput: string;
  fragmentInput: string;
  fragmentOutputDeclaration: string;
  fragmentOutput: string;
  textureFunction: string;
}

function dialectFor(isWebGl2: boolean): ShaderDialect {
  if (isWebGl2) {
    return {
      versionLine: "#version 300 es\n",
      vertexInput: "in",
      vertexOutput: "out",
      fragmentInput: "in",
      fragmentOutputDeclaration: "out vec4 fragmentColour;",
      fragmentOutput: "fragmentColour",
      textureFunction: "texture",
    };
  }
  return {
    versionLine: "",
    vertexInput: "attribute",
    vertexOutput: "varying",
    fragmentInput: "varying",
    fragmentOutputDeclaration: "",
    fragmentOutput: "gl_FragColor",
    textureFunction: "texture2D",
  };
}

export function milkyWayVertexSource(isWebGl2: boolean): string {
  const dialect = dialectFor(isWebGl2);
  return `${dialect.versionLine}${dialect.vertexInput} vec2 corner;
${dialect.vertexOutput} vec2 screenPosition;
void main() {
  screenPosition = corner;
  gl_Position = vec4(corner, 0.0, 1.0);
}`;
}

export function milkyWayFragmentSource(isWebGl2: boolean): string {
  const dialect = dialectFor(isWebGl2);
  const sampleMap = isWebGl2
    ? `vec2 shiftedCoordinate = vec2(fract(mapCoordinate.x + 0.5), mapCoordinate.y);
  vec2 gradientX = dFdx(mapCoordinate);
  vec2 gradientY = dFdy(mapCoordinate);
  vec2 shiftedGradientX = dFdx(shiftedCoordinate);
  vec2 shiftedGradientY = dFdy(shiftedCoordinate);
  if (abs(shiftedGradientX.x) < abs(gradientX.x)) {
    gradientX = shiftedGradientX;
    gradientY = shiftedGradientY;
  }
  vec3 mapColour = textureGrad(milkyWayMap, mapCoordinate, gradientX, gradientY).rgb;`
    : `vec3 mapColour = ${dialect.textureFunction}(milkyWayMap, mapCoordinate).rgb;`;
  return `${dialect.versionLine}precision highp float;
${dialect.fragmentInput} vec2 screenPosition;
uniform vec3 cameraForward;
uniform vec3 cameraRight;
uniform vec3 cameraUp;
uniform vec2 viewportSize;
uniform float focalLength;
uniform float mapGain;
uniform mat3 equatorialToGalactic;
uniform sampler2D milkyWayMap;
uniform vec3 backgroundColour;
${dialect.fragmentOutputDeclaration}
void main() {
  vec3 direction = normalize(
    cameraForward
    + cameraRight * (screenPosition.x * viewportSize.x * 0.5 / focalLength)
    + cameraUp * (screenPosition.y * viewportSize.y * 0.5 / focalLength)
  );
  vec3 galactic = equatorialToGalactic * direction;
  float longitude = atan(galactic.y, galactic.x);
  float latitude = asin(clamp(galactic.z, -1.0, 1.0));
  vec2 mapCoordinate = vec2(0.5 - longitude / 6.2831853, 0.5 - latitude / 3.14159265);
  ${sampleMap}
  ${dialect.fragmentOutput} = vec4(backgroundColour + mapColour * mapGain, 1.0);
}`;
}

export function starVertexSource(isWebGl2: boolean): string {
  const dialect = dialectFor(isWebGl2);
  return `${dialect.versionLine}${dialect.vertexInput} vec3 starPosition;
${dialect.vertexInput} vec2 starMagnitudeAndBackground;
${dialect.vertexInput} vec3 starColour;
uniform vec3 cameraPosition;
uniform vec3 cameraForward;
uniform vec3 cameraRight;
uniform vec3 cameraUp;
uniform vec2 viewportSize;
uniform float focalLength;
uniform float devicePixelRatio;
uniform float maximumPointSize;
${dialect.vertexOutput} vec3 colour;
${dialect.vertexOutput} vec4 shape;
${dialect.vertexOutput} float pointSize;
void main() {
  bool isBackgroundStar = starMagnitudeAndBackground.y > 0.5;
  vec3 relativePosition = isBackgroundStar ? starPosition : starPosition - cameraPosition;
  float depth = dot(relativePosition, cameraForward);
  float magnitude = starMagnitudeAndBackground.x;
  float apparentMagnitude = isBackgroundStar
    ? magnitude
    : magnitude + 5.0 * log(max(length(relativePosition), 0.03) / 10.0) / 2.302585;
  float intensity = exp(-0.921034 * (apparentMagnitude - 6.0));
  if (depth < 0.04 || intensity < 0.012) {
    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
    gl_PointSize = 0.0;
    colour = vec3(0.0);
    shape = vec4(0.0);
    pointSize = 1.0;
    return;
  }
  float coreSigma = (0.5 + 0.15 * max(0.0, 6.0 - apparentMagnitude)) * devicePixelRatio;
  float glow = clamp(log(intensity / 20.0) / 3.87, 0.0, 1.0);
  glow = glow * glow * (3.0 - 2.0 * glow);
  float haloAmount = clamp((3.2 - apparentMagnitude) / 4.0, 0.0, 1.0) * 0.45 + glow * glow * 0.3;
  coreSigma *= 1.0 + 0.4 * glow;
  float haloRadius = coreSigma * 3.0 * (1.0 + 1.6 * glow);
  float radius = max(3.2 * coreSigma, haloAmount > 0.0 ? 3.5 * haloRadius : 0.0);
  float size = min(2.0 * radius + 2.0, maximumPointSize);
  gl_Position = vec4(
    dot(relativePosition, cameraRight) / depth * focalLength * 2.0 / viewportSize.x,
    dot(relativePosition, cameraUp) / depth * focalLength * 2.0 / viewportSize.y,
    0.0,
    1.0
  );
  gl_PointSize = size;
  colour = starColour;
  shape = vec4(min(intensity, 1.0 + 7.0 * glow), coreSigma, haloAmount, haloRadius);
  pointSize = size;
}`;
}

export function starFragmentSource(isWebGl2: boolean): string {
  const dialect = dialectFor(isWebGl2);
  return `${dialect.versionLine}precision mediump float;
${dialect.fragmentInput} vec3 colour;
${dialect.fragmentInput} vec4 shape;
${dialect.fragmentInput} float pointSize;
${dialect.fragmentOutputDeclaration}
void main() {
  float offsetFromCentre = length(gl_PointCoord - 0.5);
  float radius = offsetFromCentre * pointSize;
  float core = exp(-0.5 * radius * radius / (shape.y * shape.y));
  float visibleIntensity = min(shape.x, 1.0);
  float halo = shape.z * visibleIntensity * exp(-radius / shape.w)
    * (1.0 - smoothstep(0.34, 0.5, offsetFromCentre));
  float luminance = core * visibleIntensity + halo;
  float overexposure = core * max(shape.x - 1.0, 0.0) * 0.1;
  ${dialect.fragmentOutput} = vec4(colour * luminance + vec3(overexposure), 1.0);
}`;
}

import type { CameraBasis, Viewport } from "./skyCamera";
import { COLOUR_BYTES_PER_STAR, RENDER_VALUES_PER_STAR, type SkyCatalogue } from "./skyCatalogue";
import { equatorialToGalacticRows, matrixRowsToColumnMajor } from "./skyMath";
import {
  milkyWayFragmentSource,
  milkyWayVertexSource,
  starFragmentSource,
  starVertexSource,
} from "./skyShaders";

export type RendererKind = "webgl2" | "webgl1";

export interface RenderFrame {
  basis: CameraBasis;
  viewport: Viewport;
  focalLength: number;
  devicePixelRatio: number;
}

export interface SkyRenderer {
  kind: RendererKind;
  draw(frame: RenderFrame): void;
}

type GraphicsContext = WebGL2RenderingContext | WebGLRenderingContext;

const MILKY_WAY_GAIN = 0.3;
const BACKGROUND_COLOUR: readonly [number, number, number] = [0.008, 0.012, 0.026];
const MAXIMUM_STAR_POINT_SIZE = 256;
const MAXIMUM_ANISOTROPY = 8;
const MAP_TEXTURE_WIDTH = 4096;
const BYTES_PER_FLOAT = 4;

function compileShader(gl: GraphicsContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("A shader could not be created.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "A shader could not be compiled.");
  }
  return shader;
}

function createProgram(
  gl: GraphicsContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "A shader program could not be linked.");
  }
  return program;
}

function createBuffer(gl: GraphicsContext, data: ArrayBufferView): WebGLBuffer {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function createMapTexture(
  gl: GraphicsContext,
  isWebGl2: boolean,
  image: ImageBitmap | null,
): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (!image) {
    return texture;
  }
  const width = Math.min(MAP_TEXTURE_WIDTH, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  const height = width / 2;
  let source: ImageBitmap | HTMLCanvasElement = image;
  if (image.width !== width || image.height !== height) {
    const resized = document.createElement("canvas");
    resized.width = width;
    resized.height = height;
    const resizedContext = resized.getContext("2d");
    if (!resizedContext) {
      return texture;
    }
    resizedContext.imageSmoothingQuality = "high";
    resizedContext.drawImage(image, 0, 0, width, height);
    source = resized;
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  if (isWebGl2) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  }
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy) {
    const supported = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(MAXIMUM_ANISOTROPY, supported),
    );
  }
  return texture;
}

function requireUniform(
  gl: GraphicsContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) {
    throw new Error(`The shader uniform ${name} is missing.`);
  }
  return location;
}

export function createWebGlRenderer(
  canvas: HTMLCanvasElement,
  catalogue: SkyCatalogue,
  milkyWayImage: ImageBitmap | null,
  onContextLost: () => void,
): SkyRenderer | null {
  const options: WebGLContextAttributes = {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  };
  const gl = canvas.getContext("webgl2", options) ?? canvas.getContext("webgl", options);
  if (!gl) {
    return null;
  }
  const isWebGl2 =
    typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
  try {
    const milkyWayProgram = createProgram(
      gl,
      milkyWayVertexSource(isWebGl2),
      milkyWayFragmentSource(isWebGl2),
    );
    const starProgram = createProgram(gl, starVertexSource(isWebGl2), starFragmentSource(isWebGl2));
    const cornerBuffer = createBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));
    const starBuffer = createBuffer(gl, catalogue.renderValues);
    const colourBuffer = createBuffer(gl, catalogue.colours);
    const mapTexture = createMapTexture(gl, isWebGl2, milkyWayImage);
    const galacticMatrix = new Float32Array(matrixRowsToColumnMajor(equatorialToGalacticRows()));
    const maximumPointSize = Math.min(
      (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] ?? 1,
      MAXIMUM_STAR_POINT_SIZE,
    );

    const mapUniforms = {
      cameraForward: requireUniform(gl, milkyWayProgram, "cameraForward"),
      cameraRight: requireUniform(gl, milkyWayProgram, "cameraRight"),
      cameraUp: requireUniform(gl, milkyWayProgram, "cameraUp"),
      viewportSize: requireUniform(gl, milkyWayProgram, "viewportSize"),
      focalLength: requireUniform(gl, milkyWayProgram, "focalLength"),
      mapGain: requireUniform(gl, milkyWayProgram, "mapGain"),
      equatorialToGalactic: requireUniform(gl, milkyWayProgram, "equatorialToGalactic"),
      milkyWayMap: requireUniform(gl, milkyWayProgram, "milkyWayMap"),
      backgroundColour: requireUniform(gl, milkyWayProgram, "backgroundColour"),
    };
    const starUniforms = {
      cameraPosition: requireUniform(gl, starProgram, "cameraPosition"),
      cameraForward: requireUniform(gl, starProgram, "cameraForward"),
      cameraRight: requireUniform(gl, starProgram, "cameraRight"),
      cameraUp: requireUniform(gl, starProgram, "cameraUp"),
      viewportSize: requireUniform(gl, starProgram, "viewportSize"),
      focalLength: requireUniform(gl, starProgram, "focalLength"),
      devicePixelRatio: requireUniform(gl, starProgram, "devicePixelRatio"),
      maximumPointSize: requireUniform(gl, starProgram, "maximumPointSize"),
    };
    const cornerAttribute = gl.getAttribLocation(milkyWayProgram, "corner");
    const positionAttribute = gl.getAttribLocation(starProgram, "starPosition");
    const magnitudeAttribute = gl.getAttribLocation(starProgram, "starMagnitudeAndBackground");
    const colourAttribute = gl.getAttribLocation(starProgram, "starColour");

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      onContextLost();
    });

    return {
      kind: isWebGl2 ? "webgl2" : "webgl1",
      draw(frame: RenderFrame): void {
        const { basis, viewport } = frame;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.BLEND);

        gl.useProgram(milkyWayProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
        gl.enableVertexAttribArray(cornerAttribute);
        gl.vertexAttribPointer(cornerAttribute, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mapTexture);
        gl.uniform1i(mapUniforms.milkyWayMap, 0);
        gl.uniform3fv(mapUniforms.cameraForward, basis.forward);
        gl.uniform3fv(mapUniforms.cameraRight, basis.right);
        gl.uniform3fv(mapUniforms.cameraUp, basis.up);
        gl.uniform2f(mapUniforms.viewportSize, viewport.width, viewport.height);
        gl.uniform1f(mapUniforms.focalLength, frame.focalLength);
        gl.uniform1f(mapUniforms.mapGain, MILKY_WAY_GAIN);
        gl.uniformMatrix3fv(mapUniforms.equatorialToGalactic, false, galacticMatrix);
        gl.uniform3f(mapUniforms.backgroundColour, ...BACKGROUND_COLOUR);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disableVertexAttribArray(cornerAttribute);

        gl.useProgram(starProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        const starStride = RENDER_VALUES_PER_STAR * BYTES_PER_FLOAT;
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        gl.enableVertexAttribArray(positionAttribute);
        gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, starStride, 0);
        gl.enableVertexAttribArray(magnitudeAttribute);
        gl.vertexAttribPointer(
          magnitudeAttribute,
          2,
          gl.FLOAT,
          false,
          starStride,
          3 * BYTES_PER_FLOAT,
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
        gl.enableVertexAttribArray(colourAttribute);
        gl.vertexAttribPointer(
          colourAttribute,
          3,
          gl.UNSIGNED_BYTE,
          true,
          COLOUR_BYTES_PER_STAR,
          0,
        );
        gl.uniform3fv(starUniforms.cameraPosition, basis.position);
        gl.uniform3fv(starUniforms.cameraForward, basis.forward);
        gl.uniform3fv(starUniforms.cameraRight, basis.right);
        gl.uniform3fv(starUniforms.cameraUp, basis.up);
        gl.uniform2f(starUniforms.viewportSize, viewport.width, viewport.height);
        gl.uniform1f(starUniforms.focalLength, frame.focalLength);
        gl.uniform1f(starUniforms.devicePixelRatio, frame.devicePixelRatio);
        gl.uniform1f(starUniforms.maximumPointSize, maximumPointSize);
        gl.drawArrays(gl.POINTS, 0, catalogue.count);
        gl.disableVertexAttribArray(positionAttribute);
        gl.disableVertexAttribArray(magnitudeAttribute);
        gl.disableVertexAttribArray(colourAttribute);
      },
    };
  } catch {
    return null;
  }
}

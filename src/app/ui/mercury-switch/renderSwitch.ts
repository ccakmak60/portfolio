import { GLOW, LAMP_Y, printScale } from "./dial";
import { L, LEAD, N, PX, PY, RO, type Sim } from "./mercury";
import { BACKDROP, CAPSULE, FIELD, FH, FW, ROOM, SHADE, SH, STATIC, SW } from "./shaders";

export const FRAME = 540;

const VERTEX = `#version 300 es
layout(location = 0) in vec2 a;
uniform vec4 uQuad;
uniform vec3 uXf;
out vec2 vL;
out vec2 vP;
void main() {
  vec2 l = uQuad.xy + (a * 2.0 - 1.0) * uQuad.zw;
  float c = cos(uXf.z), s = sin(uXf.z);
  vec2 w = uXf.xy + vec2(c * l.x - s * l.y, s * l.x + c * l.y);
  vL = l;
  vP = w;
  gl_Position = vec4(w.x / ${FRAME}.0 * 2.0 - 1.0, 1.0 - w.y / ${FRAME}.0 * 2.0, 0.0, 1.0);
}`;

type Bounds = [left: number, top: number, right: number, bottom: number];
type Uniform =
  | [number]
  | [number, number]
  | [number, number, number]
  | [number, number, number, number];

const DIRTY: Bounds = [PX - 240, PY - 130, PX + 290, PY + 180];
const LIT: Bounds = [PX - GLOW, PY + LAMP_Y - GLOW, PX + GLOW, PY + LAMP_Y + GLOW];

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not allocate a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message ?? "Shader compilation failed");
  }
  return shader;
}

export function createSwitchRenderer(canvas: HTMLCanvasElement, font: string) {
  const context = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    depth: false,
    preserveDrawingBuffer: true,
  });
  if (!context?.getExtension("EXT_color_buffer_float") || !context.getExtension("OES_texture_float_linear")) {
    return null;
  }
  const gl = context;

  const disposals: (() => void)[] = [];
  const dispose = () => {
    for (const release of disposals.reverse()) release();
    disposals.length = 0;
  };

  try {
    const size = Math.round(FRAME * Math.min(2, Math.max(1, window.devicePixelRatio)));
    const dpr = size / FRAME;
    canvas.width = canvas.height = size;

    const quad = gl.createVertexArray();
    const buffer = gl.createBuffer();
    disposals.push(() => gl.deleteVertexArray(quad), () => gl.deleteBuffer(buffer));
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    disposals.push(() => gl.deleteShader(vertex));

    const program = (source: string) => {
      const fragment = compile(gl, gl.FRAGMENT_SHADER, source);
      const handle = gl.createProgram();
      if (!handle) {
        gl.deleteShader(fragment);
        throw new Error("Could not allocate a program");
      }
      disposals.push(() => gl.deleteProgram(handle));
      gl.attachShader(handle, vertex);
      gl.attachShader(handle, fragment);
      gl.linkProgram(handle);
      gl.detachShader(handle, fragment);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(handle) ?? "Shader linking failed");
      }

      const locations = new Map<string, WebGLUniformLocation | null>();
      const at = (name: string) => {
        if (!locations.has(name)) locations.set(name, gl.getUniformLocation(handle, name));
        return locations.get(name) ?? null;
      };
      const activate = () => gl.useProgram(handle);
      const set = (name: string, ...value: Uniform) => {
        const location = at(name);
        switch (value.length) {
          case 1: gl.uniform1f(location, ...value); break;
          case 2: gl.uniform2f(location, ...value); break;
          case 3: gl.uniform3f(location, ...value); break;
          case 4: gl.uniform4f(location, ...value); break;
        }
      };
      activate();
      set("uQuad", FRAME / 2, FRAME / 2, FRAME / 2, FRAME / 2);
      return {
        activate,
        set,
        texture: (name: string, unit: number) => gl.uniform1i(at(name), unit),
        points: (value: Float32Array) => gl.uniform2fv(at("uPts[0]"), value),
      };
    };

    const field = program(FIELD);
    const cast = program(SHADE);
    const fixed = program(STATIC);
    const reflection = program(ROOM);
    const backdrop = program(BACKDROP);
    const capsule = program(CAPSULE);

    const bindTexture = (unit: number) => {
      const texture = gl.createTexture();
      if (!texture) throw new Error("Could not allocate a texture");
      disposals.push(() => gl.deleteTexture(texture));
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    };

    const target = (unit: number, width: number, height: number) => {
      const texture = bindTexture(unit);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      const framebuffer = gl.createFramebuffer();
      if (!framebuffer) throw new Error("Could not allocate a framebuffer");
      disposals.push(() => gl.deleteFramebuffer(framebuffer));
      const bind = () => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, width, height);
      };
      bind();
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Floating-point framebuffer is unavailable");
      }
      return bind;
    };

    const bindLiquid = target(0, FW, FH);
    const bindWall = target(1, size, size);
    const bindRoom = target(2, 640, 640);
    const bindShade = target(4, SW, SH);
    const scale = printScale(size, dpr, PX, PY, font);
    bindTexture(3);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scale);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.disable(gl.SCISSOR_TEST);
    bindRoom();
    reflection.activate();
    draw();
    bindWall();
    fixed.activate();
    fixed.set("uDpr", dpr);
    fixed.texture("uInk", 3);
    draw();

    for (const scene of [backdrop, capsule]) {
      scene.activate();
      scene.set("uDpr", dpr);
      scene.texture("uField", 0);
      scene.texture("uWall", 1);
      scene.texture("uRoom", 2);
      scene.texture("uShade", 4);
    }
    capsule.set("uQuad", LEAD / 2, 0, L + RO + 3 + LEAD / 2, RO + 4);
    cast.activate();
    cast.texture("uField", 0);

    const points = new Float32Array(N * 2);
    let previous: { bounds: Bounds; angle: number; heat: number } | undefined;

    function paint(sim: Sim, heat: number) {
      if (gl.isContextLost()) return;
      const cos = Math.cos(sim.th);
      const sin = Math.sin(sim.th);
      const bounds: Bounds = [FRAME, FRAME, 0, 0];
      for (let i = 0; i < N; i++) {
        const x = sim.x[i];
        const y = sim.y[i];
        points[2 * i] = x;
        points[2 * i + 1] = y;
        const worldX = PX + cos * x - sin * y;
        const worldY = PY + sin * x + cos * y;
        bounds[0] = Math.min(bounds[0], worldX - 26);
        bounds[1] = Math.min(bounds[1], worldY - 26);
        bounds[2] = Math.max(bounds[2], worldX + 52);
        bounds[3] = Math.max(bounds[3], worldY + 76);
      }

      gl.disable(gl.SCISSOR_TEST);
      bindLiquid();
      field.activate();
      field.points(points);
      field.set("uWet", sim.wet[0], sim.wet[1]);
      draw();
      bindShade();
      cast.activate();
      draw();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, size, size);

      const glow = 2.8 * heat ** 2.6;
      for (const scene of [backdrop, capsule]) {
        scene.activate();
        scene.set("uTurn", cos, sin);
        scene.set("uGlow", glow, glow * (0.035 + 0.065 * heat), glow * (0.001 + 0.004 * heat));
      }
      capsule.set("uXf", PX, PY, sim.th);

      const scene = () => {
        backdrop.activate();
        draw();
        capsule.activate();
        draw();
      };

      if (previous) {
        const dirty: Bounds = previous.angle === sim.th
          ? [
            Math.min(bounds[0], previous.bounds[0]),
            Math.min(bounds[1], previous.bounds[1]),
            Math.max(bounds[2], previous.bounds[2]),
            Math.max(bounds[3], previous.bounds[3]),
          ]
          : DIRTY;
        const region = ([left, top, right, bottom]: Bounds) => {
          const x = Math.floor(left * dpr);
          const y = Math.floor((FRAME - bottom) * dpr);
          gl.scissor(x, y, Math.ceil(right * dpr) - x, Math.ceil((FRAME - top) * dpr) - y);
          scene();
        };
        gl.enable(gl.SCISSOR_TEST);
        region(dirty);
        if (previous.heat !== heat
          && (dirty[0] > LIT[0] || dirty[1] > LIT[1] || dirty[2] < LIT[2] || dirty[3] < LIT[3])) {
          region(LIT);
        }
        gl.disable(gl.SCISSOR_TEST);
      } else {
        scene();
      }
      previous = { bounds, angle: sim.th, heat };
    }

    return { paint, dispose };
  } catch {
    dispose();
    return null;
  }
}

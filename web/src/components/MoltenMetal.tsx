import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import './MoltenMetal.css';

type InstitutionBackgroundProps = {
  /** Campus photo / building / school photo (URL or imported asset) */
  image?: string;
  /** Main school color: used for the tint and the deep tones of the sheen */
  primaryColor?: string;
  /** Secondary school color: used for the mid tones and the base rule */
  accentColor?: string;
  /** Third school color: used for the brightest highlights of the sheen */
  lightColor?: string;
  /** 'light' washes the image toward the supplied colors so it sits behind a light card; 'dark' is the original moody look */
  mode?: 'light' | 'dark';
  /** 0-1: strength of the color wash over the photo (default depends on mode) */
  tint?: number;
  /** 0-1: strength of the animated light sheen (default depends on mode) */
  sheen?: number;
  /** Speed of the sheen animation */
  sheenSpeed?: number;
  /** Slow zoom/pan of the photo (Ken Burns) */
  drift?: boolean;
  /** Photo and sheen shift slightly toward the cursor */
  parallax?: boolean;
  /** How far (px) the photo shifts with the cursor */
  parallaxAmount?: number;
  className?: string;
  children?: React.ReactNode;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
};

// Light mode runs accent -> primary -> light so the sheen never darkens the page.
const sheenPalette = (
  mode: 'light' | 'dark',
  primary: string,
  accent: string,
  light: string,
): [number, number, number][] =>
  mode === 'light'
    ? [hexToRgb(accent), hexToRgb(primary), hexToRgb(light)]
    : [hexToRgb(primary), hexToRgb(accent), hexToRgb(light)];

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Same flowing-light field as the original molten shader, retuned as a soft
// sheen: lower contrast, wide falloff, and output meant to be blended over a photo.
const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec2 uMouse;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;

void main() {
  float time = iTime;
  vec2 p = 3.0 * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;
  p += (uMouse - 0.5) * 0.6;

  vec2 i = p;
  float c = 0.0;
  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);
  float rot = length(p) + time - 0.2 * p.x;
  float cr = cos(rot);
  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cr - time), cr) * -0.2;

  for (float n = 0.0; n < 3.0; n++) {
    p *= warp;
    float t = r - time / (n + 3.0);
    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);
    c += 0.16 / length(vec2(sin(i.x + t), cos(i.y + t)));
  }

  float g = clamp(max(c / 6.0 - 0.04, 0.0) * 1.4, 0.0, 1.0);
  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, 0.5, g));
  col = mix(col, uColor3, smoothstep(0.5, 1.0, g));
  fragColor = vec4(col * g, g);
}
`;

export default function InstitutionBackground({
  image,
  primaryColor = '#800016',
  accentColor = '#D9A300',
  lightColor = '#FFF8E2',
  mode = 'light',
  tint,
  sheen,
  sheenSpeed = 0.25,
  drift = true,
  parallax = true,
  parallaxAmount = 14,
  className = '',
  children,
}: InstitutionBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shiftRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const programRef = useRef<Program | null>(null);
  const speedRef = useRef(sheenSpeed);
  const initialPalette = useRef(sheenPalette(mode, primaryColor, accentColor, lightColor));
  const tintAmount = tint ?? (mode === 'light' ? 0.85 : 0.55);
  const sheenAmount = sheen ?? (mode === 'light' ? 0.28 : 0.45);
  const parallaxRef = useRef({ on: parallax, amount: parallaxAmount });

  useEffect(() => {
    speedRef.current = sheenSpeed;
    parallaxRef.current = { on: parallax, amount: parallaxAmount };
  }, [sheenSpeed, parallax, parallaxAmount]);

  useEffect(() => {
    const root = rootRef.current;
    const host = canvasHostRef.current;
    const shift = shiftRef.current;
    if (!root || !host || !shift) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('inst-bg--static');
      return;
    }

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      });
    } catch {
      return; // Photo + tint still render without WebGL.
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    host.appendChild(canvas);

    const palette = initialPalette.current;
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uColor1: { value: new Float32Array(palette[0]) },
        uColor2: { value: new Float32Array(palette[1]) },
        uColor3: { value: new Float32Array(palette[2]) },
      },
    });
    programRef.current = program;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const setSize = () => {
      const r = root.getBoundingClientRect();
      renderer.setSize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
      const res = program.uniforms.iResolution.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };
    const ro = new ResizeObserver(setSize);
    ro.observe(root);
    setSize();

    const target = [0.5, 0.5];
    const current = [0.5, 0.5];
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      target[0] = (e.clientX - r.left) / r.width;
      target[1] = 1 - (e.clientY - r.top) / r.height;
    };
    const onLeave = () => {
      target[0] = 0.5;
      target[1] = 0.5;
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let inView = true;
    let pageVisible = !document.hidden;
    let clock = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) * 0.001, 0.1);
      last = now;
      clock += dt * speedRef.current;
      program.uniforms.iTime.value = clock;

      current[0] += 0.05 * (target[0] - current[0]);
      current[1] += 0.05 * (target[1] - current[1]);
      const m = program.uniforms.uMouse.value as Float32Array;
      m[0] = current[0];
      m[1] = current[1];

      const { on, amount } = parallaxRef.current;
      const dx = on ? (0.5 - current[0]) * amount : 0;
      const dy = on ? (current[1] - 0.5) * amount : 0;
      shift.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;

      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (inView && pageVisible && raf === 0) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
      else stop();
    });
    io.observe(root);
    const onVis = () => {
      pageVisible = !document.hidden;
      if (pageVisible) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      programRef.current = null;
      try {
        host.removeChild(canvas);
      } catch {
        /* already removed */
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  // Live-update school colors without recreating the GL context.
  useEffect(() => {
    const p = programRef.current;
    if (!p) return;
    const [c1, c2, c3] = sheenPalette(mode, primaryColor, accentColor, lightColor);
    (p.uniforms.uColor1.value as Float32Array).set(c1);
    (p.uniforms.uColor2.value as Float32Array).set(c2);
    (p.uniforms.uColor3.value as Float32Array).set(c3);
  }, [mode, primaryColor, accentColor, lightColor]);

  return (
    <div
      ref={rootRef}
      className={`inst-bg inst-bg--${mode} ${drift ? 'inst-bg--drift' : ''} ${className}`.trim()}
      style={
        {
          '--inst-primary': primaryColor,
          '--inst-accent': accentColor,
          '--inst-light': lightColor,
          '--inst-tint': tintAmount,
          '--inst-sheen': sheenAmount,
          backgroundColor: mode === 'light' ? lightColor : primaryColor,
        } as React.CSSProperties
      }
    >
      <div ref={shiftRef} className="inst-bg__shift" aria-hidden="true">
        {image && (
          <div className="inst-bg__photo" style={{ backgroundImage: `url(${image})` }} />
        )}
      </div>
      <div className="inst-bg__tint" aria-hidden="true" />
      <div ref={canvasHostRef} className="inst-bg__sheen" aria-hidden="true" />
      <div className="inst-bg__shade" aria-hidden="true" />
      {children && <div className="inst-bg__content">{children}</div>}
    </div>
  );
}

import * as THREE from "three";
import type { WorldConfig } from "@otherside/shared";
import { PerlinNoise2D } from "./seeded-rng.js";

export interface SkyResult {
  update(dt: number): void;
  dispose(): void;
  sunDirection: THREE.Vector3;
}

type TimeOfDay = NonNullable<WorldConfig["timeOfDay"]>;

interface TimePreset {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hasMoon: boolean;
  hasStars: boolean;
}

const PRESETS: Record<TimeOfDay, TimePreset> = {
  dawn: {
    zenith: new THREE.Color(0x1a0533),
    horizon: new THREE.Color(0xff7b4f),
    sunDir: new THREE.Vector3(-0.8, 0.15, 0.2).normalize(),
    sunColor: new THREE.Color(0xffaa66),
    sunIntensity: 0.6,
    hasMoon: false,
    hasStars: false,
  },
  morning: {
    zenith: new THREE.Color(0x1e90ff),
    horizon: new THREE.Color(0xffe4b5),
    sunDir: new THREE.Vector3(-0.6, 0.5, 0.3).normalize(),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 0.8,
    hasMoon: false,
    hasStars: false,
  },
  noon: {
    zenith: new THREE.Color(0x4488ff),
    horizon: new THREE.Color(0x87ceeb),
    sunDir: new THREE.Vector3(0, 1, 0.1).normalize(),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.0,
    hasMoon: false,
    hasStars: false,
  },
  afternoon: {
    zenith: new THREE.Color(0x3377dd),
    horizon: new THREE.Color(0xffd700),
    sunDir: new THREE.Vector3(0.6, 0.5, -0.3).normalize(),
    sunColor: new THREE.Color(0xfff5dd),
    sunIntensity: 0.85,
    hasMoon: false,
    hasStars: false,
  },
  dusk: {
    zenith: new THREE.Color(0x1a0533),
    horizon: new THREE.Color(0xff4500),
    sunDir: new THREE.Vector3(0.8, 0.15, -0.2).normalize(),
    sunColor: new THREE.Color(0xff6633),
    sunIntensity: 0.5,
    hasMoon: false,
    hasStars: false,
  },
  night: {
    zenith: new THREE.Color(0x000011),
    horizon: new THREE.Color(0x0a0a2a),
    sunDir: new THREE.Vector3(0.3, 0.6, 0.2).normalize(), // moon pos
    sunColor: new THREE.Color(0x4466aa),
    sunIntensity: 0.15,
    hasMoon: true,
    hasStars: true,
  },
  midnight: {
    zenith: new THREE.Color(0x000005),
    horizon: new THREE.Color(0x0a0a15),
    sunDir: new THREE.Vector3(0, 0.9, 0.1).normalize(), // moon overhead
    sunColor: new THREE.Color(0x334477),
    sunIntensity: 0.1,
    hasMoon: true,
    hasStars: true,
  },
};

// ── Sky dome shader ──────────────────────────────────────────────────────

const skyVertexShader = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function makeSkyFragmentShader(preset: TimePreset): string {
  return /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform float uSunIntensity;
uniform float uHasMoon;
uniform float uHasStars;

varying vec3 vWorldPos;

// Simple hash for star field
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vWorldPos);
  float y = clamp(dir.y, 0.0, 1.0);

  // Sky gradient: horizon → zenith
  vec3 sky = mix(uHorizon, uZenith, pow(y, 0.6));

  // Sun disk with glow
  if (uSunIntensity > 0.3) {
    float sunDot = max(0.0, dot(dir, uSunDir));
    float sunDisk = smoothstep(0.995, 0.999, sunDot);
    float sunGlow = pow(sunDot, 32.0) * 0.3;
    vec3 sunCol = vec3(1.0, 0.95, 0.8);
    sky += sunCol * (sunDisk + sunGlow) * uSunIntensity;
  }

  // Moon disk
  if (uHasMoon > 0.5) {
    float moonDot = max(0.0, dot(dir, uSunDir));
    float moonDisk = smoothstep(0.997, 0.999, moonDot);
    sky += vec3(0.8, 0.85, 1.0) * moonDisk * 0.6;
  }

  // Stars
  if (uHasStars > 0.5 && y > 0.05) {
    vec2 starUV = dir.xz / (dir.y + 0.001) * 20.0;
    float star = hash(floor(starUV));
    if (star > 0.985) {
      float twinkle = 0.5 + 0.5 * sin(star * 1000.0);
      sky += vec3(twinkle * 0.5) * y;
    }
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;
}

// ── Cloud layer shader ───────────────────────────────────────────────────

const cloudVertexShader = /* glsl */ `
varying vec2 vUv;
varying float vY;
void main() {
  vUv = uv;
  vY = normalize((modelMatrix * vec4(position, 1.0)).xyz).y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const cloudFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uCloudOpacity;

varying vec2 vUv;
varying float vY;

// Simple 2D noise for clouds
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2D(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  if (vY < 0.02) discard;

  vec2 uv = vUv * 4.0 + vec2(uTime * 0.02, uTime * 0.005);
  float cloud = fbm(uv);
  cloud = smoothstep(0.35, 0.65, cloud);

  float alpha = cloud * uCloudOpacity * smoothstep(0.02, 0.2, vY);
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(vec3(1.0), alpha);
}
`;

// ── Build function ──────────────────────────────────────────────────────

export function buildProceduralSky(
  scene: THREE.Scene,
  worldConfig: WorldConfig,
  _terrainSize: { x: number; z: number },
): SkyResult | null {
  const timeOfDay = worldConfig.timeOfDay;
  if (!timeOfDay) return null;

  const preset = PRESETS[timeOfDay];

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: makeSkyFragmentShader(preset),
    uniforms: {
      uZenith: { value: preset.zenith },
      uHorizon: { value: preset.horizon },
      uSunDir: { value: preset.sunDir.clone() },
      uSunIntensity: { value: preset.sunIntensity },
      uHasMoon: { value: preset.hasMoon ? 1.0 : 0.0 },
      uHasStars: { value: preset.hasStars ? 1.0 : 0.0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  // Cloud layer
  const cloudGeo = new THREE.SphereGeometry(280, 32, 16);
  const isNight = timeOfDay === "night" || timeOfDay === "midnight";
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: cloudVertexShader,
    fragmentShader: cloudFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uCloudOpacity: { value: isNight ? 0.1 : 0.4 },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  scene.add(cloudMesh);

  // Override scene background with null (sky dome replaces it)
  scene.background = null;

  return {
    sunDirection: preset.sunDir.clone(),
    update(dt: number) {
      cloudMat.uniforms.uTime.value += dt;
    },
    dispose() {
      scene.remove(skyMesh);
      scene.remove(cloudMesh);
      skyGeo.dispose();
      skyMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
    },
  };
}

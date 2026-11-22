import {
  Color,
  type IUniform,
  ShaderMaterial,
  type Texture,
  UniformsLib,
  UniformsUtils,
  Vector3,
} from 'three';

/*
 * Holographic card surface — the 3D twin of the `.holo` layer on the home page's PokemonCard:
 * a pointer-tracked glare plus 115° foil stripes in the type colour, screen-blended over the
 * printed face. Here "the pointer" is the viewing angle: the camera direction projected onto the
 * card's own axes plays the role of the CSS `--px/--py`, so the foil slides as cards turn and the
 * camera moves, with a very slow time drift on top (frozen under reduced motion).
 *
 * The face is lit like print under a soft key light rather than PBR-shaded, so artwork and text
 * stay readable from every shot; the key light colour is shared with the scene's DirectionalLight.
 */

/** Uniforms every card shares, by reference — updating one value updates all cards. */
export type HoloShared = {
  uTime: IUniform<number>;
  uKeyColor: IUniform<Color>;
  /** World-space direction *towards* the key light (normalised). */
  uKeyDir: IUniform<Vector3>;
};

export function createHoloShared(): HoloShared {
  return {
    uTime: { value: 0 },
    uKeyColor: { value: new Color(1, 1, 1) },
    uKeyDir: { value: new Vector3(0.3, 0.8, 0.5).normalize() },
  };
}

type HoloUniforms = HoloShared & {
  uMap: IUniform<Texture>;
  uType: IUniform<Color>;
  uSheen: IUniform<number>;
  uPhase: IUniform<number>;
  uTint: IUniform<Color>;
  uTintAmount: IUniform<number>;
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal_;
  varying vec3 vTangent_;

  #include <common>
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    // Cards are only ever scaled uniformly, so the model matrix is safe for directions.
    vNormal_ = normalize(mat3(modelMatrix) * normal);
    vTangent_ = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uType;
  uniform vec3 uKeyColor;
  uniform vec3 uKeyDir;
  uniform float uTime;
  uniform float uSheen;
  uniform float uPhase;
  uniform vec3 uTint;
  uniform float uTintAmount;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal_;
  varying vec3 vTangent_;

  #include <common>
  #include <fog_pars_fragment>

  vec3 screen(vec3 base, vec3 blend) { return 1.0 - (1.0 - base) * (1.0 - blend); }

  void main() {
    vec3 albedo = texture2D(uMap, vUv).rgb;
    vec3 N = normalize(vNormal_);
    vec3 T = normalize(vTangent_);
    vec3 B = cross(N, T);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // Print under a soft key: mostly self-lit, gently modelled and tinted by the key light.
    float diffuse = max(dot(N, uKeyDir), 0.0);
    vec3 color = albedo * mix(vec3(1.0), uKeyColor, 0.14) * (0.86 + 0.2 * diffuse);

    // View direction in card space ~ the CSS pointer position (−1…1).
    vec2 tilt = vec2(dot(V, T), dot(V, B));
    float tilted = smoothstep(0.03, 0.4, length(tilt));

    // Glare: a soft white spot sliding against the tilt.
    vec2 glareCenter = 0.5 - tilt * vec2(1.1, 0.9);
    float glare = 1.0 - smoothstep(0.0, 0.62, distance(vUv * vec2(1.0, 1.4), glareCenter * vec2(1.0, 1.4)));

    // Foil: repeating 115° stripes that slide with the tilt and drift slowly over time.
    vec2 dir = vec2(cos(radians(115.0)), sin(radians(115.0)));
    float s = dot(vUv, dir) * 3.2 + tilt.x * 1.6 - tilt.y * 0.6 + uTime * 0.035 + uPhase;
    float f = fract(s);
    float stripe = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.12, 0.24, f));
    vec3 irid = 0.5 + 0.5 * cos(6.28318 * (s * 0.31 + vec3(0.0, 0.33, 0.67)));
    vec3 foilColor = mix(mix(uType, vec3(1.0), 0.45), irid, 0.22);

    // Foil reads strongest on the dark ground and stays light over bright artwork and text.
    float luma = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
    float amount = uSheen * (0.2 + 0.8 * tilted);
    color = screen(color, vec3(glare * 0.14 * amount));
    color = screen(color, foilColor * stripe * 0.11 * amount * (1.0 - 0.6 * luma));

    // Type-tinted fresnel lip at grazing angles.
    float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    color += uType * fresnel * 0.22 * uSheen;

    // Director-controlled tint (hit flash, KO dim, …).
    color = mix(color, uTint, uTintAmount);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export type HoloOptions = {
  map: Texture;
  /** Foil colour, `#rrggbb` (type colour on the face, side colour on the back). */
  color: string;
  shared: HoloShared;
  /** Per-card offset so neighbouring cards' stripes don't move in lockstep. */
  phase: number;
  /** Overall sheen strength, 0…1. */
  sheen?: number;
};

export class HoloMaterial extends ShaderMaterial {
  declare uniforms: HoloUniforms & Record<string, IUniform>;

  constructor({ map, color, shared, phase, sheen = 1 }: HoloOptions) {
    const uniforms: HoloUniforms & Record<string, IUniform> = {
      ...UniformsUtils.clone(UniformsLib.fog),
      ...shared, // by reference: shared across every card
      uMap: { value: map },
      uType: { value: new Color(color) },
      uSheen: { value: sheen },
      uPhase: { value: phase },
      uTint: { value: new Color(0, 0, 0) },
      uTintAmount: { value: 0 },
    };
    super({ uniforms, vertexShader, fragmentShader, fog: true });
    // Card art should keep the 2D card's colours; the rest of the scene is tone-mapped.
    this.toneMapped = false;
  }

  /** Blend the whole surface towards `color` (`intensity` 0 = off, 1 = solid). */
  setTint(color: string, intensity: number): void {
    this.uniforms.uTint.value.set(color);
    this.uniforms.uTintAmount.value = Math.min(1, Math.max(0, intensity));
  }
}

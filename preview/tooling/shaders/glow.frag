#version 330 core
// Godhuli Shop — "golden hour" glow for the hero banner

#define PI 3.14159265359
#define GLOW_SAMPLES 8
#define saturate(x) clamp(x, 0.0, 1.0)

precision highp float;

in vec2 vUv;
in vec3 vNormal;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity = 1.25;
uniform vec3  uSunColor = vec3(1.0, 0.62, 0.28);
uniform bool  uVignette;

const vec3 DUSK_TOP    = vec3(0.17, 0.11, 0.29);
const vec3 DUSK_BOTTOM = vec3(0.98, 0.55, 0.26);

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 duskGradient(float t) {
    return mix(DUSK_BOTTOM, DUSK_TOP, smoothstep(0.0, 1.0, t));
}

vec3 radialGlow(vec2 uv, vec2 center) {
    vec3 acc = vec3(0.0);
    vec2 texel = 1.0 / uResolution;
    for (int i = 0; i < GLOW_SAMPLES; ++i) {
        float a = float(i) / float(GLOW_SAMPLES) * 2.0 * PI;
        vec2 offset = vec2(cos(a), sin(a)) * texel * 4.0;
        acc += texture(uScene, uv + offset).rgb;
    }
    float d = length(uv - center);
    return acc / float(GLOW_SAMPLES) * exp(-d * 6.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec4 scene = texture(uScene, vUv);

    vec2 sun = vec2(0.5 + 0.1 * sin(uTime * 0.2), 0.35);
    vec3 glow = radialGlow(vUv, sun) * uSunColor * uIntensity;
    vec3 sky  = duskGradient(uv.y);

    vec3 color = scene.rgb * 0.8 + glow + sky.bgr * 0.05;
    color += (hash(uv * uTime) - 0.5) / 255.0; // dither to avoid banding

    if (uVignette) {
        float v = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.6;
        color *= saturate(v);
    }

    fragColor = vec4(pow(color, vec3(1.0 / 2.2)), scene.a);
}

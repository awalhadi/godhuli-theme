// Godhuli Shop — separable Gaussian blur for product thumbnails (WebGPU)

const TILE_SIZE: u32 = 128u;
const MAX_RADIUS: i32 = 16;

struct BlurParams {
    radius: i32,
    sigma: f32,
    direction: vec2<f32>, // (1, 0) horizontal, (0, 1) vertical
    tint: vec4<f32>,
}

struct Weights {
    values: array<f32, 33>,
}

@group(0) @binding(0) var input_tex: texture_2d<f32>;
@group(0) @binding(1) var output_tex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var linear_sampler: sampler;
@group(1) @binding(0) var<uniform> params: BlurParams;
@group(1) @binding(1) var<storage, read> weights: Weights;

var<workgroup> tile: array<vec4<f32>, TILE_SIZE>;

fn gaussian(x: f32, sigma: f32) -> f32 {
    let s2 = 2.0 * sigma * sigma;
    return exp(-(x * x) / s2) / sqrt(3.14159265 * s2);
}

fn load_clamped(coord: vec2<i32>, dims: vec2<i32>) -> vec4<f32> {
    let c = clamp(coord, vec2<i32>(0), dims - vec2<i32>(1));
    return textureLoad(input_tex, c, 0);
}

@compute @workgroup_size(128, 1, 1)
fn main(
    @builtin(global_invocation_id) gid: vec3<u32>,
    @builtin(local_invocation_index) lid: u32,
) {
    let dims = vec2<i32>(textureDimensions(input_tex));
    let pos = vec2<i32>(gid.xy);
    if (pos.x >= dims.x || pos.y >= dims.y) {
        return;
    }

    let radius = min(params.radius, MAX_RADIUS);
    let dir = vec2<i32>(params.direction);
    var sum = vec4<f32>(0.0);
    var total_weight = 0.0;

    for (var i: i32 = -radius; i <= radius; i = i + 1) {
        let w = weights.values[u32(i + MAX_RADIUS)];
        sum += load_clamped(pos + dir * i, dims) * w;
        total_weight += w;
    }

    tile[lid] = sum / max(total_weight, 1e-5);
    workgroupBarrier();

    let result = mix(tile[lid], params.tint, params.tint.a * 0.25);
    textureStore(output_tex, pos, vec4<f32>(result.rgb, 1.0));
}

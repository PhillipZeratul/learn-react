uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_b1_pos;
uniform float u_b1_radius;
uniform vec2 u_b2_pos;
uniform float u_b2_radius;
uniform sampler2D u_sceneTexture;

varying vec2 vUv;

// Polynomial smooth minimum
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float mapSDF(vec2 st) {
    float d1 = length(st - u_b1_pos) - u_b1_radius;
    float d2 = length(st - u_b2_pos) - u_b2_radius;
    return smin(d1, d2, 60.0);
}

vec3 blurBackground(vec2 uv, vec2 resolution) {
    vec3 result = vec3(0.0);
    float total = 0.0;
    float radius = 3.0;
    for (int x = -3; x <= 3; x++) {
        for (int y = -3; y <= 3; y++) {
            vec2 offset = vec2(float(x), float(y)) * 2.0 / resolution;
            float weight = exp(-(float(x * x + y * y)) / (2.0 * radius));
            result += texture2D(u_sceneTexture, uv + offset).rgb * weight;
            total += weight;
        }
    }
    return result / total;
}

void main() {
    vec2 st = vUv * u_resolution;
    float d = mapSDF(st);
    
    // Early return optimization for pixels outside the liquid
    if (d > 1.0) {
        gl_FragColor = texture2D(u_sceneTexture, vUv);
        return;
    }

    // Normal using finite difference (1 pixel eps)
    vec2 eps = vec2(1.0);
    vec2 normal = normalize(vec2(
        mapSDF(st + vec2(eps.x, 0.0)) - mapSDF(st - vec2(eps.x, 0.0)),
        mapSDF(st + vec2(0.0, eps.y)) - mapSDF(st - vec2(0.0, eps.y))
    ));

    float eta = 1.0 / 1.5; // Index of refraction

    // Edge contour refraction (from reference)
    float contourFalloff = exp(-abs(d) * 0.1); 
    vec2 domeNormalContour = normal * pow(contourFalloff, 1.5);
    vec2 refractVecContour = refract(vec2(0.0), domeNormalContour, eta);
    vec2 uvContour = vUv + refractVecContour * 0.35 * contourFalloff;
    
    // Center refraction
    vec2 centerRefract = vUv - normal * 0.03;
    
    // Blend based on distance from edge
    float edgeWeight = smoothstep(0.0, 15.0, abs(d));
    vec2 refractUV = mix(centerRefract, uvContour, edgeWeight);

    // Sample and apply frosted glass blur
    vec3 refracted = texture2D(u_sceneTexture, refractUV).rgb;
    vec3 blurred = blurBackground(refractUV, u_resolution);
    vec3 base = mix(refracted, blurred, 0.6);

    // Shadow (Top-down based on normal)
    float topShadow = smoothstep(1.0, -10.0, d) * max(0.0, normal.y);
    base = mix(base, vec3(0.0), topShadow * 0.15);

    // Edge glow
    float edge = 1.0 - smoothstep(0.0, 2.0, d * -1.0);
    vec3 glow = vec3(0.8, 0.9, 1.0);
    vec3 color = mix(base, glow, edge * 0.5);

    // Anti-aliasing edge blend
    float inside = smoothstep(1.0, 0.0, d);
    vec3 bgNormal = texture2D(u_sceneTexture, vUv).rgb;
    
    gl_FragColor = vec4(mix(bgNormal, color, inside), 1.0);
}

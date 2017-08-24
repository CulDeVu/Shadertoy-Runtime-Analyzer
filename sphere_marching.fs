
// distance functions
float dPoint(vec3 p)
{
    float ret;
    ret = length(p);
    return ret;
}

float dPlane(vec3 p, vec3 norm)
{
    float ret;
    ret = dot(-p, norm);
    
    return ret;
}

float dSphere(vec3 p, float rad)
{
    float ret;
    float len = length(p);
    ret = len - rad;
    return ret;
}

float dCylinder(vec3 p, vec3 dir, float rad)
{
    float ret;
    vec3 closest = p - dir * dot(p, dir);
    float lenClosest = length(closest);
    
    ret = lenClosest - rad;
    
    return ret;
}

// main functions
mat3 sphereAnim;

vec2 rMax(vec2 r1, vec2 r2)
{
    if (r1.x < r2.x)
        return r1;
    return r2;
}

vec2 findNearest(vec3 o)
{
    vec2 ret;
    
    ret = vec2(dPlane(vec3(0, -2, 0) - o, vec3(0, 1, 0)), 0.0);
    ret = rMax(ret, vec2(dPlane(vec3(-9, 0, 0) - o, vec3(1, 0, 0)), 0));
    ret = rMax(ret, vec2(dPlane(vec3(9, 0, 0) - o, vec3(-1, 0, 0)), 0));
    ret = rMax(ret, vec2(dPlane(vec3(0, 0, -9) - o, vec3(0, 0, 1)), 0));
    ret = rMax(ret, vec2(dPlane(vec3(0, 0, 9) - o, vec3(0, 0, -1)), 0));
    
    ret = rMax(ret, vec2(dSphere(vec3(0, -1, 0) - o, 1.0), 2));
    //ret = rMax(ret, vec2(fTruncatedOctahedron(vec3(0, -1, 0) - o, 1.), 2));
    ret = rMax(ret, vec2(dSphere(sphereAnim * vec3(2.3, -1, 0) - o, 0.25), 2));
    ret = rMax(ret, vec2(dSphere(sphereAnim * vec3(-2.3, -1, 0) - o, 0.25), 2));
    ret = rMax(ret, vec2(dSphere(sphereAnim * vec3(0, -1, 2.3) - o, 0.25), 2));
    ret = rMax(ret, vec2(dSphere(sphereAnim * vec3(0, -1, -2.3) - o, 0.25), 2));
    
    ret = rMax(ret, vec2(dCylinder(vec3(2, 0, 0) - o, vec3(0, 1, 0), 1.0), 1));
    
    ret.x = max(0.0, ret.x);
    
    //return ret;
    return ret;
}

vec3 calcNormal(vec3 pos)
{
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
        findNearest(pos+eps.xyy).x - findNearest(pos-eps.xyy).x,
        findNearest(pos+eps.yxy).x - findNearest(pos-eps.yxy).x,
        findNearest(pos+eps.yyx).x - findNearest(pos-eps.yyx).x);
    return normalize(nor);
}

vec2 calcUV(vec3 pos, vec3 norm)
{
    vec3 temp = pos / 5.0;
    vec3 temp2 = vec3(1, 0, 0);
    
    if (abs(dot(temp2, norm)) > 0.99)
        temp2 = vec3(0, 1, 0);
    
    vec3 tang = cross(norm, temp2);
    vec3 bivec = cross(norm, tang);
    
    return vec2(dot(temp, tang), dot(temp, bivec));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{   
    vec2 uv = fragCoord.xy / iResolution.y;
    vec3 pxlLoc = 2.0 * vec3(uv, 0) - vec3(iResolution.x / iResolution.y, 1, 0);
    vec3 origin = vec3(0, 0, 2);
    
    float mouseX = iMouse.x / iResolution.x;
    
    // camera animation
    {
        float angle = 2.0 * 3.14159 * mouseX; //0.5 * iTime;
        mat3 rot = mat3(cos(angle), 0, -sin(angle),
                        0, 1, 0,
                        sin(angle), 0, cos(angle));
        pxlLoc = rot * pxlLoc;
        origin = rot * origin;
   
        //vec3 animOffset = vec3(4.0 * cos(iTime), 0, 4.0 * sin(iTime));
        vec3 animOffset = rot * vec3(0, 0, 5.0);
        origin += animOffset;
        pxlLoc += animOffset;
    }
    
    // sphere animation
    {
        float angle = 1.9 * iTime;
        sphereAnim = mat3(cos(-angle), 0, -sin(-angle),
                          0, 1, 0,
                          sin(-angle), 0, cos(-angle));
    }
    
    //------------------------------
    // Ray tracing
    //------------------------------
    vec3 ray = normalize(pxlLoc - origin);
    vec2 t;
    for (int i = 0; i < 32; ++i)
    {
        t = findNearest(origin);
        origin += t.x * ray;
    }
    
    // didn't hit anything
    if (t.x > 10.0)
    {
        fragColor = vec4(0, 0, 0, 1);
        return;
    }
    
    vec3 intersect = origin;
    vec3 norm = calcNormal(intersect);
    vec2 uvCoord = calcUV(intersect, norm);
    
    //------------------------------
    // Lighting
    //------------------------------
    float ambient = 1.0;
    vec3 albedo;
    
    if (-0.5 < t.y && t.y < 0.5)
    {
        albedo = vec3(texture(iChannel0, uvCoord));
    }
    else if (0.5 < t.y && t.y < 1.5)
    {
        albedo = vec3(texture(iChannel1, uvCoord));
    }
    else if (1.5 < t.y && t.y < 2.5)
    {
        albedo = vec3(texture(iChannel2, uvCoord));
    }
    
    // direct lighting
    vec3 lightPos = vec3(2, 2, -5);
    float flux = 9.0;
    
    vec3 rToLight = lightPos - intersect;
    float dToLight = length(rToLight);
    float directLight = flux * max(0.0, dot(rToLight, norm)) / (dToLight * dToLight);
    
    // shadow casting
    float largestTolerance = 0.25;
    float smallestDist = largestTolerance;
    vec3 sray = normalize(lightPos - intersect);
    vec3 sorigin = intersect + sray * largestTolerance / max(0.001, dot(norm, sray));
    for (int i = 0; i < 20; ++i)
    {
        t = findNearest(sorigin);
        
        float d = clamp(t.x, 0.0, dToLight - dot(sray, sorigin + t.x * sray - intersect));
        sorigin += d * sray;
        
        smallestDist = min(smallestDist, t.x);
    }
    
    float penumbra = clamp(smallestDist / largestTolerance, 0.0, 1.0);
    directLight *= penumbra;
    
    // AO
    vec3 aoOrigin = intersect + 0.05 * norm;
    vec3 aoRay = norm;
    for (int i = 0; i < 4; ++i)
    {
        t = findNearest(aoOrigin);
        aoOrigin += t.x * aoRay;
    }
    
    float dist = max(0.0, min(0.4, dot(norm, aoOrigin - intersect)));
    float ao = pow(dist / 0.4, 0.5);
    
    float ambientLight = ambient * ao;
    
    // final lighting
    float irrad = directLight + ambientLight;
    vec3 d = albedo * irrad;
    d.xyz = d.xyz / (d.xyz + 1.0);
    
    fragColor = vec4(d.x, d.y, d.z, 1.0);
}
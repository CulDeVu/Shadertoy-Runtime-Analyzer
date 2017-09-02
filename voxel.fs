#define PI 3.14159 

// Plane-Ray intersection
float fp(vec3 p, vec3 r, vec3 n)
{
    if (dot(n, r) < 0.001)
        return -1.;
    return dot(n, p) / dot(n, r);
}

// Ulities
void pR(inout vec2 p, float a) {
	p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}
float sgn(int a)
{
    return (a > 0) ? 1. : -1.;
}
float sgn(float a)
{
    return (a > 0.) ? 1. : -1.;
}
int isgn(int a)
{
    return int(sgn(a));
}
void round1(inout vec3 r)
{
    r.xyz = floor(r.xyz + 0.5);
}

// Determines which cells are solid based on their centers
bool isSolid(vec3 center)
{
    if (center.y <= 0.)
        return true;
    if (length(center) < 8.)
        return true;
    if (abs(center.z) < 2. && abs(length(center.xy) - 20.) < 5.)
        return true;
    
    return false;
}

//---------------------------------------------------
// Intersection and tracing code
//---------------------------------------------------
const vec3 Fv[7] = vec3[](
    vec3(1, 0, 0),
    vec3(0, 1, 0),
    vec3(0, 0, 1),

    vec3(1, 1, 1 ) / 2.,
    vec3(-1, 1, 1) / 2.,
    vec3(1, -1, 1) / 2.,
    vec3(1, 1, -1) / 2.
);

// This just tests against a bunch of planes
// Side note: the planes defined by the Mercury SDF library
// are incorrect
float truncOctInner(vec3 p, vec3 ray, out int best_norm)
{
    float best_d = 1000.0;
    best_norm = 0;
    
    vec3 offset, n;
    float d;
    
    for (int i = 0; i < 7; ++i)
    {
        offset = Fv[i];
        n = normalize(offset);
        d = fp(p + offset, ray, n);
        if (d < best_d && d > 0.)
        {
            best_d = d;
            best_norm = i + 1;
        }
        
        offset = -Fv[i];
        n = normalize(offset);
        d = fp(p + offset, ray, n);
        if (d < best_d && d > 0.)
        {
            best_d = d;
            best_norm = -i - 1;
        }
    }
    
    return best_d;
}

/* this is an improved findCenter function (much better than the more
   brute-force previous version)
   here's how it works:
     the square faces oriented along the axes are of unit length, and the
     hexagonal faces are oriented at (+-1, +-1, +-1)/2. Since the centers 
     of neighboring cells are reflections of the current one across the
     cooresponding plane, the separations are just permutations of (+-2, 0, 0)
     and (+-1, +-1, +-1).
  
     So, the end result of all of this is that every cell center (x,y,z) must 
     obey parity(x) = parity(y) = parity(z). Also, every integer triplet that
     obeys this is also a center of a cell in this tesselation. So, all that's
     left to do is to find the closest point to the point given which obeys this
     property.
*/
vec3 findCenter(vec3 o)
{
    vec3 p = o;
    vec3 tempSign = sign(p.xyz);
    p = abs(p.xyz);
    p = tempSign.xyz * floor(p.xyz + 0.5);
    
    vec3 parity = abs(mod(p.xyz, 2.0));
    
    if (abs(dot(parity, parity) - 1.5) > 1.0) // they all have the same parity
    {
        return p;
    }
    
    // if not, then it must be the case that 2 of them have the same parity (pidgeonhole principle)
    // so just add or subtract one to the last one to achieve that parity, whichever one is closer
    
    if (abs(parity.x - parity.y) < 0.5)
    {
        p.z += sgn(o.z - p.z);
        return p;
    }
    if (abs(parity.x - parity.z) < 0.5)
    {
        p.y += sgn(o.y - p.y);
        return p;
    }
    if (abs(parity.y - parity.z) < 0.5)
    {
        p.x += sgn(o.x - p.x);
        return p;
    }
    
    // this shouldn't be possible
    return vec3(0,0,0);
}

// This is just a modification of cube marching
float traceTruncOct(vec3 o, vec3 ray, out vec3 norm, out vec3 center, int depth)
{
    center = findCenter(o);
    
    norm = vec3(0);
    float d = 0.;
    vec3 p = center - o;
    
    int normId;
    
    // keeps track of the total distance traveled
    float totalD = 0.;
    
    for (int i = 0; i < depth; ++i)
    {
        d = truncOctInner(p, ray, normId);
        o = o + ray * d;
        center += float(sign(normId)) * 2. * Fv[abs(normId) - 1];
        {
            vec3 p = center;
            vec3 tempSign = sign(p.xyz);
            p = abs(p.xyz);
            p = tempSign.xyz * floor(p.xyz + 0.5);
            //center = p;
        }
        p = center - o;
        
        totalD += d;
        
        if (isSolid(center))
        {
            norm = -float(sign(normId)) * normalize(Fv[abs(normId) - 1]);
            return totalD;
        }
    }
    
    return -1.;
}

// Okay, so this AO isn't at all as clever as the solution
// I had originally planned. In fact, this is kinda gross.
// It looks ugly and broken and someone should really fix it.
// Don't use this unless there's no other option.
float aoDist(vec3 o, vec3 center, vec3 norm)
{
    vec3 trash;
    
    float best = 0.;
    vec3 r;
    
    for (int i = 0; i < 7; ++i)
    {
        vec3 p = normalize(Fv[i]);
        vec3 q = p - norm * dot(norm, p);
        
        if (dot(o - center, q) > best && dot(norm, p) < 0.95 && dot(norm, p) > 0.05)
        {
            r = q;
            best = dot(o - center, q);
        }
        
        q = -q;
        if (dot(o - center, q) > best && dot(norm, p) < 0.95 && dot(norm, p) > 0.05)
        {
            r = q;
            best = dot(o - center, q);
        }
    }
    
    return traceTruncOct(o, normalize(r), trash, trash, 1);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.y - vec2(iResolution.x/iResolution.y/2., 0.5);
    float mouseU = 2. * (iMouse.x / iResolution.x - 0.5);
    vec3 trash;
    
    vec3 cam = vec3(0,8,20);
    vec3 screenPos = vec3(uv, -0.5);
    
    pR(cam.xz, mouseU * 2. * PI);
    pR(screenPos.xz, mouseU * 2. * PI);
    
    vec3 ray = normalize(screenPos);
    
    vec3 norm, center;
    float d = traceTruncOct(cam, ray, norm, center, 80);
    vec3 pt = cam + ray * d;
    center = findCenter(cam + d * ray);
    
    if (d < 0.)
    {
        fragColor = vec4(0);
        return;
    }
    
    //--------------------------------------------------
    // Lighting Time!
    //--------------------------------------------------
    float ambient = 0.15;
    /*float ao = aoDist(pt, center, norm);
    if (ao < 0.0)
        ao = 5.0;
    if (ao/3. < 0.1)
        ambient = ao/3. + 0.05;*/
    
    // Lighting
    vec3 light = 10. * vec3(sin(iTime), 1, cos(iTime));
    vec3 lightDir = pt - light;
    float lightIntensity = 10.0;
    
    // These shadows look really ugly.
    // I'm not all that knowledged about how cube marching people do shadows,
    // but it's probably *not* something like this... oh well.
    // If you have any suggestions, please tell me!
    /*float lightDist = traceTruncOct(light, normalize(lightDir), trash, trash, 40);
    float shadow = 0.;
    if (abs(lightDist - length(lightDir)) < 0.2)
        shadow = 1.;*/
    float shadow = 1.;
    
    // Yeah, that's right, I used linear falloff. Sue me.
    fragColor = 0.5 * shadow * lightIntensity * vec4(dot(norm, -normalize(lightDir) )) / length(lightDir);
    fragColor += vec4(ambient) + 0.5 * vec4(abs(dot(norm, -normalize(lightDir)) )) / length(lightDir);
    //fragColor = vec4(ao/(ao + 1.));
}
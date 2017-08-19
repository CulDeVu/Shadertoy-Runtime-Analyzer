void mainImage( out vec4 fragColor, in vec2 fragCoord )
{   
    vec3 v = vec3(0);
    for (int i = 0; i < 50; ++i)
    {
        v += vec3(fragCoord.y / iResolution.y, -0.1, 1);
    }
    
    fragColor = vec4(v.x, v.y, v.z, 7.0);
}
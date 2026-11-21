var Eo=Object.defineProperty;var Uo=(i,t,c)=>t in i?Eo(i,t,{enumerable:!0,configurable:!0,writable:!0,value:c}):i[t]=c;var j=(i,t,c)=>Uo(i,typeof t!="symbol"?t+"":t,c);import{V as ko,P as Bo,C as eo,S as lo,A as xo,a as B,b as Go,M as uo,B as Ao,F as Z,G as Vo,U as Ho,c as Yo,D as No}from"./three-C67S78sf.js";import{c as po}from"./index-ClH_CGZG.js";import{G as _,n as bo}from"./index-CgD0KN5K.js";import{g as to}from"./gsap-hCjQcbYY.js";import{H as so,C as no,a as vo,b as Ko,S as zo,s as $o,c as jo,k as Xo}from"./BattleStage-Bg77jEyp.js";import"./BattlePage-BCDCT9Gj.js";const Lo={fire:"fire",dragon:"fire",water:"water",ice:"water",electric:"electric",grass:"nature",bug:"nature",psychic:"mystic",fairy:"mystic",ghost:"mystic",fighting:"impact",normal:"impact",rock:"impact",ground:"impact",steel:"impact",typeless:"impact",poison:"toxic",dark:"toxic",flying:"air"},qo=i=>Lo[i]??"impact",Wo={fire:0,water:1,electric:2,nature:3,mystic:4,impact:5,toxic:6,air:7},J=.62,fo={full:{travel:.36,burst:.45},short:{travel:.24,burst:.3}},Co=128,Jo=3,Qo=`
  attribute vec4 aRand;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform vec3 uColor;
  uniform float uProgress;
  uniform float uFamily;
  uniform float uDensity;
  uniform float uSize;
  uniform float uViewport;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;

  const float HIT = ${J.toFixed(3)};

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }

  void main() {
    vec3 dir = uTo - uFrom;
    float len = max(length(dir), 1e-3);
    vec3 fwd = dir / len;
    vec3 side = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(side, fwd);

    float travel = clamp(uProgress / HIT, 0.0, 1.0);
    float burst = clamp((uProgress - HIT) / (1.0 - HIT), 0.0, 1.0);
    bool isBurst = aRand.w < 0.42;
    float f = uFamily;

    vec3 pos = uTo;
    float alpha = 0.0;
    float size = 1.0;
    float core = 0.0;
    vec3 color = uColor;

    if (!isBurst) {
      // Travel: each particle trails the head by its own lag; the arc lifts mid-flight.
      float lag = aRand.x * 0.55;
      float t = clamp(travel * 1.55 - lag, 0.0, 1.0);
      float alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
      float lift = 0.35;
      vec3 offset = vec3(0.0);

      if (f < 0.5) {            // fire — embers that drift upward and cool as they trail
        lift = 0.55;
        offset = (side * (aRand.y - 0.5) + up * (aRand.z - 0.5)) * 0.32 + up * lag * 0.5;
        size = mix(1.9, 0.7, lag / 0.55);
        color = mix(vec3(1.0, 0.92, 0.7), uColor, smoothstep(0.0, 0.35, lag));
        core = 0.6;
      } else if (f < 1.5) {     // water — a rolling ribbon
        lift = 0.3;
        offset = up * sin(t * 11.0 + aRand.y * 6.2832) * 0.22 + side * (aRand.z - 0.5) * 0.5;
        color = mix(uColor, vec3(1.0), 0.35 * aRand.y);
        size = 1.15;
      } else if (f < 2.5) {     // electric — a jagged arc that grows from attacker to target
        lift = 0.12;
        t = aRand.x;
        float head = clamp(travel * 1.3, 0.0, 1.0);
        alive = step(t, head) * (1.0 - burst);
        float epoch = floor(uProgress * 2.0) * 13.1; // re-routes once per shot: far below 3 Hz
        float seg = floor(t * 13.0);
        float fr = fract(t * 13.0);
        float n1 = mix(hash(seg + epoch), hash(seg + 1.0 + epoch), fr);
        float n2 = mix(hash(seg + 31.0 + epoch), hash(seg + 32.0 + epoch), fr);
        float env = sin(3.14159 * t);
        offset = (side * (n1 - 0.5) * 1.1 + up * (n2 - 0.5) * 0.8) * env + (aRand.yzy - 0.5) * 0.04;
        size = 0.55;
        color = mix(uColor, vec3(1.0), 0.45);
        core = 1.0;
      } else if (f < 3.5) {     // nature — leaves on a helix
        lift = 0.5;
        float a = t * 13.0 + aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.18 + 0.2 * aRand.z);
        size = 1.0;
        color = mix(uColor, vec3(0.92, 1.0, 0.75), 0.25 * aRand.z);
      } else if (f < 4.5) {     // mystic — rings travelling along the path
        lift = 0.4;
        float ring = floor(aRand.x * 4.0);
        t = clamp(travel * 1.35 - ring * 0.12, 0.0, 1.0);
        alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
        float a = aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.22 + 0.28 * t);
        size = 0.7;
        color = mix(uColor, vec3(1.0), 0.3);
        core = 0.4;
      } else if (f < 5.5) {     // impact — a tight, accelerating cluster
        lift = 0.1;
        t = clamp(travel * travel * 1.25 - lag * 0.3, 0.0, 1.0);
        alive = step(0.001, t) * step(t, 0.999) * (1.0 - burst);
        offset = (side * (aRand.y - 0.5) + up * (aRand.z - 0.5)) * 0.2;
        size = 1.0;
        color = mix(uColor, vec3(1.0), 0.5);
        core = 0.5;
      } else if (f < 6.5) {     // toxic — slow, wobbling blobs
        lift = 0.7;
        offset = up * sin(t * 9.0 + aRand.y * 20.0) * 0.18 + side * (aRand.z - 0.5) * 0.45;
        size = 2.1 * (0.6 + 0.4 * aRand.z);
        color = uColor * 0.9;
      } else {                  // air — thin streaks spiralling in a gust
        lift = 0.25;
        float a = t * 8.0 + aRand.y * 6.2832;
        offset = (side * cos(a) + up * sin(a)) * (0.5 * (1.0 - t) + 0.12);
        size = 0.6;
        color = mix(uColor, vec3(1.0), 0.55);
      }

      pos = mix(uFrom, uTo, t) + vec3(0.0, sin(3.14159 * t) * lift, 0.0) + offset;
      alpha = alive * 0.85;
    } else {
      // Burst at the target: a family-specific spray, fading out as it expands.
      float b = clamp(burst * (1.0 + aRand.x * 0.25), 0.0, 1.0);
      float e = easeOut(b);
      vec3 rnd = normalize(vec3(aRand.y - 0.5, aRand.z - 0.5, aRand.x - 0.5) + 1e-4);
      float a = aRand.y * 6.2832;
      vec3 ring = side * cos(a) + up * sin(a);
      vec3 offset;

      if (f < 0.5) {            // fire — flare outward, embers rise
        offset = rnd * 1.3 * e + vec3(0.0, 0.7 * b, 0.0);
        size = 1.6 * (1.0 - 0.6 * b);
        color = mix(vec3(1.0, 0.9, 0.65), uColor, b);
        core = 0.5;
      } else if (f < 1.5) {     // water — a splash of droplets that fall back
        offset = vec3(rnd.x * 1.1, abs(rnd.y) * 1.6, rnd.z * 0.6) * e - vec3(0.0, 2.2 * b * b, 0.0);
        size = 0.9;
        color = mix(uColor, vec3(1.0), 0.4);
      } else if (f < 2.5) {     // electric — fast radial sparks
        offset = rnd * 1.6 * e;
        size = 0.5;
        color = mix(uColor, vec3(1.0), 0.5);
        core = 1.0;
      } else if (f < 3.5) {     // nature — petals drifting out and down
        offset = rnd * 1.0 * e - vec3(0.0, 0.5 * b, 0.0) + side * sin(b * 6.0 + aRand.z * 6.0) * 0.12;
        size = 1.0;
      } else if (f < 4.5) {     // mystic — an expanding ring
        offset = ring * (0.25 + 1.3 * e);
        size = 0.75;
        color = mix(uColor, vec3(1.0), 0.3);
        core = 0.4;
      } else if (f < 5.5) {     // impact — shockwave ring plus dust
        offset = aRand.z < 0.6 ? ring * (0.2 + 1.7 * e) : rnd * 0.8 * e;
        size = aRand.z < 0.6 ? 0.8 : 1.3;
        color = mix(uColor, vec3(1.0), 0.45);
        core = 0.4;
      } else if (f < 6.5) {     // toxic — bubbles rising and thinning out
        offset = rnd * 0.6 * e + vec3(0.0, 1.1 * b, 0.0) + side * sin(b * 8.0 + aRand.z * 9.0) * 0.1;
        size = 1.6 * (0.5 + aRand.z) * (1.0 - 0.4 * b);
        color = uColor * 0.95;
      } else {                  // air — a swirl
        float sa = a + b * 3.5;
        offset = (side * cos(sa) + up * sin(sa)) * (0.35 + 0.9 * e);
        size = 0.6;
        color = mix(uColor, vec3(1.0), 0.5);
      }

      pos = uTo + offset;
      alpha = step(0.001, burst) * pow(1.0 - b, 1.5) * 0.9;
    }

    // Short tier: fewer particles (the rest collapse to nothing).
    float keep = step(fract(aRand.x * 7.13 + aRand.y * 3.71), uDensity);
    alpha *= keep;

    vec4 mv = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = uSize * size * (0.7 + 0.6 * aRand.z) * projectionMatrix[1][1] * 0.5 * uViewport / max(-mv.z, 0.1);
    gl_PointSize = alpha > 0.0 ? clamp(px, 0.0, 96.0) : 0.0;
    vColor = color;
    vAlpha = alpha;
    vCore = core;
  }
`,Zo=`
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCore;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float disc = 1.0 - smoothstep(0.0, 1.0, d);
    float hot = 1.0 - smoothstep(0.0, 0.4, d);
    vec3 color = mix(vColor, vec3(1.0), hot * vCore * 0.7);
    gl_FragColor = vec4(color * disc * disc * vAlpha, 1.0);
  }
`,Io=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,ot=`
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(uColor * g * g * uStrength, 1.0);
  }
`;class tt{constructor(t,c,d,l,m,h){j(this,"value",0);j(this,"emitter",null);this.pool=t,this.family=c,this.from=d,this.to=l,this.color=m,this.tier=h}get progress(){return this.value}set progress(t){if(this.value=t,t<=0||t>=1){this.emitter&&this.pool.release(this.emitter,this),this.emitter=null;return}this.emitter??(this.emitter=this.pool.acquire(this)),this.emitter&&this.pool.render(this.emitter,this,t)}evict(){this.emitter=null}}class et{constructor(t){j(this,"scene");j(this,"emitters",[]);j(this,"geometry");j(this,"glowGeometry");j(this,"drawingBuffer",new ko);j(this,"next",0);this.scene=t,this.geometry=st(),this.glowGeometry=new Bo(1,1),this.glowGeometry.rotateX(-Math.PI/2);for(let c=0;c<Jo;c++){const d={uFrom:{value:new B},uTo:{value:new B},uColor:{value:new eo},uProgress:{value:0},uFamily:{value:0},uDensity:{value:1},uSize:{value:.2},uViewport:{value:800}},l=new lo({uniforms:d,vertexShader:Qo,fragmentShader:Zo,transparent:!0,depthWrite:!1,blending:xo});l.toneMapped=!1;const m=new Go(this.geometry,l);m.name=`fx-${c}`,m.frustumCulled=!1,m.visible=!1,m.renderOrder=5,m.onBeforeRender=b=>{d.uViewport.value=b.getDrawingBufferSize(this.drawingBuffer).y};const h={uColor:{value:new eo},uStrength:{value:0}},C=new lo({uniforms:h,vertexShader:Io,fragmentShader:ot,transparent:!0,depthWrite:!1,blending:xo});C.toneMapped=!1;const x=new uo(this.glowGeometry,C);x.name=`fx-glow-${c}`,x.visible=!1,x.renderOrder=-1,this.emitters.push({points:m,uniforms:d,glow:x,glowUniforms:h,owner:null}),t.add(m,x)}}shot(t,c,d,l,m){return new tt(this,t,c,d,l,m)}play(t,c,d,l,m){const h=this.shot(t,c,d,l,m),{travel:C,burst:x}=fo[m];return to.timeline().to(h,{progress:J,duration:C,ease:"none"}).to(h,{progress:1,duration:x,ease:"none"})}reset(){var t;for(const c of this.emitters)(t=c.owner)==null||t.evict(),c.owner=null,c.points.visible=!1,c.glow.visible=!1}dispose(){for(const t of this.emitters)this.scene.remove(t.points,t.glow),t.points.material.dispose(),t.glow.material.dispose();this.emitters.length=0,this.geometry.dispose(),this.glowGeometry.dispose()}acquire(t){var m;const d=this.emitters.find(h=>h.owner===null)??this.emitters[this.next++%this.emitters.length];if(!d)return null;(m=d.owner)==null||m.evict(),d.owner=t;const l=d.uniforms;return l.uFrom.value.copy(t.from),l.uTo.value.copy(t.to),l.uColor.value.set(t.color),l.uFamily.value=Wo[t.family],l.uDensity.value=t.tier==="short"?.55:1,l.uSize.value=t.tier==="short"?.16:.2,d.glowUniforms.uColor.value.set(t.color),d.points.visible=!0,d.glow.visible=!0,d}release(t,c){t.owner===c&&(t.owner=null,t.points.visible=!1,t.glow.visible=!1,t.uniforms.uProgress.value=0)}render(t,c,d){if(t.owner!==c)return;t.uniforms.uProgress.value=d;const{uFrom:l,uTo:m}=t.uniforms,h=Math.min(1,d/J),C=Math.max(0,(d-J)/(1-J)),x=Math.min(1,h*1.2);t.glow.position.set(l.value.x+(m.value.x-l.value.x)*x,.015,l.value.z+(m.value.z-l.value.z)*x);const b=3.2+C*1.6;t.glow.scale.set(b,1,b);const z=Math.min(1,h*2.5);t.glowUniforms.uStrength.value=C>0?.5*(1-C)**1.4:.22+.28*z*h}}function st(){const i=po(24301),t=new Float32Array(Co*4);for(let d=0;d<t.length;d++)t[d]=i();const c=new Ao;return c.setAttribute("position",new Z(new Float32Array(Co*3),3)),c.setAttribute("aRand",new Z(t,4)),c}const nt=.22;function it(i,t,c){let d=null;const l=c*.7;for(let m=1;m<=c;m++){const h=m*t/i;for(const C of new Set([Math.max(1,Math.floor(h)),Math.max(1,Math.ceil(h))])){const x=m*C;if(x>c||x*2<c)continue;const b=Math.abs(x-l)-x*1e-6;(!d||b<d.score)&&(d={cols:m,rows:C,score:b})}}return d??{cols:1,rows:Math.ceil(c/2)}}function Ro(i,t,c){const d=[],l=[],m=[];let h=0,C=0,x=0;for(const[z,D,M]of i){if(!z||!D||!M)continue;for(const w of[z,D,M])d.push(w.x,w.y,0),l.push(0,0,1),m.push(w.x/t+.5,w.y/c+.5);const F=((D.x-z.x)*(M.y-z.y)-(D.y-z.y)*(M.x-z.x))/2;h+=(z.x+D.x+M.x)/3*F,C+=(z.y+D.y+M.y)/3*F,x+=F}const b=new Ao;return b.setAttribute("position",new Z(d,3)),b.setAttribute("normal",new Z(l,3)),b.setAttribute("uv",new Z(m,2)),b.userData.centroid={x:h/x,y:C/x},b}function rt(i,t,c,d){const l=Math.max(1,Math.floor(c)),m=po(d),{cols:h,rows:C}=it(i,t,l),x=i/h,b=t/C,z=()=>(m()*2-1)*nt,D=[];for(let R=0;R<=C;R++){const k=[];for(let T=0;T<=h;T++){const S=T===0||T===h,H=R===0||R===C;k.push({x:-i/2+(T+(S?0:z()))*x,y:-t/2+(R+(H?0:z()))*b})}D.push(k)}const M=(R,k)=>{var T;return((T=D[k])==null?void 0:T[R])??{x:0,y:0}},F=Array.from({length:h*C},(R,k)=>k);for(let R=F.length-1;R>0;R--){const k=Math.floor(m()*(R+1));[F[R],F[k]]=[F[k]??0,F[R]??0]}const w=new Set(F.slice(0,l-h*C)),O=[];for(let R=0;R<C;R++)for(let k=0;k<h;k++){const T=M(k,R),S=M(k+1,R),H=M(k+1,R+1),G=M(k,R+1);if(w.has(R*h+k)){const L=m()<.5?[[T,S,H],[T,H,G]]:[[T,S,G],[S,H,G]];for(const I of L)O.push(Ro([I],i,t))}else O.push(Ro([[T,S,H],[T,H,G]],i,t))}return O}const at=24,ct="#07080b",So=i=>[...i].reduce((t,c)=>Math.imul(t^c.charCodeAt(0),16777619)>>>0,2166136261);class lt{constructor(t,c){j(this,"sets",new Map);this.scene=t,this.keyColor=c}get(t){const c=t.fighter.id,d=this.sets.get(c);if((d==null?void 0:d.handle)===t)return d;d&&this.release(d);const l=ut(t,this.keyColor);return this.scene.add(l.group),this.sets.set(c,l),l}resetAll(){for(const t of this.sets.values())t.group.visible=!1,To(t)}dispose(){for(const t of this.sets.values())this.release(t);this.sets.clear()}release(t){this.scene.remove(t.group);for(const c of t.meshes)c.geometry.dispose();t.material.dispose(),this.sets.delete(t.handle.fighter.id)}}function To(i){i.meshes.forEach((t,c)=>{const d=i.base[c];d&&t.position.copy(d),t.rotation.set(0,0,0)}),i.uniforms.uOpacity.value=1}function ut(i,t){const c=i.fighter.id,d=i.face.material,l=i.group.getObjectByName("back"),m=l instanceof uo?l.material:null,h=d instanceof so?d.uniforms.uMap.value:null,C=m instanceof so?m.uniforms.uMap.value:h,{material:x,uniforms:b}=ft(h,C,t),z=new Vo;z.name=`${c}-shards`,z.visible=!1;const D=[],M=rt(vo,no,at,So(c)).map(F=>{const w=F.userData.centroid;F.translate(-w.x,-w.y,0);const O=new uo(F,x);return O.position.set(w.x,w.y,0),D.push(new B(w.x,w.y,0)),z.add(O),O});return{handle:i,group:z,meshes:M,base:D,uniforms:b,material:x,seed:So(c)}}function ft(i,t,c){const d={...Ho.clone(Yo.fog),uFace:{value:i},uBack:{value:t},uKey:{value:c},uDimColor:{value:new eo(ct)},uDim:{value:0},uOpacity:{value:1},uSize:{value:new ko(vo,no)},uRadius:{value:Ko}},l=new lo({uniforms:d,fog:!0,transparent:!0,side:No,vertexShader:`
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      uniform sampler2D uFace;
      uniform sampler2D uBack;
      uniform vec3 uKey;
      uniform vec3 uDimColor;
      uniform float uDim;
      uniform float uOpacity;
      uniform vec2 uSize;
      uniform float uRadius;
      varying vec2 vUv;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        vec2 p = (vUv - 0.5) * uSize;
        vec2 q = abs(p) - (uSize * 0.5 - uRadius);
        if (length(max(q, 0.0)) - uRadius > 0.0) discard; // rounded card corners
        vec3 albedo = gl_FrontFacing
          ? texture2D(uFace, vUv).rgb
          : texture2D(uBack, vec2(1.0 - vUv.x, vUv.y)).rgb;
        vec3 color = albedo * mix(vec3(1.0), uKey, 0.14) * 0.95;
        color = mix(color, uDimColor, uDim);
        gl_FragColor = vec4(color, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `});return l.toneMapped=!1,{material:l,uniforms:d}}const E="#07080b",q=Math.PI*2,pt=350,dt=new B(0,1,0),U={intro:2,dealIn:.9,anticipate:.4,lunge:{full:.5,short:.3},impact:{full:.6,short:.4},knockOut:1.2,victory:2.6},V={beat:.3,exchange:.2,impact:.25};function At(i,t){const c=t.reducedMotion,d=t.now??(()=>performance.now()),l=i.camera,m=new et(i.scene),h=new lt(i.scene,i.lights.key.color);let C=Number.NEGATIVE_INFINITY;const x=new Map,b=new Map;let z=null;const D=()=>{b.clear();for(const o of i.fighters)b.set(o.id,{id:o.id,side:o.side,slot:o.slot,status:o.slot===0?"deck":"bench"})},M=o=>{b.size===0&&D();const e=b.get(o);if(!e)throw new Error(`StageDirector: unknown fighter "${o}"`);return e},F=o=>[...b.values()].filter(e=>e.side===o&&(e.status==="bench"||e.status==="deck")).sort((e,n)=>e.slot-n.slot),w=o=>to.timeline().to({},{duration:o},0),O=o=>o==="red"?1:-1,R=o=>bo(o.type==="typeless"?void 0:o.type),k=o=>bo(i.card(o).fighter.types[0]),T=(o,e,n)=>{let s=e-o;return s=((s+Math.PI)%q+q)%q-Math.PI,Math.abs(s)>Math.PI/2&&(s=n==="red"?s>0?s-q:s:s<0?s+q:s),o+s},S=(o,e,n=!1)=>{const s=i.slotFor(o,e,n);if(!s)throw new Error(`StageDirector: unknown fighter "${o}"`);return s},H=o=>{if(o.slot===0){const e=S(o.id,{bench:0},!0);return e.position.z+=.16,e.position.x-=O(o.side)*.12,e}return S(o.id,{bench:o.slot-1},!0)},G=(o,e,n,s,p)=>{const{group:r,fighter:a}=i.card(e);let u=null;const v=()=>u??(u=n());o.to(r.position,{x:()=>v().position.x,y:()=>v().position.y,z:()=>v().position.z,...s},p),o.to(r.rotation,{x:0,z:0,y:()=>T(r.rotation.y,v().rotationY,a.side),...s},p)},L=(o,e)=>{const{group:n}=i.card(o);n.position.copy(e.position),n.rotation.set(0,e.rotationY,0)},I=(o,e,n)=>{o.call(()=>{const s=i.home(e);s&&L(e,s)},[],n)},io=o=>{let e=x.get(o);return e||x.set(o,e={color:"#ffffff",amount:0}),e},Y=(o,e,n,s,p,r,a)=>{const u=io(e),v=()=>i.card(e).setTint(u.color,u.amount);o.to(u,{amount:s,duration:p,ease:r,onStart:()=>{u.color=n,v()},onUpdate:v},a)},ro=(o,e,n)=>{const s=io(o);s.color=e,s.amount=n,i.card(o).setTint(e,n)},Fo=to.parseEase("power2.out"),Do=to.parseEase("sine.inOut"),Q=(o,e,n,s,p,r,a)=>{const u=io(e),v={v:0};let f=!1;const y=g=>{u.amount=g,i.card(e).setTint(u.color,g)};o.to(v,{v:p+r,duration:p+r,ease:"none",onStart:()=>{const g=d();f=g-C>=pt,f&&(C=g,u.color=n)},onUpdate:()=>{f&&y(v.v<p?s*Fo(v.v/p):s*(1-Do((v.v-p)/r)))},onComplete:()=>{f&&y(0)}},a)},oo=(o,e,n,s,p)=>{const r=Xo(e,n,new eo);o.to(i.lights.key.color,{r:r.r,g:r.g,b:r.b,duration:s,ease:"sine.inOut"},p)},ao=(o,e,n,s,p)=>{const r=i.card(e).face.material;if(!(r instanceof so))return;const a=r.uniforms.uSheen;o.to(a,{value:n,duration:s*.45,ease:"sine.out"},p),o.to(a,{value:1,duration:s*.55,ease:"sine.inOut"},p+s*.45)},mo=(o,e,n,s,p,r)=>{const a={v:0};o.to(a,{v:1,duration:s,ease:"none",onUpdate:()=>{const u=(1-a.v)**2*e;r(Math.sin(a.v*q*n)*u,Math.sin(a.v*q*n*1.3+1.1)*u*.55)},onComplete:()=>r(0,0)},p)},ho=(o,e,n,s)=>mo(o,e,5,n,s,(p,r)=>l.shake.set(p,r,0)),yo=(o,e,n,s,p)=>{const r=i.pivot(e);mo(o,n,4,s,p,(a,u)=>{r.position.x=a,r.rotation.y=u*.6})},Oo=(o,e,n)=>({position:o.position.lerp(e.position,n),target:o.target.lerp(e.target,n)}),go=(o,e)=>()=>Oo(l.shot("wide"),l.shot(o),e),W=(o,e,n,s,p,r)=>{const a=new B,u=new B;let v=null;const f={v:0};o.to(f,{v:1,duration:n,ease:s,onStart:()=>{l.held=null,a.copy(l.position),u.copy(l.target),v=e()},onUpdate:()=>{v&&(l.position.lerpVectors(a,v.position,f.v),l.target.lerpVectors(u,v.target,f.v))},onComplete:()=>{r&&l.cut(r.name,r.orbit??0)}},p)},Po=()=>{const o=l.shot("wide",-.42);return o.position.sub(o.target).multiplyScalar(1.3).add(o.target),o.position.y+=2.2,o},N=o=>{if(!z)return;const{shot:e}=z;z=null,e&&o.to(e,{progress:1,duration:.2,ease:"none"},0)},wo=()=>{m.reset(),l.shake.set(0,0,0),i.setKeyTint("#ffffff",0),h.resetAll();for(const o of b.values()){const e=i.card(o.id);e.group.visible=!0,e.group.scale.setScalar(1);const n=i.pivot(o.id);n.position.x=0,n.position.z=0,n.rotation.x=0,n.rotation.y=0;const s=e.face.material;s instanceof so&&(s.uniforms.uSheen.value=1),ro(o.id,E,0),i.setRole(o.id,o.slot===0?null:{bench:o.slot-1},!0),L(o.id,H(o))}};return{intro:()=>{D(),z=null;const o=[...b.values()];if(c){const n=w(V.beat);n.call(()=>{wo(),l.cut("wide");for(const s of o)ro(s.id,E,1)},[],0);for(const s of o)Y(n,s.id,E,0,V.beat,"sine.out",0);return n}const e=w(U.intro);e.call(()=>{wo();for(const s of o){const{group:p}=i.card(s.id);p.position.x+=-O(s.side)*7,p.position.z-=3}const n=Po();l.held=null,l.position.copy(n.position),l.target.copy(n.target)},[],0),W(e,()=>l.shot("wide"),U.intro,"power2.inOut",0,{name:"wide"});for(const n of o){const s=(3-Math.min(n.slot,3))*.09;G(e,n.id,()=>H(n),{duration:1.15,ease:_.outExpo},.3+s)}return e},dealIn:o=>{const e=M(o),n=e.status==="active";e.status="active";const s=F(e.side),p=k(o);if(c){const a=w(V.beat);return N(a),Y(a,o,E,1,.12,"sine.in",0),a.call(()=>{i.setRole(o,"active"),L(o,S(o,"active")),s.forEach((u,v)=>{i.setRole(u.id,{bench:v},!0),L(u.id,S(u.id,{bench:v},!0))}),i.setKeyTint(p,.3)},[],.12),Y(a,o,E,0,.18,"sine.out",.12),a}const r=w(U.dealIn);if(N(r),!n){const{group:a}=i.card(o),u=()=>S(o,"active");let v=null;const f=()=>v??(v=u());r.call(()=>i.setRole(o,null),[],0),r.to(a.position,{x:()=>f().position.x,z:()=>f().position.z,duration:.78,ease:"power3.inOut"},0),r.to(a.position,{y:()=>f().position.y+1.25,duration:.36,ease:"power2.out"},0),r.to(a.position,{y:()=>f().position.y,duration:.44,ease:_.spring},.36),r.to(a.rotation,{y:()=>T(a.rotation.y,f().rotationY,e.side),duration:.56,ease:"power2.inOut"},.1),r.to(a.rotation,{x:-.18,z:O(e.side)*-.05,duration:.3,ease:"power2.out"},0),r.to(a.rotation,{x:0,z:0,duration:.45,ease:_.standard},.33),r.call(()=>i.setRole(o,"active"),[],.8),I(r,o,.8),ao(r,o,1.7,.5,.4)}return s.forEach((a,u)=>{r.call(()=>i.setRole(a.id,{bench:u},!0),[],0),G(r,a.id,()=>S(a.id,{bench:u},!0),{duration:.55,ease:_.standard},.25),I(r,a.id,.8)}),oo(r,p,.3,.6,.3),W(r,()=>l.shot("wide"),.8,"power2.inOut",0,{name:"wide"}),r},anticipate:(o,e,n)=>{const s=M(o),p=R(e);if(c){const g=w(V.exchange);return N(g),oo(g,p,.4,V.exchange,0),g}const r=n==="full"?U.anticipate:U.anticipate/2,a=w(r);N(a);const{group:u}=i.card(o),v=O(s.side);let f=null;const y=()=>f??(f=S(o,"active"));return a.to(u.position,{x:()=>y().position.x-v*.3,y:()=>y().position.y+.14,z:()=>y().position.z-.12,duration:r,ease:_.standard},0),a.to(u.rotation,{x:-.12,z:v*.07,duration:r,ease:_.standard},0),oo(a,p,.42,r,0),ao(a,o,1.6,r,0),n==="full"&&W(a,go(s.side==="red"?"redClose":"blueClose",.3),r,"power2.out",0),a},lunge:(o,e,n,s)=>{const p=M(o),r=R(n);if(c){const $=w(V.exchange);return N($),Y($,o,r,.22,.1,"sine.out",0),Y($,o,r,0,.1,"sine.in",.1),z={attackerId:o,shot:null,tier:s},$}const a=U.lunge[s],u=w(a);N(u);const{group:v}=i.card(o),f=O(p.side);let y=null;const g=()=>y??(y=S(o,"active")),X=new B,A=new B;u.call(()=>{Mo(S(o,"active"),.3,X).y+=.1,Mo(S(e,"active"),.25,A)},[],0);const P=m.shot(qo(n.type),X,A,r,s),K=fo[s].travel;return u.to(P,{progress:J,duration:K,ease:"none"},a-K),s==="full"?(u.to(v.position,{x:()=>g().position.x+f*1,y:()=>g().position.y-.04,z:()=>g().position.z+.3,duration:.22,ease:"power2.in"},0),u.to(v.rotation,{x:.1,z:-f*.03,duration:.22,ease:"power2.in"},0),u.to(v.position,{x:()=>g().position.x+f*1.1,duration:a-.22,ease:"power1.out"},.22),W(u,go("impact",.55),a,"power2.inOut",0)):(u.to(v.position,{x:()=>g().position.x+f*.45,z:()=>g().position.z+.15,duration:.14,ease:"power2.out"},0),u.to(v.rotation,{x:.05,z:0,duration:.14,ease:"power2.out"},0)),z={attackerId:o,shot:P,tier:s},u},impact:(o,e,n,s)=>{const p=z;z=null;const r=M(o),a=-O(r.side);if(c){const A=w(V.impact);return e==="hit"&&Q(A,o,E,.3,.1,.15,0),A}const u=U.impact[s],v=w(u);if(p!=null&&p.shot&&v.to(p.shot,{progress:1,duration:fo[s].burst,ease:"none"},0),p){const A=s==="full"?.5:.32;G(v,p.attackerId,()=>S(p.attackerId,"active"),{duration:A,ease:_.standard},.04)}const{group:f}=i.card(o);let y=null;const g=()=>y??(y=S(o,"active")),X=()=>S(o,"active");if(e==="hit"&&n){const A=n.effectiveness,P=A>1||n.critical,K=(.12+.1*Math.min(A,2))*(n.critical?1.2:1);v.to(f.position,{x:()=>g().position.x+a*K,z:()=>g().position.z-.08,duration:.1,ease:_.standard},0),v.to(f.rotation,{y:()=>g().rotationY+a*.12,z:-a*.05,duration:.1,ease:_.standard},0),G(v,o,X,{duration:u-.12,ease:_.spring},.1);const $=Math.min(.12,.02+.0225*A)+(n.critical?.02:0);if(yo(v,o,$,Math.min(.34,u-.04),0),P){Q(v,o,"#ffffff",.55,.05,.32,0);const co=(A>=4?.09:A>1?.06:0)+(n.critical?.04:0);ho(v,co,.32,0)}else A<1?Q(v,o,E,.25,.06,.3,0):Q(v,o,"#fff3e0",.16,.06,.28,0)}else e==="miss"?(v.to(f.position,{x:()=>g().position.x+a*.15,z:()=>g().position.z+.45,duration:.16,ease:"power2.out"},0),v.to(f.rotation,{z:a*.05,duration:.16,ease:"power2.out"},0),G(v,o,X,{duration:u-.2,ease:_.standard},.18)):Q(v,o,"#9aa4b8",.15,.08,.3,0);return s==="full"&&W(v,()=>l.shot("wide"),u-.05,"power2.inOut",.05,{name:"wide"}),v},knockOut:o=>{const e=M(o);if(e.status="out",c){const u=w(V.beat);return N(u),Y(u,o,E,1,V.beat,"sine.in",0),u.call(()=>{i.setRole(o,null),i.card(o).group.visible=!1},[],V.beat),u}const n=w(U.knockOut);N(n);const s=h.get(i.card(o)),{group:p}=i.card(o),r=.18;Y(n,o,E,.35,r,"sine.in",0),yo(n,o,.03,r,0),ho(n,.05,.3,r),n.call(()=>{i.setRole(o,null),p.visible=!1,s.group.position.copy(p.position),s.group.rotation.set(0,p.rotation.y,0),To(s),s.uniforms.uDim.value=.35,s.group.visible=!0},[],r);const a=po(s.seed^2654435769);return s.meshes.forEach((u,v)=>{const f=s.base[v]??new B,y=Math.hypot(f.x,f.y)||1,g=f.x+f.x/y*.06,X=f.y+f.y/y*.06,A=a()*.1+(f.y/no+.5)*.04,P=.45+a()*.1,K=r+.12+A,$=()=>-s.group.position.y+.012+v*6e-4,co=a()<.7,_o=.05+a()*.03;n.to(u.position,{x:g,y:X,z:(a()-.5)*.06,duration:.12,ease:"power2.out"},r),n.to(u.position,{y:$,duration:P,ease:"power2.in"},K),n.to(u.position,{x:g*1.25+(a()-.5)*.8,z:.3+a()*.9,duration:P+.18,ease:"power1.out"},K),n.to(u.rotation,{x:(co?-1:1)*Math.PI/2+(a()-.5)*.1,z:(a()-.5)*3,duration:P,ease:"power1.in"},K),n.to(u.position,{y:()=>$()+_o,duration:.09,ease:"power2.out"},K+P),n.to(u.position,{y:$,duration:.09,ease:"power2.in"},K+P+.09)}),n.to(s.uniforms.uOpacity,{value:0,duration:.32,ease:"sine.in"},U.knockOut-.32),n.call(()=>{s.group.visible=!1},[],U.knockOut),n},victory:o=>{const e=[...b.values()].filter(f=>f.side===o&&f.status!=="out").sort((f,y)=>f.status==="active"?-1:y.status==="active"?1:f.slot-y.slot),n=[...b.values()].filter(f=>f.side!==o&&f.status!=="out"),s=f=>{const y=e.length,g=i.aspectRatio,X=2*$o("blue","active",g).x+vo*1.3,A=Math.min(2.9,X/Math.max(1,y-1)),P=f-(y-1)/2;return{position:new B(P*A,no/2+jo+.5,.4-Math.abs(P)*.35),rotationY:.38-P*.06}};if(c){const f=w(V.beat);N(f);for(const y of e)Y(f,y.id,E,1,.12,"sine.in",0);f.call(()=>{e.forEach((y,g)=>{i.setRole(y.id,null),L(y.id,s(g))});for(const y of n)ro(y.id,E,.5);i.setKeyTint(zo[o],.35),l.cut("victory")},[],.12);for(const y of e)Y(f,y.id,E,0,.18,"sine.out",.12);return f}const p=w(U.victory);N(p),e.forEach((f,y)=>{p.call(()=>i.setRole(f.id,null),[],0),G(p,f.id,()=>s(y),{duration:1.1,ease:_.outExpo},.15+y*.1),ao(p,f.id,1.6,.8,.9+y*.1)});for(const f of n){Y(p,f.id,E,.5,.6,"sine.inOut",.2);const{group:y}=i.card(f.id);p.to(y.position,{z:`-=${.6}`,duration:1,ease:_.standard},.2)}oo(p,zo[o],.35,1,0);const r=.38;W(p,()=>l.shot("victory"),1.1,"power2.inOut",0);const a={v:0},u=new B,v=new B;return p.to(a,{v:r,duration:U.victory-1.1,ease:"sine.inOut",onStart:()=>{const f=l.shot("victory");u.copy(f.target),v.subVectors(f.position,f.target)},onUpdate:()=>{l.position.copy(v).applyAxisAngle(dt,a.v).add(u),l.target.copy(u)},onComplete:()=>l.cut("victory",r)},1.1),p},dispose(){m.dispose(),h.dispose()}}}function Mo(i,t,c){return c.set(Math.sin(i.rotationY),0,Math.cos(i.rotationY)).multiplyScalar(t).add(i.position)}export{pt as FLASH_GAP_MS,At as createStageDirector};

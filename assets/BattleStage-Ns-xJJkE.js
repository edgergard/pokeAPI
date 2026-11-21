var ve=Object.defineProperty;var we=(s,t,e)=>t in s?ve(s,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):s[t]=e;var c=(s,t,e)=>we(s,typeof t!="symbol"?t+"":t,e);import{a as m,d as y,e as ye,C as S,S as O,U as oe,c as se,P as xe,f as be,M as k,G as j,g as Se,h as Te,B as Ce,F as X,i as Me,j as Re,k as ne,l as Pe,m as ke,W as _e,N as Ae,H as Le,n as K,o as Ee,b as De}from"./three-C67S78sf.js";import{h as B,q as $e,f as q}from"./index-DVVJYJLu.js";import"./gsap-hCjQcbYY.js";const M=2.5,T=3.5,U=.035,ie=.18,ae=.28,re=s=>y.clamp((s-.6)/(1.6-.6),0,1),D=y.lerp;function N(s,t,e){const o=re(e),n=s==="red"?-1:1,i=D(1.75,2.4,o),a=T/2+ae;if(t==="active")return new m(n*i,a,0);const r=t.bench,l=i+D(.95,2.3,o)+r*D(.7,1.35,o),u=-D(2.8,1.9,o)-r*D(1.7,1.35,o);return new m(n*l,a,u)}function Ne(s,t){return(s==="red"?1:-1)*(t==="active"?.22:.32)}const F=38,Ie=.1,We=120,J=new m,Be=new m(0,1,0),ze=new m;function Q(s,t,e,o=1.08){const n=Math.tan(y.degToRad(F/2));return Math.max(t/n,s/(n*e))*o}function Ke(s,t,e,o=1.06){const n=Math.tan(y.degToRad(F/2)),i=n*s,a=[N("blue","active",s),N("blue",{bench:2},s)],r=Math.max(...a.map(u=>(u.x+M/2)*o/i-(t.z-u.z))),l=T*.95/n*o;return Math.max(r,l)/Math.cos(e)}function I(s,t){return new m(Math.sin(s)*Math.cos(t),Math.sin(t),Math.cos(s)*Math.cos(t))}class le{constructor(t,e){c(this,"camera",new ye(F,16/9,Ie,We));c(this,"position",new m);c(this,"target",new m);c(this,"drift");c(this,"held",null);c(this,"shake",new m);c(this,"aspect",16/9);this.drift=e.reducedMotion?0:1,this.setAspect(t),this.cut("wide")}setAspect(t){!Number.isFinite(t)||t<=0||(this.aspect=t,this.camera.aspect=t,this.camera.updateProjectionMatrix(),this.held&&this.cut(this.held.name,this.held.orbit))}get wideDistance(){const{position:t,target:e}=this.shot("wide");return t.distanceTo(e)}shot(t,e=0){const o=this.aspect,n=1-re(o);let i;switch(t){case"wide":{const a=new m(0,y.lerp(1.9,2.3,n),y.lerp(-1.3,-2.2,n)),r=y.degToRad(y.lerp(13,24,n)),l=Ke(o,a,r);i={target:a,position:a.clone().addScaledVector(I(0,r),l)};break}case"redClose":case"blueClose":{const a=t==="redClose"?"red":"blue",r=a==="red"?-1:1,l=N(a,"active",o).add(new m(r*.25,.1,0)),u=I(-r*y.degToRad(34),y.degToRad(8)),g=Q(M*1.05,T*.62,o);i={target:l,position:l.clone().addScaledVector(u,g)};break}case"impact":{const a=N("blue","active",o).x+M*.75,r=new m(0,T*.62,0),l=Q(a,T*.75,o,1.02);i={target:r,position:r.clone().addScaledVector(I(0,y.degToRad(-3)),l)};break}case"victory":{const a=this.shot("wide"),r=new m(0,T*.7,-.8),l=a.position.distanceTo(a.target)*.78,u=I(y.degToRad(28),y.degToRad(20));i={target:r,position:r.clone().addScaledVector(u,l)};break}}return e!==0&&(J.subVectors(i.position,i.target).applyAxisAngle(Be,e),i.position.copy(i.target).add(J)),i}cut(t,e=0){const{position:o,target:n}=this.shot(t,e);this.position.copy(o),this.target.copy(n),this.held={name:t,orbit:e}}update(t){const e=this.drift,o=this.shake;this.camera.position.set(this.position.x+o.x+Math.sin(t*.11)*.16*e,this.position.y+o.y+Math.sin(t*.17+1.3)*.07*e,this.position.z+o.z+Math.sin(t*.07+.4)*.12*e),this.camera.lookAt(ze.addVectors(this.target,o))}}function Ge(){return{uTime:{value:0},uKeyColor:{value:new S(1,1,1)},uKeyDir:{value:new m(.3,.8,.5).normalize()}}}const Ue=`
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
`,Ve=`
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
`;class Z extends O{constructor({map:t,color:e,shared:o,phase:n,sheen:i=1}){const a={...oe.clone(se.fog),...o,uMap:{value:t},uType:{value:new S(e)},uSheen:{value:i},uPhase:{value:n},uTint:{value:new S(0,0,0)},uTintAmount:{value:0}};super({uniforms:a,vertexShader:Ue,fragmentShader:Ve,fog:!0}),this.toneMapped=!1}setTint(t,e){this.uniforms.uTint.value.set(t),this.uniforms.uTintAmount.value=Math.min(1,Math.max(0,e))}}const ce=8;function Oe(){const s=M/2,t=T/2,e=ie,o=new Te;return o.moveTo(-s+e,-t),o.lineTo(s-e,-t),o.quadraticCurveTo(s,-t,s,-t+e),o.lineTo(s,t-e),o.quadraticCurveTo(s,t,s-e,t),o.lineTo(-s+e,t),o.quadraticCurveTo(-s,t,-s,t-e),o.lineTo(-s,-t+e),o.quadraticCurveTo(-s,-t,-s+e,-t),o}function Fe(s){const t=new Me(s,ce),e=t.getAttribute("position"),o=t.getAttribute("uv");for(let n=0;n<o.count;n++)o.setXY(n,e.getX(n)/M+.5,e.getY(n)/T+.5);return o.needsUpdate=!0,t}function He(s){const t=s.getPoints(ce),e=U/2,o=[],n=[];for(let a=0;a<t.length;a++){const r=t[a],l=t[(a+1)%t.length];if(!r||!l)continue;const u=l.x-r.x,g=l.y-r.y,w=Math.hypot(u,g);if(w<1e-6)continue;const f=g/w,x=-u/w;o.push(r.x,r.y,-e,l.x,l.y,-e,l.x,l.y,e,r.x,r.y,-e,l.x,l.y,e,r.x,r.y,e);for(let v=0;v<6;v++)n.push(f,x,0)}const i=new Ce;return i.setAttribute("position",new X(o,3)),i.setAttribute("normal",new X(n,3)),i}function Ye(){const s=Oe(),t=new xe(M*1.5,M*.9);return t.rotateX(-Math.PI/2),{face:Fe(s),edge:He(s),shadow:t}}function je(s,t,e,o,n){const i=B(s.types[0]),a=s.slot*.37+(s.side==="red"?0:.19),r=new Z({map:e.face,color:i,shared:n,phase:a}),l=new Z({map:e.back,color:o,shared:n,phase:a,sheen:.6}),u=new be({color:new S(i).multiplyScalar(.55),emissive:new S(i),emissiveIntensity:.18,metalness:.45,roughness:.38}),g=new k(t.face,r);g.position.z=U/2,g.name="face";const w=new k(t.face,l);w.position.z=-U/2,w.rotation.y=Math.PI,w.name="back";const f=new k(t.edge,u);f.name="edge";const x=new j;x.add(g,w,f);const v=new j;v.name=s.id,v.add(x);const b=new k(t.shadow,new Se({map:e.shadow,color:0,transparent:!0,depthWrite:!1,opacity:.7}));return b.name=`${s.id}-shadow`,b.renderOrder=-1,{handle:{group:v,face:g,fighter:s,setTint(H,Y){r.setTint(H,Y),l.setTint(H,Y)}},pivot:x,shadow:b}}const d=320,h=Math.round(d*T/M),E=2,V=ie/M*d,p=256,Xe="#07080b",de="#0f1117",qe="#151821",ue="#818a9e",ee="#ffd23f",P={red:"#ff7a66",blue:"#5eb0ff"},z='"Bricolage Grotesque", Inter, ui-sans-serif, sans-serif',he="Inter, ui-sans-serif, system-ui, sans-serif",C='"JetBrains Mono", ui-monospace, monospace';async function Je(s,t){if(!s)return null;try{return await t(s)}catch{return null}}const G=new Map;function Qe(s,t=4e3){const e=G.get(s);if(e)return e;const o=new Image;o.crossOrigin="anonymous",o.decoding="async",o.src=s;let n;const i=new Promise((r,l)=>{n=setTimeout(()=>{if(o.complete&&o.naturalWidth>0)return r(o);o.src="",l(new Error(`Artwork timed out: ${s}`))},t)}),a=Promise.race([o.decode().then(()=>o),i]).finally(()=>clearTimeout(n));return a.catch(()=>G.delete(s)),G.set(s,a),a}async function Ze(s=1500){if(typeof document>"u"||!("fonts"in document))return;const t=[`800 26px ${z}`,`600 10px ${he}`,`700 12px ${C}`,`500 10px ${C}`],e=Promise.all(t.map(o=>document.fonts.load(o))).then(()=>{},()=>{});await Promise.race([e,new Promise(o=>setTimeout(o,s))])}function fe(){const s=document.createElement("canvas");s.width=d*E,s.height=h*E;const t=s.getContext("2d");if(!t)throw new Error("2D canvas unavailable");return t.scale(E,E),[s,t]}function _(s,t,e,o,n,i){s.beginPath(),s.roundRect(t,e,o,n,i)}function R(s,t){"letterSpacing"in s&&(s.letterSpacing=`${t}px`)}function A(s,t){const e=Number.parseInt(s.slice(1),16);return`rgba(${e>>16&255}, ${e>>8&255}, ${e&255}, ${t})`}function et(s,t,e,o,n){for(let i=o/2;i<e;i+=o){s.fillStyle=n(i);for(let a=o/2;a<t;a+=o)s.fillRect(a-.5,i-.5,1,1)}}function tt(s,t,e,o,n,i){let a=o;for(s.font=`${e} ${a}px ${n}`;a>12&&s.measureText(t).width>i;)a-=1,s.font=`${e} ${a}px ${n}`}function ot(s,t,e){const o=s.createRadialGradient(d/2,p,0,d/2,p,d*.85);o.addColorStop(0,A(t,.42)),o.addColorStop(.65,A(t,0)),s.fillStyle=o,s.fillRect(0,0,d,p),et(s,d,p,12,i=>`rgba(255, 255, 255, ${.1*i/p})`),s.save(),s.translate(d/2,p*.92),s.scale(1,.18);const n=s.createRadialGradient(0,0,0,0,0,d*.26);if(n.addColorStop(0,"rgba(0, 0, 0, 0.55)"),n.addColorStop(1,"rgba(0, 0, 0, 0)"),s.fillStyle=n,s.fillRect(-d/2,-d/2,d,d),s.restore(),e&&e.naturalWidth>0){const i=p*.86,a=Math.min(i/e.naturalWidth,i/e.naturalHeight),r=e.naturalWidth*a,l=e.naturalHeight*a;s.save(),s.shadowColor="rgba(0, 0, 0, 0.45)",s.shadowBlur=22*E,s.shadowOffsetY=16*E,s.drawImage(e,(d-r)/2,(p-l)/2+6,r,l),s.restore()}else s.fillStyle="rgba(255, 255, 255, 0.2)",s.font=`700 96px ${z}`,s.textAlign="center",s.textBaseline="middle",s.fillText("?",d/2,p/2+4),s.textAlign="start",s.textBaseline="alphabetic"}function st(s,t,e,o,n){s.font=`500 10px ${C}`,s.fillStyle=ue,s.fillText(e,20,t+4);const i=58,a=206;_(s,i,t-1.5,a,4,2),s.fillStyle="rgba(255, 255, 255, 0.07)",s.fill(),_(s,i,t-1.5,Math.max(4,a*Math.min(1,o/220)),4,2),s.fillStyle=n,s.fill(),s.font=`700 11px ${C}`,s.fillStyle="#e7e9ef",s.textAlign="right",s.fillText(String(o),d-20,t+4),s.textAlign="start"}function nt(s,t){const[e,o]=fe(),n=B(s.types[0]),i=o.createLinearGradient(0,0,0,h);i.addColorStop(0,de),i.addColorStop(1,qe),o.fillStyle=i,o.fillRect(0,0,d,h),ot(o,n,t),o.font=`700 12px ${C}`,o.fillStyle="rgba(255, 255, 255, 0.72)",o.fillText($e(s.pokemonId),18,28);const a=`${s.side.toUpperCase()} · ${s.slot+1}`;o.font=`700 10px ${C}`,R(o,1.5),o.textAlign="right",o.fillText(a,d-18,27);const r=o.measureText(a).width;o.textAlign="start",R(o,0),o.beginPath(),o.arc(d-18-r-8,23.5,3,0,Math.PI*2),o.fillStyle=P[s.side],o.fill(),o.fillStyle="rgba(255, 255, 255, 0.06)",o.fillRect(0,p,d,1),o.fillStyle="#ffffff",tt(o,q(s.name),800,27,z,d-40),o.fillText(q(s.name),20,p+38);let l=20;o.font=`600 10px ${he}`,R(o,.8);for(const x of s.types){const v=B(x),b=x.toUpperCase(),L=o.measureText(b).width+30;_(o,l,p+52,L,20,10),o.fillStyle=A(v,.13),o.fill(),o.strokeStyle=A(v,.4),o.lineWidth=1,o.stroke(),o.beginPath(),o.arc(l+11,p+62,2.5,0,Math.PI*2),o.fillStyle=v,o.fill(),o.fillText(b,l+19,p+65.5),l+=L+6}R(o,0);const{hp:u,attack:g,defense:w,speed:f}=s.stats;return[["HP",u],["ATK",g],["DEF",w],["SPD",f]].forEach(([x,v],b)=>{st(o,p+96+b*19,String(x),Number(v),n)}),o.font=`500 9px ${C}`,R(o,1.6),o.fillStyle=ue,o.fillText("LV 50",20,h-16),o.textAlign="right",o.fillText("TRAINER STUDIO",d-20,h-16),o.textAlign="start",R(o,0),_(o,1,1,d-2,h-2,V-1),o.strokeStyle="rgba(255, 255, 255, 0.1)",o.lineWidth=1.5,o.stroke(),e}function te(s){const[t,e]=fe(),o=P[s],n=d/2,i=h*.46;e.fillStyle=Xe,e.fillRect(0,0,d,h);const a=e.createRadialGradient(n,i,0,n,i,h*.6);a.addColorStop(0,A(o,.34)),a.addColorStop(1,A(o,0)),e.fillStyle=a,e.fillRect(0,0,d,h),e.save(),e.translate(n,i),e.rotate(115*Math.PI/180),e.strokeStyle="rgba(255, 255, 255, 0.035)",e.lineWidth=1;for(let r=-h;r<=h;r+=7)e.beginPath(),e.moveTo(r,-h),e.lineTo(r,h),e.stroke();e.restore();for(let r=54;r<200;r+=22)e.beginPath(),e.arc(n,i,r,0,Math.PI*2),e.strokeStyle=`rgba(255, 255, 255, ${.09-(r-54)*4e-4})`,e.lineWidth=1,e.stroke();return _(e,n-38,i-38,76,76,20),e.fillStyle=de,e.fill(),e.strokeStyle=ee,e.lineWidth=2.5,e.stroke(),e.fillStyle=ee,e.font=`800 32px ${z}`,e.textAlign="center",e.textBaseline="middle",e.fillText("TS",n,i+2),e.textBaseline="alphabetic",e.font=`700 10px ${C}`,R(e,3.2),e.fillStyle="rgba(255, 255, 255, 0.6)",e.fillText("TRAINER STUDIO",n+1.6,i+76),e.font=`500 9px ${C}`,e.fillStyle=o,e.fillText(`${s.toUpperCase()} CORNER`,n+1.6,h-30),R(e,0),e.textAlign="start",_(e,12,12,d-24,h-24,V-8),e.strokeStyle=A(o,.38),e.lineWidth=1.2,e.stroke(),_(e,1,1,d-2,h-2,V-1),e.strokeStyle="rgba(255, 255, 255, 0.1)",e.lineWidth=1.5,e.stroke(),t}function W(s,t){const e=new Re(s);return e.colorSpace=ne,e.anisotropy=t,e}function it(){const s=document.createElement("canvas");s.width=s.height=128;const t=s.getContext("2d");if(!t)throw new Error("2D canvas unavailable");const e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(0, 0, 0, 1)"),e.addColorStop(.45,"rgba(0, 0, 0, 0.45)"),e.addColorStop(1,"rgba(0, 0, 0, 0)"),t.fillStyle=e,t.fillRect(0,0,128,128),s}const $="#07080b",at="#1b1f2a",pe=new S("#fff3e0");function me(s,t,e){return e.copy(pe).lerp(rt.set(s),Math.min(1,Math.max(0,t)))}const rt=new S;class lt{constructor(t,e){c(this,"scene",new Pe);c(this,"camera");c(this,"lights");c(this,"onContextLost");c(this,"onContextRestored");c(this,"renderer");c(this,"canvas");c(this,"reducedMotion");c(this,"shared",Ge());c(this,"fog",new ke($,20,50));c(this,"floor");c(this,"floorRadius",{value:18});c(this,"cards",new Map);c(this,"textures",new Set);c(this,"geometries",null);c(this,"aspect",16/9);c(this,"running",!1);c(this,"contextLost",!1);c(this,"disposed",!1);c(this,"lastNow",null);c(this,"elapsed",0);c(this,"loadToken",0);c(this,"frame",t=>{const e=this.lastNow===null?0:Math.min((t-this.lastNow)/1e3,.1);this.lastNow=t,this.elapsed+=e,this.update(this.elapsed),this.renderer.render(this.scene,this.camera.camera)});c(this,"keyDir",new m);c(this,"handleVisibility",()=>this.syncLoop());c(this,"handleContextLost",t=>{var e;t.preventDefault(),this.contextLost=!0,this.syncLoop(),(e=this.onContextLost)==null||e.call(this)});c(this,"handleContextRestored",()=>{var t;this.contextLost=!1,this.syncLoop(),(t=this.onContextRestored)==null||t.call(this)});this.canvas=t,this.reducedMotion=e.reducedMotion,this.renderer=new _e({canvas:t,antialias:!0,powerPreference:"high-performance",stencil:!1}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),this.renderer.outputColorSpace=ne,this.renderer.toneMapping=Ae,this.renderer.setClearColor($,1),this.scene.background=new S($),this.scene.fog=this.fog,this.lights=this.createLights(),this.floor=this.createFloor(),this.scene.add(this.floor);const o=t.clientWidth||t.width||1,n=t.clientHeight||t.height||1;this.camera=new le(o/n,{reducedMotion:this.reducedMotion}),this.resize(o,n),t.addEventListener("webglcontextlost",this.handleContextLost),t.addEventListener("webglcontextrestored",this.handleContextRestored),document.addEventListener("visibilitychange",this.handleVisibility)}static isSupported(){var t;try{const e=document.createElement("canvas").getContext("webgl2");return e?((t=e.getExtension("WEBGL_lose_context"))==null||t.loseContext(),!0):!1}catch{return!1}}async load(t,e){var w;const o=++this.loadToken,n=[...t.fighters,...e.fighters],[i]=await Promise.all([Promise.all(n.map(f=>Je(f.artwork,Qe))),Ze()]);if(this.disposed||o!==this.loadToken)return;this.clearCards();const a=this.geometries??(this.geometries=Ye()),r=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),l={red:this.track(W(te("red"),r)),blue:this.track(W(te("blue"),r))},u=this.track(W(it(),1));n.forEach((f,x)=>{const v=this.track(W(nt(f,i[x]??null),r)),b=je(f,a,{face:v,back:l[f.side],shadow:u},P[f.side],this.shared),L={...b,role:ct(f),faceDown:!1};this.cards.set(f.id,L),this.scene.add(b.handle.group,b.shadow),this.place(L)});const g=(w=t.fighters[0])==null?void 0:w.types[0];this.setKeyTint(B(g),g?.3:0)}get fighters(){return[...this.cards.values()].map(t=>t.handle.fighter)}card(t){const e=this.cards.get(t);if(!e)throw new Error(`BattleStage: no card for fighter "${t}"`);return e.handle}setRole(t,e,o=!1){const n=this.cards.get(t);n&&(n.role=e,n.faceDown=o)}home(t){const e=this.cards.get(t);return e!=null&&e.role?{position:this.slot(e,e.role),rotationY:this.restYaw(e,e.role,e.faceDown)}:null}slotFor(t,e,o=!1){const n=this.cards.get(t);return n?{position:this.slot(n,e),rotationY:this.restYaw(n,e,o)}:null}pivot(t){const e=this.cards.get(t);if(!e)throw new Error(`BattleStage: no card for fighter "${t}"`);return e.pivot}get aspectRatio(){return this.aspect}setKeyTint(t,e){me(t,e,this.lights.key.color)}resize(t,e){if(this.disposed||t<=0||e<=0)return;this.aspect=t/e,this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)),this.renderer.setSize(t,e,!1),this.camera.setAspect(this.aspect);const o=this.camera.wideDistance;this.fog.near=o*.9,this.fog.far=o*2.3,this.floorRadius.value=o*1.2;for(const n of this.cards.values())this.place(n)}async prewarm(){if(this.disposed||this.contextLost)return;const t=[];this.scene.traverse(o=>{o.visible||t.push(o)});let e;try{for(const o of t)o.visible=!0;e=this.renderer.compileAsync(this.scene,this.camera.camera)}catch{return}finally{for(const o of t)o.visible=!1}await e.catch(()=>{})}start(){this.running||this.disposed||(this.running=!0,this.syncLoop())}stop(){this.running=!1,this.syncLoop()}dispose(){if(!this.disposed){this.disposed=!0,this.running=!1,this.renderer.setAnimationLoop(null),this.canvas.removeEventListener("webglcontextlost",this.handleContextLost),this.canvas.removeEventListener("webglcontextrestored",this.handleContextRestored),document.removeEventListener("visibilitychange",this.handleVisibility),this.scene.traverse(dt),this.scene.clear();for(const t of this.textures)t.dispose();this.textures.clear(),this.cards.clear(),this.geometries=null,this.renderer.renderLists.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),this.onContextLost=void 0,this.onContextRestored=void 0}}track(t){return this.textures.add(t),t}slot(t,e){return N(t.handle.fighter.side,e,this.aspect)}restYaw(t,e,o){const{side:n}=t.handle.fighter;return Ne(n,e)+(o?n==="red"?Math.PI:-Math.PI:0)}place(t){t.role&&(t.handle.group.position.copy(this.slot(t,t.role)),t.handle.group.rotation.set(0,this.restYaw(t,t.role,t.faceDown),0))}clearCards(){for(const{handle:t,shadow:e}of this.cards.values())t.group.traverse(o=>{o instanceof k&&ge(o.material)}),e.material.dispose(),this.scene.remove(t.group,e);this.cards.clear();for(const t of this.textures)t.dispose();this.textures.clear()}createLights(){const t=new Le("#cdd2de",$,.55),e=new K(pe,1.7);e.position.set(5,9,8);const o=new K(P.red,1.3);o.position.set(-9,5,-7);const n=new K(P.blue,1.3);return n.position.set(9,5,-7),this.scene.add(t,e,o,n),{key:e,rimRed:o,rimBlue:n,fill:t}}createFloor(){const t=new Ee(80,64);t.rotateX(-Math.PI/2);const e=new O({fog:!0,uniforms:{...oe.clone(se.fog),uKeyColor:this.shared.uKeyColor,uCenter:{value:new S(at)},uEdge:{value:new S($)},uRed:{value:new S(P.red)},uBlue:{value:new S(P.blue)},uRadius:this.floorRadius},vertexShader:`
        varying vec3 vWorldPos;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,fragmentShader:`
        uniform vec3 uKeyColor;
        uniform vec3 uCenter;
        uniform vec3 uEdge;
        uniform vec3 uRed;
        uniform vec3 uBlue;
        uniform float uRadius;
        varying vec3 vWorldPos;
        #include <common>
        #include <fog_pars_fragment>

        float pool(vec2 p, vec2 c, float falloff) { vec2 d = p - c; return exp(-dot(d, d) * falloff); }

        void main() {
          vec2 p = vWorldPos.xz;
          float r = length(p * vec2(0.75, 1.0)) / uRadius;
          vec3 color = mix(uCenter, uEdge, smoothstep(0.0, 1.0, r));

          color += uRed * 0.05 * pool(p, vec2(-4.5, -2.5), 0.045);
          color += uBlue * 0.05 * pool(p, vec2(4.5, -2.5), 0.045);
          color += uKeyColor * 0.035 * pool(p, vec2(0.0, 0.5), 0.07);

          vec2 cell = fract(p / 0.55) - 0.5;
          float d = length(cell);
          float aa = fwidth(d);
          float dots = 1.0 - smoothstep(0.04 - aa, 0.04 + aa, d);
          // Fade out where dots would shrink below a pixel and shimmer.
          float near = 1.0 - smoothstep(0.15, 0.6, r);
          color += dots * 0.03 * near * (1.0 - smoothstep(0.05, 0.25, aa));

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `});e.toneMapped=!1;const o=new k(t,e);return o.name="floor",o.renderOrder=-2,o}syncLoop(){this.running&&!this.disposed&&!this.contextLost&&!document.hidden?(this.lastNow=null,this.renderer.setAnimationLoop(this.frame)):this.renderer.setAnimationLoop(null)}update(t){const{key:e}=this.lights;this.shared.uKeyColor.value.copy(e.color),this.shared.uKeyDir.value.copy(this.keyDir.subVectors(e.position,e.target.position).normalize()),this.reducedMotion||(this.shared.uTime.value=t),this.camera.update(t);for(const{handle:o,pivot:n,shadow:i}of this.cards.values()){const{group:a}=o;if(!this.reducedMotion){const l=o.fighter.slot*1.7+(o.fighter.side==="red"?0:.9);n.position.y=Math.sin(t*.9+l)*.05,n.rotation.z=Math.sin(t*.6+l)*.006}const r=Math.max(0,a.position.y-(T/2+ae)+n.position.y);i.visible=a.visible,i.position.set(a.position.x,.004,a.position.z),i.rotation.y=a.rotation.y,i.scale.setScalar(a.scale.x*(1+r*.12)),i.material.opacity=.75*Math.max(0,1-r/4)}}}function ct(s){return s.slot===0?"active":{bench:s.slot-1}}function ge(s){for(const t of Array.isArray(s)?s:[s]){if(t instanceof O)for(const e of Object.values(t.uniforms)){const o=e.value;o&&typeof o=="object"&&"isTexture"in o&&o.dispose()}else for(const e of Object.values(t))e&&typeof e=="object"&&"isTexture"in e&&e.dispose();t.dispose()}}function dt(s){(s instanceof k||s instanceof De)&&(s.geometry.dispose(),ge(s.material))}const mt=Object.freeze(Object.defineProperty({__proto__:null,BattleStage:lt,CameraRig:le,keyTintColor:me},Symbol.toStringTag,{value:"Module"}));export{mt as B,T as C,Z as H,P as S,M as a,ie as b,ae as c,me as k,N as s};

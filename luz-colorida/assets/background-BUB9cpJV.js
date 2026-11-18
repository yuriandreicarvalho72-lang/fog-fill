import{O as r,D as G,I as v,a as k,S as C,C as A,b as E}from"./shared-Bl-aqqnw.js";const I=8;function S(n,s){const e=[];e.push("uniform mat3 view;");for(let a=0;a<n;a++)e.push(`uniform vec2 lp${a};`),e.push(`uniform vec3 lc${a};`),e.push(`uniform vec3 la${a};`),e.push(`uniform vec3 ld${a};`);for(let a=0;a<s;a++)e.push(`uniform vec2 sa${a}; uniform vec2 sb${a};`);const o=`
// true se o segmento p->q cruza o segmento a->b
bool cross(float2 p, float2 q, float2 a, float2 b) {
  float2 r = q - p, s = b - a;
  float den = r.x * s.y - r.y * s.x;
  if (abs(den) < 1e-6) return false;
  float2 ap = a - p;
  float t = (ap.x * s.y - ap.y * s.x) / den;
  float v = (ap.x * r.y - ap.y * r.x) / den;
  return t > 0.0005 && t < 0.9995 && v >= 0.0 && v <= 1.0;
}
float angDiff(float a, float b) {
  float d = abs(a - b);
  d = mod(d, 6.2831853);
  return min(d, 6.2831853 - d);
}`,t=[];t.push("  float tx = view[2][0] + view[0][2];"),t.push("  float ty = view[2][1] + view[1][2];"),t.push("  float2 w = float2((coord.x - tx) / view[0][0], (coord.y - ty) / view[1][1]);"),t.push("  float3 acc = float3(0.0);"),t.push("  float am = 0.0;");for(let a=0;a<n;a++){t.push(`  {
    float2 d = w - lp${a};
    float dist = length(d);
    if (dist < la${a}.x) {
      float t = dist / la${a}.x;
      float a = la${a}.z * (1.0 - smoothstep(1.0 - la${a}.y, 1.0, t)) * (1.0 - 0.35 * t);
      if (ld${a}.z < 3.14) {
        float th = angDiff(atan(d.y, d.x), ld${a}.x);
        a *= 1.0 - smoothstep(ld${a}.y, max(ld${a}.z, ld${a}.y + 0.001), th);
      }
      bool lit = a > 0.002;`);for(let c=0;c<s;c++)t.push(`      if (lit && cross(lp${a}, w, sa${c}, sb${c})) lit = false;`);t.push(`      if (lit) { acc += lc${a} * a; am = max(am, a); }
    }
  }`)}return t.push("  am = clamp(am, 0.0, 1.0);"),t.push("  return half4(half3(clamp(acc, 0.0, 1.0)), half(am));"),`${e.join(`
`)}
${o}

half4 main(float2 coord) {
${t.join(`
`)}
}
`}function D(n){const s=/^#?([0-9a-f]{6})$/i.exec(n||""),e=s?parseInt(s[1],16):16777215;return{x:(e>>16&255)/255,y:(e>>8&255)/255,z:(e&255)/255}}function H(n,s){const e=[];return n.forEach((o,t)=>{e.push({name:`lp${t}`,value:{x:o.x,y:o.y}}),e.push({name:`lc${t}`,value:D(o.color)}),e.push({name:`la${t}`,value:{x:o.radius,y:o.softness,z:o.intensity}}),e.push({name:`ld${t}`,value:{x:o.dir,y:o.inner,z:o.outer}})}),s.forEach((o,t)=>{e.push({name:`sa${t}`,value:{x:o.ax,y:o.ay}}),e.push({name:`sb${t}`,value:{x:o.bx,y:o.by}})}),e}const L=n=>new URL(`/fog-fill/luz-colorida/${n}`,window.location.href).href,w=n=>n*Math.PI/180;let y={...k},p=null,b={sksl:"",layer:"",blend:""},M=null,z=!1;function g(n=50){M||(M=setTimeout(()=>{M=null,O().catch(s=>console.error(`[${v}]`,s))},n))}function W(n,s){var m,x;const e=((m=n.scale)==null?void 0:m.x)??1,o=((x=n.scale)==null?void 0:x.y)??1,t=w(n.rotation??0),a=s.x*e,c=s.y*o;return{x:n.position.x+a*Math.cos(t)-c*Math.sin(t),y:n.position.y+a*Math.sin(t)+c*Math.cos(t)}}function j(n,s){if(n.length<3)return n;const e=new Uint8Array(n.length);e[0]=e[n.length-1]=1;const o=[[0,n.length-1]];for(;o.length;){const[t,a]=o.pop(),c=n[t],m=n[a],x=m.x-c.x,$=m.y-c.y,l=Math.hypot(x,$)||1;let i=-1,d=-1;for(let f=t+1;f<a;f++){const u=Math.abs($*n[f].x-x*n[f].y+m.x*c.y-m.y*c.x)/l;u>i&&(i=u,d=f)}i>s&&(e[d]=1,o.push([t,d],[d,a]))}return n.filter((t,a)=>e[a])}function N(n,s,e){const o=e.bx-e.ax,t=e.by-e.ay,a=o*o+t*t||1,c=Math.max(0,Math.min(1,((n-e.ax)*o+(s-e.ay)*t)/a));return Math.hypot(n-(e.ax+c*o),s-(e.ay+c*t))}async function R(){p&&(await r.scene.local.deleteItems([p]).catch(()=>{}),p=null,b={sksl:"",layer:"",blend:""})}async function O(){var x,$;const[n,s]=await Promise.all([r.scene.local.getItems(),r.scene.items.getItems()]),e=new Map(s.map(l=>[l.id,l])),o=[];for(const l of n){if(l.type!=="LIGHT"||!l.attachedTo)continue;const i=e.get(l.attachedTo),d=(x=i==null?void 0:i.metadata)==null?void 0:x[A];!(d!=null&&d.color)||!(($=i==null?void 0:i.metadata)!=null&&$[G])||i.visible===!1||l.visible===!1||o.push({x:i.position.x,y:i.position.y,radius:l.attenuationRadius||0,softness:Math.min(.9,Math.max(.08,(l.falloff??1)/2)),intensity:d.intensity??.6,color:d.color,dir:w((l.rotation??0)+y.dirOffset),inner:w((l.innerAngle??360)/2),outer:w((l.outerAngle??360)/2)})}if(o.length>I&&(!z&&await r.player.getRole()==="GM"&&(z=!0,r.notification.show(`Luz Colorida: só ${I} luzes coloridas aparecem ao mesmo tempo; as demais ficam brancas.`,"WARNING")),o.length=I),!o.length)return R();let t=[];if(y.shadows){const l=[...n,...s].filter(f=>f.type==="WALL"&&f.blocking!==!1),i=[];for(const f of l){const u=j((f.points||[]).map(h=>W(f,h)),3);for(let h=0;h<u.length-1;h++)i.push({ax:u[h].x,ay:u[h].y,bx:u[h+1].x,by:u[h+1].y})}const d=[];for(const f of i){let u=1/0;for(const h of o){const T=N(h.x,h.y,f);T<h.radius&&(u=Math.min(u,T/h.radius))}u<1/0&&d.push([u,f])}d.sort((f,u)=>f[0]-u[0]),t=d.slice(0,y.maxSegments).map(([,f])=>f)}const a=S(o.length,t.length),c=H(o,t);if(p&&(b.layer!==y.layer||b.blend!==y.blend)&&await R(),!p){const l=E().effectType("VIEWPORT").sksl(a).uniforms(c).blendMode(y.blend).layer(y.layer).locked(!0).disableHit(!0).name("Luz colorida").metadata({[`${v}/effect`]:!0}).build();await r.scene.local.addItems([l]),p=l.id,b={sksl:a,layer:y.layer,blend:y.blend};return}const m=a!==b.sksl;await r.scene.local.updateItems([p],l=>{for(const i of l)m&&(i.sksl=a),i.uniforms=c}),b.sksl=a}async function U(){const n=await r.scene.getMetadata();y={...k,...n[C]||{}}}r.onReady(async()=>{await r.contextMenu.create({id:`${v}/menu`,icons:[{icon:L("icon.svg"),label:"Cor da luz",filter:{every:[{key:["metadata",G],value:void 0,operator:"!="}],roles:["GM"]}}],embed:{url:L("context.html"),height:168}});const n=async()=>{const e=await r.scene.local.getItems(o=>{var t;return((t=o.metadata)==null?void 0:t[`${v}/effect`])===!0});e.length&&await r.scene.local.deleteItems(e.map(o=>o.id)),p=null,b={sksl:"",layer:"",blend:""},await U(),g(0)};await r.scene.isReady()&&await n(),r.scene.onReadyChange(e=>{e?n():p=null}),r.scene.onMetadataChange(e=>{y={...k,...e[C]||{}},g()}),r.scene.items.onChange(()=>g());let s="";r.scene.local.onChange(e=>{const o=e.filter(t=>t.type==="LIGHT"||t.type==="WALL").map(t=>{var a;return`${t.id}:${t.lastModified}:${t.position.x|0},${t.position.y|0}:${t.visible}:${t.blocking??""}:${t.attenuationRadius??""}:${t.rotation??0}:${((a=t.points)==null?void 0:a.length)??0}`}).join("|");o!==s&&(s=o,g())})});

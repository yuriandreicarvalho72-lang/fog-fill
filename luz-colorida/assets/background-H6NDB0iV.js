import{O as u,D as E,I as T,a as R,S,C as D,b as H}from"./shared-XAn_tuje.js";const k=8;function N(o,c,a="standalone",e=!1){const t=[];a==="viewport"?t.push("uniform mat3 view;"):t.push("uniform vec2 position;","uniform vec2 size;","uniform vec2 wsize;");for(let n=0;n<o;n++)t.push(`uniform vec2 lp${n};`),t.push(`uniform vec3 lc${n};`),t.push(`uniform vec3 la${n};`),t.push(`uniform vec3 ld${n};`);for(let n=0;n<c;n++)t.push(`uniform vec2 sa${n}; uniform vec2 sb${n};`);const r=`
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
}`,l=[];a==="viewport"?(l.push("  float tx = view[2][0] + view[0][2];"),l.push("  float ty = view[2][1] + view[1][2];"),l.push("  float2 w = float2((coord.x - tx) / view[0][0], (coord.y - ty) / view[1][1]);")):l.push("  float2 w = position + coord * (wsize / max(size, float2(1.0)));"),l.push("  float3 acc = float3(0.0);"),l.push("  float am = 0.0;");for(let n=0;n<o;n++){l.push(`  {
    float2 d = w - lp${n};
    float dist = length(d);
    if (dist < la${n}.x) {
      float t = dist / la${n}.x;
      float a = la${n}.z * (1.0 - smoothstep(1.0 - la${n}.y, 1.0, t)) * (1.0 - 0.35 * t);
      if (ld${n}.z < 3.14) {
        float th = angDiff(atan(d.y, d.x), ld${n}.x);
        a *= 1.0 - smoothstep(ld${n}.y, max(ld${n}.z, ld${n}.y + 0.001), th);
      }
      bool lit = a > 0.002;`);for(let f=0;f<c;f++)l.push(`      if (lit && cross(lp${n}, w, sa${f}, sb${f})) lit = false;`);l.push(`      if (lit) { acc += lc${n} * a; am = max(am, a); }
      ${e?`if (abs(dist - la${n}.x * 0.08) < la${n}.x * 0.012) { acc = float3(1.0); am = 1.0; }`:""}
    }
  }`)}return l.push("  am = clamp(am, 0.0, 1.0);"),l.push("  return half4(half3(clamp(acc, 0.0, 1.0)), half(am));"),`${t.join(`
`)}
${r}

half4 main(float2 coord) {
${l.join(`
`)}
}
`}function W(o){const c=/^#?([0-9a-f]{6})$/i.exec(o||""),a=c?parseInt(c[1],16):16777215;return{x:(a>>16&255)/255,y:(a>>8&255)/255,z:(a&255)/255}}function O(o,c){const a=[];return o.forEach((e,t)=>{a.push({name:`lp${t}`,value:{x:e.x,y:e.y}}),a.push({name:`lc${t}`,value:W(e.color)}),a.push({name:`la${t}`,value:{x:e.radius,y:e.softness,z:e.intensity}}),a.push({name:`ld${t}`,value:{x:e.dir,y:e.inner,z:e.outer}})}),c.forEach((e,t)=>{a.push({name:`sa${t}`,value:{x:e.ax,y:e.ay}}),a.push({name:`sb${t}`,value:{x:e.bx,y:e.by}})}),a}const A=o=>new URL(`/fog-fill/luz-colorida/${o}`,window.location.href).href,z=o=>o*Math.PI/180;let p={...R},b=null,$={sksl:"",layer:"",blend:"",mode:""},L=null,G=!1;function I(o=50){L||(L=setTimeout(()=>{L=null,q().catch(c=>console.error(`[${T}]`,c))},o))}function j(o,c){var n,f;const a=((n=o.scale)==null?void 0:n.x)??1,e=((f=o.scale)==null?void 0:f.y)??1,t=z(o.rotation??0),r=c.x*a,l=c.y*e;return{x:o.position.x+r*Math.cos(t)-l*Math.sin(t),y:o.position.y+r*Math.sin(t)+l*Math.cos(t)}}function U(o,c){if(o.length<3)return o;const a=new Uint8Array(o.length);a[0]=a[o.length-1]=1;const e=[[0,o.length-1]];for(;e.length;){const[t,r]=e.pop(),l=o[t],n=o[r],f=n.x-l.x,v=n.y-l.y,M=Math.hypot(f,v)||1;let w=-1,i=-1;for(let s=t+1;s<r;s++){const m=Math.abs(v*o[s].x-f*o[s].y+n.x*l.y-n.y*l.x)/M;m>w&&(w=m,i=s)}w>c&&(a[i]=1,e.push([t,i],[i,r]))}return o.filter((t,r)=>a[r])}function _(o,c,a){const e=a.bx-a.ax,t=a.by-a.ay,r=e*e+t*t||1,l=Math.max(0,Math.min(1,((o-a.ax)*e+(c-a.ay)*t)/r));return Math.hypot(o-(a.ax+l*e),c-(a.ay+l*t))}async function C(){b&&(await u.scene.local.deleteItems([b]).catch(()=>{}),b=null,$={sksl:"",layer:"",blend:"",mode:""})}async function q(){var M,w;const[o,c]=await Promise.all([u.scene.local.getItems(),u.scene.items.getItems()]),a=new Map(c.map(i=>[i.id,i])),e=[];for(const i of o){if(i.type!=="LIGHT"||!i.attachedTo)continue;const s=a.get(i.attachedTo),m=(M=s==null?void 0:s.metadata)==null?void 0:M[D];!(m!=null&&m.color)||!((w=s==null?void 0:s.metadata)!=null&&w[E])||s.visible===!1||i.visible===!1||e.push({x:s.position.x,y:s.position.y,radius:i.attenuationRadius||0,softness:Math.min(.9,Math.max(.08,(i.falloff??1)/2)),intensity:m.intensity??.6,color:m.color,dir:z((i.rotation??0)+p.dirOffset),inner:z((i.innerAngle??360)/2),outer:z((i.outerAngle??360)/2)})}if(e.length>k&&(!G&&await u.player.getRole()==="GM"&&(G=!0,u.notification.show(`Luz Colorida: só ${k} luzes coloridas aparecem ao mesmo tempo; as demais ficam brancas.`,"WARNING")),e.length=k),!e.length)return C();let t=[];if(p.shadows){const i=[...o,...c].filter(h=>h.type==="WALL"&&h.blocking!==!1),s=[];for(const h of i){const y=U((h.points||[]).map(d=>j(h,d)),3);for(let d=0;d<y.length-1;d++)s.push({ax:y[d].x,ay:y[d].y,bx:y[d+1].x,by:y[d+1].y})}const m=[];for(const h of s){let y=1/0;for(const d of e){const g=_(d.x,d.y,h);g<d.radius&&(y=Math.min(y,g/d.radius))}y<1/0&&m.push([y,h])}m.sort((h,y)=>h[0]-y[0]),t=m.slice(0,p.maxSegments).map(([,h])=>h)}const r=p.posMode==="viewport"?"viewport":"standalone",l=N(e.length,t.length,r,!!p.debug),n=O(e,t);let f=null;if(r==="standalone"){const s=Math.min(...e.map(x=>x.x-x.radius))-20,m=Math.min(...e.map(x=>x.y-x.radius))-20,h=Math.max(...e.map(x=>x.x+x.radius))+20,y=Math.max(...e.map(x=>x.y+x.radius))+20,d=2*(h-s),g=2*(y-m);f={x:s,y:m,w:d,h:g},n.push({name:"wsize",value:{x:d,y:g}})}if(b&&($.layer!==p.layer||$.blend!==p.blend||$.mode!==r)&&await C(),!b){const i=H().effectType(r==="viewport"?"VIEWPORT":"STANDALONE").sksl(l).uniforms(n).blendMode(p.blend).layer(p.layer).locked(!0).disableHit(!0).name("Luz colorida").metadata({[`${T}/effect`]:!0});f&&i.position({x:f.x,y:f.y}).width(f.w).height(f.h);const s=i.build();await u.scene.local.addItems([s]),b=s.id,$={sksl:l,layer:p.layer,blend:p.blend,mode:r};return}const v=l!==$.sksl;await u.scene.local.updateItems([b],i=>{for(const s of i)v&&(s.sksl=l),s.uniforms=n,f&&(s.position={x:f.x,y:f.y},s.width=f.w,s.height=f.h)}),$.sksl=l}async function F(){const o=await u.scene.getMetadata();p={...R,...o[S]||{}}}u.onReady(async()=>{await u.contextMenu.create({id:`${T}/menu`,icons:[{icon:A("icon.svg"),label:"Cor da luz",filter:{every:[{key:["metadata",E],value:void 0,operator:"!="}],roles:["GM"]}}],embed:{url:A("context.html"),height:168}});const o=async()=>{const a=await u.scene.local.getItems(e=>{var t;return((t=e.metadata)==null?void 0:t[`${T}/effect`])===!0});a.length&&await u.scene.local.deleteItems(a.map(e=>e.id)),b=null,$={sksl:"",layer:"",blend:"",mode:""},await F(),I(0)};await u.scene.isReady()&&await o(),u.scene.onReadyChange(a=>{a?o():b=null}),u.scene.onMetadataChange(a=>{p={...R,...a[S]||{}},I()}),u.scene.items.onChange(()=>I());let c="";u.scene.local.onChange(a=>{const e=a.filter(t=>t.type==="LIGHT"||t.type==="WALL").map(t=>{var r;return`${t.id}:${t.lastModified}:${t.position.x|0},${t.position.y|0}:${t.visible}:${t.blocking??""}:${t.attenuationRadius??""}:${t.rotation??0}:${((r=t.points)==null?void 0:r.length)??0}`}).join("|");e!==c&&(c=e,I())})});

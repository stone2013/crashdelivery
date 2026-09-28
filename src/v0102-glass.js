/* V0.10.2 — bounded, deterministic glass-hole decals.
 * The pane stays present. A per-pane RGBA canvas texture contains transparent holes
 * and radial cracks. Only impact data is synchronized, not textures or shards.
 */
const GLASS012={maxHoles:4,panes:new Map(),serial:0,draws:0,uploads:0,program:null};
function glass012Seed(h,g,n){return ((h.num*7349+g.index*193+n*9137)>>>0)||1;}
function glass012Random(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function glass012Pass(g,q,r){return (g.holes012||[]).some(v=>Math.hypot(q[0]-g.x-v.x,q[1]-g.y-v.y)+r<=v.r*.75);}
function glass012Impact(h,g,p,point=null){
 if(net.mode==='guest'&&!net.applying)return false;
 const q=point||p?.impact012||(p?.p?houseLocal(h,p.p):[g.x,g.y,g.planeZ||4.34]),r=clamp(p?.r||.24,.12,.6);
 if(glass012Pass(g,q,r))return true;
 let holes=g.holes012||(g.holes012=[]),x=clamp(q[0]-g.x,-g.w*.48,g.w*.48),y=clamp(q[1]-g.y,-g.h*.48,g.h*.48),near=holes.find(v=>Math.hypot(x-v.x,y-v.y)<v.r*.9);
 if(near){near.r=Math.min(Math.max(g.w,g.h)*.80,Math.max(near.r+.16,Math.hypot(x-near.x,y-near.y)+r*1.5));}
 else{const hole={x:+x.toFixed(3),y:+y.toFixed(3),r:+Math.max(.56,r*1.85).toFixed(3),seed:glass012Seed(h,g,++GLASS012.serial)};if(holes.length>=GLASS012.maxHoles)holes.shift();holes.push(hole);}
 g.broken=true;glassSound();
 if(net.mode==='host'&&!net.applying)worldEvent('gate',{num:h.num,index:g.index,holes012:holes.map(v=>({...v})),v:[0,0,0]});
 return true;
}
function glass012Apply(g,raw){
 const holes=Array.isArray(raw)?raw.slice(0,GLASS012.maxHoles).filter(v=>v&&[v.x,v.y,v.r,v.seed].every(Number.isFinite)).map(v=>({x:clamp(v.x,-g.w*.5,g.w*.5),y:clamp(v.y,-g.h*.5,g.h*.5),r:clamp(v.r,.12,Math.max(g.w,g.h)),seed:v.seed>>>0})):[];
 g.holes012=holes;g.broken=holes.length>0;
}
const glass012OriginalBreak=breakGate;
breakGate=function(h,g,p){if(g.type==='window'){glass012Impact(h,g,p);return;}if(g.industrial)return;glass012OriginalBreak(h,g,p);};
function glass012Texture(g){
 const key=g.house.num+':'+g.index,size=quality==='low'?128:256,signature=size+':'+g.w+':'+g.h+':'+JSON.stringify(g.holes012||[]);let obj=GLASS012.panes.get(key);if(obj?.signature===signature)return obj;
 if(!obj){obj={texture:renderer.gl.createTexture()};GLASS012.panes.set(key,obj);}
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
 const gradient=x.createLinearGradient(0,0,0,size);gradient.addColorStop(0,'rgba(139,187,204,0.78)');gradient.addColorStop(.55,'rgba(87,139,163,0.76)');gradient.addColorStop(1,'rgba(49,91,116,0.85)');x.fillStyle=gradient;x.fillRect(0,0,size,size);
 x.fillStyle='rgba(217,234,230,.18)';x.beginPath();x.moveTo(size*.17,0);x.lineTo(size*.34,0);x.lineTo(size*.9,size);x.lineTo(size*.73,size);x.closePath();x.fill();
 x.fillStyle='rgba(232,244,237,.11)';x.beginPath();x.moveTo(size*.5,0);x.lineTo(size*.54,0);x.lineTo(size,size*.83);x.lineTo(size,size*.96);x.closePath();x.fill();
 for(const hole of g.holes012||[]){
  const random=glass012Random(hole.seed),segments=18,angles=Array.from({length:segments},(_,i)=>i*TAU/segments),outline=angles.map(a=>({a,r:hole.r*(.76+random()*.23)}));
  x.save();x.translate((.5+hole.x/g.w)*size,(.5-hole.y/g.h)*size);x.scale(size/g.w,-size/g.h);
  x.lineWidth=.013;x.strokeStyle='rgba(235,247,246,.95)';
  for(let i=0;i<segments;i++){
   const a=outline[i].a,start=outline[i].r,reach=hole.r*(1.65+random()*1.3),a2=a+(random()-.5)*.17;
   x.beginPath();x.moveTo(Math.cos(a)*start,Math.sin(a)*start);x.lineTo(Math.cos(a2)*reach*.70,Math.sin(a2)*reach*.70);x.lineTo(Math.cos(a+.06)*reach,Math.sin(a+.06)*reach);x.stroke();
   if(i%3===0){x.beginPath();x.moveTo(Math.cos(a2)*reach*.70,Math.sin(a2)*reach*.70);x.lineTo(Math.cos(a2+.24)*reach*.93,Math.sin(a2+.24)*reach*.93);x.stroke();}
  }
  x.strokeStyle='rgba(213,237,240,.7)';x.lineWidth=.010;
  for(const scale of [1.22,1.56]){x.beginPath();for(let i=0;i<segments;i++){const q=outline[i],px=Math.cos(q.a)*q.r*scale,py=Math.sin(q.a)*q.r*scale;if(i===0)x.moveTo(px,py);else x.lineTo(px,py);}x.closePath();x.stroke();}
  // Genuine alpha hole: it reveals the existing interior rather than drawing a black sticker.
  x.globalCompositeOperation='destination-out';x.fillStyle='#000';x.beginPath();outline.forEach((q,i)=>{const px=Math.cos(q.a)*q.r,py=Math.sin(q.a)*q.r;if(i===0)x.moveTo(px,py);else x.lineTo(px,py);});x.closePath();x.fill();
  x.globalCompositeOperation='source-over';x.lineWidth=.025;x.strokeStyle='rgba(220,240,241,.94)';x.stroke();x.restore();
 }
 const gl=renderer.gl;gl.bindTexture(gl.TEXTURE_2D,obj.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 obj.signature=signature;obj.canvas=c;GLASS012.uploads++;return obj;
}
function glass012Program(){if(GLASS012.program)return;const gl=renderer.gl;
 const vs='attribute vec2 aPos;attribute vec2 aUV;uniform mat4 uVP;uniform mat4 uM;varying vec2 vUV;varying vec3 vWorld;void main(){vUV=aUV;vec4 w=uM*vec4(aPos,0.,1.);vWorld=w.xyz;gl_Position=uVP*w;}';
 const fs='precision mediump float;varying vec2 vUV;varying vec3 vWorld;uniform sampler2D uTex;uniform vec3 uEye;void main(){vec4 c=texture2D(uTex,vUV);if(c.a<.02)discard;float f=smoothstep(150.,310.,length(vWorld-uEye));gl_FragColor=vec4(mix(c.rgb,vec3(.69,.79,.81),f*.92),c.a);}';
 const compile=(t,s)=>{const a=gl.createShader(t);gl.shaderSource(a,s);gl.compileShader(a);if(!gl.getShaderParameter(a,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(a));return a;};const pr=gl.createProgram();gl.attachShader(pr,compile(gl.VERTEX_SHADER,vs));gl.attachShader(pr,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));
 GLASS012.program=pr;GLASS012.pos=gl.getAttribLocation(pr,'aPos');GLASS012.uv=gl.getAttribLocation(pr,'aUV');GLASS012.loc={};for(const n of ['uVP','uM','uTex','uEye'])GLASS012.loc[n]=gl.getUniformLocation(pr,n);GLASS012.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,GLASS012.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,0,1,.5,-.5,1,1,.5,.5,1,0,-.5,-.5,0,1,.5,.5,1,0,-.5,.5,0,0]),gl.STATIC_DRAW);
}
function glass012Draw(){glass012Program();const gl=renderer.gl;GLASS012.draws=0;gl.useProgram(GLASS012.program);gl.bindBuffer(gl.ARRAY_BUFFER,GLASS012.buffer);gl.enableVertexAttribArray(GLASS012.pos);gl.vertexAttribPointer(GLASS012.pos,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(GLASS012.uv);gl.vertexAttribPointer(GLASS012.uv,2,gl.FLOAT,false,16,8);gl.uniformMatrix4fv(GLASS012.loc.uVP,false,renderer.vp);gl.uniform3fv(GLASS012.loc.uEye,eye);gl.uniform1i(GLASS012.loc.uTex,0);gl.activeTexture(gl.TEXTURE0);gl.disable(gl.CULL_FACE);
 for(const h of houses){if(V.len(V.sub([h.x,2,h.z],eye))>125)continue;for(const g of h.gates){if(g.type!=='window')continue;const obj=glass012Texture(g),z=g.planeZ||4.345,m=scaled(M.model(houseWorld(h,[g.x,g.y,z]),[0,h.yaw,0]),[g.w*.983,g.h*.98,1]);gl.bindTexture(gl.TEXTURE_2D,obj.texture);gl.uniformMatrix4fv(GLASS012.loc.uM,false,m);gl.drawArrays(gl.TRIANGLES,0,6);GLASS012.draws++;}}
 gl.enable(gl.CULL_FACE);gl.useProgram(renderer.program);
}
const glass012ResetBase=resetGame;resetGame=function(toMenu=false){for(const h of houses)for(const g of h.gates){g.holes012=[];g.broken=!!g.industrial&&g.type!=='window';}glass012ResetBase(toMenu);for(const h of houses)for(const g of h.gates)if(g.industrial&&g.type!=='window')g.broken=true;};

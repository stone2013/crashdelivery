/* V0.10.5.1 — texture-only industrial receiving decals + iOS PWA full-screen regression fix. */
const V01051={ready:false,program:null,buffer:null,pos:-1,uv:-1,loc:{},textures:new Map(),apronTexture:null,draws:0,removedChunk:false};

// V0.10.5 built concrete and an extra 3D garage-door facade in one function.
// Replace it before its scheduled init runs: keep only the concrete yard, never build the extra facade mesh.
v0105BuildConcreteAndFacades=function(){
 if(!industrial012.ready||V0105.concrete)return;
 const placements=industrial012.placements.filter(o=>o.role==='main'||o.role==='infill'||o.role==='prop');
 if(!placements.length)return;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const o of placements){minX=Math.min(minX,o.x-o.hw);maxX=Math.max(maxX,o.x+o.hw);minZ=Math.min(minZ,o.z-o.hd);maxZ=Math.max(maxZ,o.z+o.hd);}
 minX=Math.min(minX-8,66);maxX=Math.max(maxX+8,204);minZ=Math.min(minZ-8,-112);maxZ=Math.max(maxZ+8,112);
 V0105.industrialBounds={minX,maxX,minZ,maxZ};
 const ground=new MeshBuilder(),cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,w=maxX-minX,d=maxZ-minZ;
 ground.box(w,.045,d,'#8d9698',[cx,.050,cz]);
 for(let x=Math.ceil(minX/16)*16;x<maxX;x+=16)ground.box(.045,.008,d,'#747f82',[x,.076,cz]);
 for(let z=Math.ceil(minZ/16)*16;z<maxZ;z+=16)ground.box(w,.008,.045,'#747f82',[cx,.076,z]);
 V0105.concrete=renderer.mesh(ground);V0105.facade=null;
};

function v01051CanvasTexture(key,draw,w=512,h=512){
 let o=V01051.textures.get(key);if(o)return o;
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.clearRect(0,0,w,h);draw(x,w,h);
 const gl=renderer.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 o={texture:t,canvas:c};V01051.textures.set(key,o);return o;
}
function v01051DoorTexture(t){
 const kind=t.kind,num=t.h.num,key=kind+':'+num;
 return v01051CanvasTexture(key,(x,w,h)=>{
  x.clearRect(0,0,w,h);
  // Texture-only frontage: no 3D door frame or tunnel geometry.
  if(kind==='window'){
   x.fillStyle='rgba(225,230,222,.96)';x.fillRect(26,34,w-52,h-68);
   x.fillStyle='rgba(61,87,96,.10)';x.fillRect(54,70,w-108,h-132);
   x.clearRect(72,88,w-144,h-168); // glass012 supplies the actual glass pane/crack texture.
  }else{
   const grad=x.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#66777b');grad.addColorStop(1,'#3f5055');x.fillStyle=grad;x.fillRect(34,54,w-68,h-94);
   x.strokeStyle='rgba(222,230,226,.78)';x.lineWidth=5;x.strokeRect(34,54,w-68,h-94);
   x.strokeStyle='rgba(25,40,45,.55)';x.lineWidth=2;
   for(let y=80;y<h-54;y+=24){x.beginPath();x.moveTo(42,y);x.lineTo(w-42,y);x.stroke();}
   if(kind==='container'){x.strokeStyle='rgba(126,175,188,.9)';x.lineWidth=5;for(let xx=78;xx<w-65;xx+=44){x.beginPath();x.moveTo(xx,62);x.lineTo(xx,h-47);x.stroke();}}
   if(kind==='platform'){x.fillStyle='rgba(242,201,75,.78)';x.fillRect(46,h-100,w-92,30);}
  }
  x.fillStyle='rgba(30,58,64,.94)';x.fillRect(w*.26,8,w*.48,60);
  x.fillStyle='#ffdc73';x.textAlign='center';x.textBaseline='middle';x.font='bold 40px Arial, sans-serif';x.fillText(String(num),w/2,38);
 },512,512);
}
function v01051ApronTexture(){
 if(V01051.apronTexture)return V01051.apronTexture;
 V01051.apronTexture=v01051CanvasTexture('apron',(x,w,h)=>{
  x.clearRect(0,0,w,h);x.fillStyle='rgba(151,158,159,.36)';x.fillRect(2,2,w-4,h-4);
  x.strokeStyle='rgba(241,204,87,.98)';x.lineWidth=8;x.strokeRect(7,7,w-14,h-14);
  x.strokeStyle='rgba(255,238,165,.45)';x.lineWidth=2;x.strokeRect(17,17,w-34,h-34);
 },512,192);return V01051.apronTexture;
}
function v01051Program(){
 if(V01051.program)return;const gl=renderer.gl;
 const vs='attribute vec2 aPos;attribute vec2 aUV;uniform mat4 uVP;uniform mat4 uM;varying vec2 vUV;varying vec3 vWorld;void main(){vUV=aUV;vec4 w=uM*vec4(aPos,0.,1.);vWorld=w.xyz;gl_Position=uVP*w;}';
 const fs='precision mediump float;varying vec2 vUV;varying vec3 vWorld;uniform sampler2D uTex;uniform vec3 uEye;void main(){vec4 c=texture2D(uTex,vUV);if(c.a<.015)discard;float f=smoothstep(150.,310.,length(vWorld-uEye));gl_FragColor=vec4(mix(c.rgb,vec3(.69,.79,.81),f*.92),c.a);}';
 const compile=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
 const pr=gl.createProgram();gl.attachShader(pr,compile(gl.VERTEX_SHADER,vs));gl.attachShader(pr,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));
 V01051.program=pr;V01051.pos=gl.getAttribLocation(pr,'aPos');V01051.uv=gl.getAttribLocation(pr,'aUV');for(const n of ['uVP','uM','uTex','uEye'])V01051.loc[n]=gl.getUniformLocation(pr,n);
 V01051.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,V01051.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,0,1,.5,-.5,1,1,.5,.5,1,0,-.5,-.5,0,1,.5,.5,1,0,-.5,.5,0,0]),gl.STATIC_DRAW);
}
function v01051DrawDecals(){
 if(!V01051.ready||!industrial012.ready)return;v01051Program();const gl=renderer.gl;V01051.draws=0;
 gl.useProgram(V01051.program);gl.bindBuffer(gl.ARRAY_BUFFER,V01051.buffer);gl.enableVertexAttribArray(V01051.pos);gl.vertexAttribPointer(V01051.pos,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(V01051.uv);gl.vertexAttribPointer(V01051.uv,2,gl.FLOAT,false,16,8);gl.uniformMatrix4fv(V01051.loc.uVP,false,renderer.vp);gl.uniform3fv(V01051.loc.uEye,eye);gl.uniform1i(V01051.loc.uTex,0);gl.activeTexture(gl.TEXTURE0);gl.disable(gl.CULL_FACE);
 for(const t of industrial012.targets){
  const h=t.h,o=industrial012.placements.find(p=>p.h===h);if(!o||V.len(V.sub([h.x,3,h.z],eye))>145)continue;
  const g=t.gate,tex=v01051DoorTexture(t),plane=g.planeZ||t.z,width=Math.max(5.4,g.w*1.02),height=Math.max(3.0,g.h*1.03),m=scaled(M.model(houseWorld(h,[g.x,g.y,plane+.018]),[0,h.yaw,0]),[width,height,1]);
  gl.bindTexture(gl.TEXTURE_2D,tex.texture);gl.uniformMatrix4fv(V01051.loc.uM,false,m);gl.drawArrays(gl.TRIANGLES,0,6);V01051.draws++;
  // Ground apron is also a decal, not a 3D loading-bay model.
  const apron=Math.max(2.0,Math.min(4.0,h.setback012||2.4)),aw=width+1.2,ap=v01051ApronTexture(),centerZ=o.hd+apron*.52;
  const gm=scaled(M.model(houseWorld(h,[0,.145,centerZ]),[-Math.PI/2,h.yaw,0]),[aw,apron,1]);gl.bindTexture(gl.TEXTURE_2D,ap.texture);gl.uniformMatrix4fv(V01051.loc.uM,false,gm);gl.drawArrays(gl.TRIANGLES,0,6);V01051.draws++;
 }
 gl.enable(gl.CULL_FACE);gl.useProgram(renderer.program);
}
const v01051Draw3D=draw3D;
draw3D=function(){v01051Draw3D();if(state.mode!=='wardrobe')v01051DrawDecals();};

function v01051Viewport(){
 const doc=document.documentElement,body=document.body,game=document.getElementById('game'),vv=window.visualViewport,standalone=!!navigator.standalone||matchMedia('(display-mode: standalone)').matches;
 const inner=Math.round(window.innerHeight||0),client=Math.round(doc.clientHeight||0),visual=vv?Math.round(vv.height+(vv.offsetTop||0)):0;
 let physical=0;if(standalone&&window.screen){const portrait=matchMedia('(orientation: portrait)').matches;physical=Math.round(portrait?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height));}
 const h=Math.max(1,inner,client,visual,physical);
 doc.style.setProperty('--appH51',h+'px');doc.style.setProperty('height',h+'px','important');body.style.setProperty('height',h+'px','important');
 if(game){game.style.setProperty('position','fixed','important');game.style.setProperty('inset','0','important');game.style.setProperty('width','100%','important');game.style.setProperty('height',h+'px','important');game.style.setProperty('min-height',h+'px','important');game.style.setProperty('max-height',h+'px','important');}
 for(const id of ['menu','hud','pauseScreen','helpScreen','endScreen']){const el=document.getElementById(id);if(el){el.style.setProperty('min-height',h+'px','important');if(id!=='hud')el.style.setProperty('height',h+'px','important');}}
 requestAnimationFrame(()=>{try{resize();}catch(e){}});
}
for(const e of ['pageshow','orientationchange','resize'])window.addEventListener(e,()=>setTimeout(v01051Viewport,e==='resize'?0:80),{passive:true});
window.visualViewport?.addEventListener('resize',()=>setTimeout(v01051Viewport,0),{passive:true});
window.visualViewport?.addEventListener('scroll',()=>setTimeout(v01051Viewport,0),{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(v01051Viewport,80);});
setTimeout(v01051Viewport,0);setTimeout(v01051Viewport,250);setTimeout(v01051Viewport,900);

function v01051Finalize(){
 if(V01051.ready)return;if(!industrial012.ready||!V0105.ready){setTimeout(v01051Finalize,60);return;}
 // Remove V0.10.3/V0.10.5 receiving-bay geometry. Invisible target/collision logic stays intact.
 const before=industrial012.chunks.length;industrial012.chunks=industrial012.chunks.filter(c=>c.name!=='receiving-bays-and-hardstand');V01051.removedChunk=industrial012.chunks.length<before;
 V0105.facade=null;V01051.ready=true;
}
setTimeout(v01051Finalize,60);

if(window.__deliveryTest)window.__deliveryTest.v01051=()=>({ready:V01051.ready,removed3DReceivingBay:V01051.removedChunk,doorDecals:industrial012.targets.length,draws:V01051.draws,viewport:getComputedStyle(document.documentElement).getPropertyValue('--appH51')});

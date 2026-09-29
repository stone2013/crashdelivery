/* V0.10.5.1 native-door correction — use only the garage doors already present in Kenney GLBs. */
const V01051N={ready:false,apronProgram:null,buffer:null,pos:-1,uv:-1,loc:{},texture:null,draws:0,targets:[]};

function v01051NativeApronTexture(){
 if(V01051N.texture)return V01051N.texture;const c=document.createElement('canvas');c.width=512;c.height=192;const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
 x.strokeStyle='rgba(241,204,87,.94)';x.lineWidth=7;x.strokeRect(8,8,c.width-16,c.height-16);
 x.strokeStyle='rgba(255,239,171,.35)';x.lineWidth=2;x.strokeRect(18,18,c.width-36,c.height-36);
 const gl=renderer.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return V01051N.texture=t;
}
function v01051NativeApronProgram(){
 if(V01051N.apronProgram)return;const gl=renderer.gl,vs='attribute vec2 aPos;attribute vec2 aUV;uniform mat4 uVP;uniform mat4 uM;varying vec2 vUV;void main(){vUV=aUV;gl_Position=uVP*uM*vec4(aPos,0.,1.);}',fs='precision mediump float;varying vec2 vUV;uniform sampler2D uTex;void main(){vec4 c=texture2D(uTex,vUV);if(c.a<.02)discard;gl_FragColor=c;}';
 const compile=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;},pr=gl.createProgram();gl.attachShader(pr,compile(gl.VERTEX_SHADER,vs));gl.attachShader(pr,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));
 V01051N.apronProgram=pr;V01051N.pos=gl.getAttribLocation(pr,'aPos');V01051N.uv=gl.getAttribLocation(pr,'aUV');for(const n of ['uVP','uM','uTex'])V01051N.loc[n]=gl.getUniformLocation(pr,n);
 V01051N.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,V01051N.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,0,1,.5,-.5,1,1,.5,.5,1,0,-.5,-.5,0,1,.5,.5,1,0,-.5,.5,0,0]),gl.STATIC_DRAW);
}
function v01051NativeDrawAprons(){
 if(!V01051N.ready)return;v01051NativeApronProgram();const gl=renderer.gl;gl.useProgram(V01051N.apronProgram);gl.bindBuffer(gl.ARRAY_BUFFER,V01051N.buffer);gl.enableVertexAttribArray(V01051N.pos);gl.vertexAttribPointer(V01051N.pos,2,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(V01051N.uv);gl.vertexAttribPointer(V01051N.uv,2,gl.FLOAT,false,16,8);gl.uniformMatrix4fv(V01051N.loc.uVP,false,renderer.vp);gl.uniform1i(V01051N.loc.uTex,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,v01051NativeApronTexture());gl.disable(gl.CULL_FACE);V01051N.draws=0;
 for(const t of industrial012.targets){const h=t.h,o=industrial012.placements.find(p=>p.h===h);if(!o||V.len(V.sub([h.x,1,h.z],eye))>145)continue;const depth=Math.max(2,Math.min(4,h.setback012||2.4)),w=Math.max(4.8,t.w+.8),z=o.hd+depth*.50,m=scaled(M.model(houseWorld(h,[0,.145,z]),[-Math.PI/2,h.yaw,0]),[w,depth,1]);gl.uniformMatrix4fv(V01051N.loc.uM,false,m);gl.drawArrays(gl.TRIANGLES,0,6);V01051N.draws++;}
 gl.enable(gl.CULL_FACE);gl.useProgram(renderer.program);
}
const v01051NativeDrawBase=draw3D;draw3D=function(){v01051NativeDrawBase();v01051NativeDrawAprons();};

function v01051NativeTargets(){
 if(V01051N.ready||!industrial012.ready)return;
 // V0.10.5.1 texture door overlay is completely disabled. Kenney GLB geometry is the only visible garage door.
 V01051.ready=false;V01051.draws=0;V0105.facade=null;
 industrial012.chunks=industrial012.chunks.filter(c=>c.name!=='receiving-bays-and-hardstand');
 // Each selected main factory was already rotated so its Kenney road-facing facade points at the ground street.
 // Put the invisible receiving plane immediately in front of that native facade; do not add/replace a door.
 for(const t of industrial012.targets){
  const h=t.h,o=industrial012.placements.find(p=>p.h===h);if(!o)continue;
  const width=Math.min(Math.max(4.5,o.hw*1.05),7.2),front=o.hd+.10,depth=Math.max(2,Math.min(4,h.setback012||2.4));
  t.kind='bay';t.label='厂房库门';t.x=0;t.z=front+.08;t.w=width;t.d=depth;t.minY=.38;t.maxY=Math.min(4.7,Math.max(3.1,o.height*.55));t.back=front-.18;t.restZ=o.hd-.48;t.restY=.48;t.center=ind012World(h,[0,(t.minY+t.maxY)/2,t.z]);
  const g=t.gate;g.x=0;g.y=(t.minY+t.maxY)/2;g.w=width;g.h=t.maxY-t.minY;g.planeZ=t.z;g.center=t.center;g.type='door';g.broken=true;g.industrial=true;g.nativeDoor01051=true;
  h.deliveryLabel='厂房库门';
  V01051N.targets.push({num:h.num,model:o.name,trigger:[+t.x.toFixed(2),+t.minY.toFixed(2),+t.z.toFixed(2),+t.w.toFixed(2),+t.maxY.toFixed(2)],setback:+depth.toFixed(2)});
 }
 // Remove obsolete receiving-bay-specific colliders (bollards/window sill); building body colliders remain.
 industrial012.colliders=industrial012.colliders.filter(c=>!['bollard','dispatch-sill'].includes(c.label));
 V01051N.ready=true;
}
setTimeout(function waitNative(){if(!industrial012.ready){setTimeout(waitNative,60);return;}v01051NativeTargets();},60);
if(window.__deliveryTest)window.__deliveryTest.v01051Native=()=>({ready:V01051N.ready,targets:V01051N.targets,apronDraws:V01051N.draws,extraDoorModels:0,extraDoorTextures:0});

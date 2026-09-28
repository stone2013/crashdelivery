/* PocketGL — a small purpose-built, dependency-free WebGL renderer.
 * All models are real 3D triangles with depth testing, flat lighting and fog.
 * Copyright (c) 2026. MIT license; see licenses/PROJECT-MIT.txt.
 */
'use strict';
const V = {
 add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
 sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(...a),
 norm:a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);},
 lerp:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;
const M={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 multiply:(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;},
 model:(p=[0,0,0],r=[0,0,0])=>{
  const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const a=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
  const b=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
  const c=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
  const m=M.multiply(M.multiply(a,b),c);m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;
 },
 point:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
 normal:(m,p)=>V.norm([m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]]),
 perspective:(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);},
 look:(eye,at)=>{const z=V.norm(V.sub(eye,at)),x=V.norm(V.cross([0,1,0],z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);}
};
function rgb(h){if(Array.isArray(h))return h;h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);}
class MeshBuilder{
 constructor(){this.a=[];}
 triangle(a,b,c,col,transform=null){let n=V.norm(V.cross(V.sub(b,a),V.sub(c,a)));col=rgb(col);if(transform){a=M.point(transform,a);b=M.point(transform,b);c=M.point(transform,c);n=M.normal(transform,n);}for(const p of [a,b,c])this.a.push(...p,...n,...col);return this;}
 quad(a,b,c,d,col,m=null){this.triangle(a,b,c,col,m);this.triangle(a,c,d,col,m);return this;}
 box(w,h,d,col,p=[0,0,0],r=[0,0,0],parent=null){const m=parent?M.multiply(parent,M.model(p,r)):M.model(p,r),x=w/2,y=h/2,z=d/2;
  this.quad([-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],col,m);
  this.quad([x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],col,m);
  this.quad([x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z],col,m);
  this.quad([-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z],col,m);
  this.quad([-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z],col,m);
  this.quad([-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z],col,m);return this;
 }
 cylinder(r,h,n,col,p=[0,0,0],rot=[0,0,0],topR=r,parent=null){const m=parent?M.multiply(parent,M.model(p,rot)):M.model(p,rot);
  for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n,pa=[Math.cos(a)*r,-h/2,Math.sin(a)*r],pb=[Math.cos(b)*r,-h/2,Math.sin(b)*r],pc=[Math.cos(b)*topR,h/2,Math.sin(b)*topR],pd=[Math.cos(a)*topR,h/2,Math.sin(a)*topR];this.quad(pb,pa,pd,pc,col,m);this.triangle([0,h/2,0],pc,pd,col,m);this.triangle([0,-h/2,0],pa,pb,col,m);}return this;
 }
 poly(r,col,p=[0,0,0],s=[1,1,1],parent=null){const phi=(1+Math.sqrt(5))/2,verts=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(a=>V.norm(a).map((v,i)=>v*r*s[i]));const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],m=parent?M.multiply(parent,M.model(p)):M.model(p);faces.forEach(f=>this.triangle(...f.map(i=>verts[i]),col,m));return this;}
 roof(w,d,h,col,p,rot=[0,0,0],parent=null){const x=w/2,z=d/2,m=parent?M.multiply(parent,M.model(p,rot)):M.model(p,rot);this.triangle([-x,0,z],[x,0,z],[0,h,z],col,m);this.triangle([x,0,-z],[-x,0,-z],[0,h,-z],col,m);this.quad([-x,0,-z],[-x,0,z],[0,h,z],[0,h,-z],col,m);this.quad([0,h,-z],[0,h,z],[x,0,z],[x,0,-z],col,m);return this;}
}
class PocketGL{
 constructor(canvas){
  this.canvas=canvas;const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false})||canvas.getContext('experimental-webgl');if(!gl)throw new Error('此浏览器无法创建 WebGL 3D 画面。请用支持 WebGL 的浏览器打开，或开启硬件加速。');this.gl=gl;
  // V0.10.2: one warm sun, cool hemispherical fill; no per-lamp dynamic lights.
  const vs=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uVP;uniform mat4 uModel;varying vec3 vColor;varying vec3 vWorld;void main(){vec4 world=uModel*vec4(aPosition,1.);vec3 n=normalize(mat3(uModel)*aNormal);float hemi=clamp(n.y*.5+.5,0.,1.);vec3 fill=mix(vec3(.40,.405,.405),vec3(.62,.72,.82),hemi);float d=max(0.,dot(n,normalize(vec3(-.50,.78,.37))));vec3 sun=vec3(1.,.90,.74)*d*.62;vColor=aColor*(fill+sun);vWorld=world.xyz;gl_Position=uVP*world;}`;
  const fs=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vColor;varying vec3 vWorld;uniform float uAlpha;uniform float uShade;uniform vec3 uEye;void main(){float fog=smoothstep(150.,310.,length(vWorld-uEye));vec3 haze=vec3(.69,.79,.81);vec3 lit=vColor*mix(vec3(.78,.87,1.),vec3(1.),uShade)*uShade;gl_FragColor=vec4(mix(lit,haze,fog*.92),uAlpha);}`;
  const skyVs=`attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,1.,1.);}`;
  const skyFs=`precision mediump float;varying vec2 vUv;uniform vec2 uSunPosition;uniform float uSunVisible;uniform float uAspect;void main(){float y=vUv.y;vec3 lower=vec3(.55,.69,.72);vec3 horizon=vec3(.84,.84,.75);vec3 zenith=vec3(.25,.48,.70);vec3 sky=mix(lower,horizon,smoothstep(0.,.42,y));sky=mix(sky,zenith,smoothstep(.40,1.,y));float wave=sin(vUv.x*24.+sin(y*9.)*2.)+sin(vUv.x*13.-y*18.);float cloud=smoothstep(1.35,1.88,wave)*smoothstep(.18,.48,y)*(1.-smoothstep(.78,.94,y));sky=mix(sky,vec3(.94,.96,.94),cloud*.20);vec2 sunDelta=(vUv-uSunPosition)*vec2(uAspect,1.);float d=length(sunDelta);float glow=exp(-d*11.)*.15+exp(-d*42.)*.12;float disk=1.-smoothstep(.014,.019,d);sky+=vec3(1.,.76,.48)*glow*uSunVisible;sky=mix(sky,vec3(1.,.91,.72),disk*uSunVisible*.82);gl_FragColor=vec4(sky,1.);}`;
  function compile(type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;}
  this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.attrs=['aPosition','aNormal','aColor'].map(k=>gl.getAttribLocation(this.program,k));this.loc={};['uVP','uModel','uEye','uAlpha','uShade'].forEach(k=>this.loc[k]=gl.getUniformLocation(this.program,k));this.identity=M.identity();this.shade=1;
  this.skyProgram=gl.createProgram();gl.attachShader(this.skyProgram,compile(gl.VERTEX_SHADER,skyVs));gl.attachShader(this.skyProgram,compile(gl.FRAGMENT_SHADER,skyFs));gl.linkProgram(this.skyProgram);if(!gl.getProgramParameter(this.skyProgram,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.skyProgram));this.skyPosition=gl.getAttribLocation(this.skyProgram,'aPosition');this.skySunPosition=gl.getUniformLocation(this.skyProgram,'uSunPosition');this.skySunVisible=gl.getUniformLocation(this.skyProgram,'uSunVisible');this.skyAspect=gl.getUniformLocation(this.skyProgram,'uAspect');this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.52,.68,.75,1);
 }
 mesh(b,dynamic=false){const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.a),dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);return {buffer,count:b.a.length/9};}
 begin(eye,at,fov,w,h,dpr,drawSky=true){const gl=this.gl,W=Math.round(w*dpr),H=Math.round(h*dpr);if(this.canvas.width!==W||this.canvas.height!==H){this.canvas.width=W;this.canvas.height=H;}gl.viewport(0,0,W,H);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.eye=eye;this.at=at;this.fov=fov;this.w=w;this.h=h;this.dpr=dpr;
  if(drawSky){const forward=V.norm(V.sub(at,eye)),right=V.norm(V.cross(forward,[0,1,0])),up=V.cross(right,forward),sun=V.norm([-.50,.78,.37]),along=V.dot(sun,forward),tanY=Math.tan(fov/2),tanX=tanY*w/h,sx=along>.01?(.5+V.dot(sun,right)/(2*along*tanX)):.82,sy=along>.01?(.5+V.dot(sun,up)/(2*along*tanY)):.76;gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.useProgram(this.skyProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.enableVertexAttribArray(this.skyPosition);gl.vertexAttribPointer(this.skyPosition,2,gl.FLOAT,false,0,0);gl.uniform2f(this.skySunPosition,sx,sy);gl.uniform1f(this.skySunVisible,along>.01&&sx>0&&sx<1&&sy>0&&sy<1?1:0);gl.uniform1f(this.skyAspect,w/h);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);}
  this.vp=M.multiply(M.perspective(fov,w/h,.045,330),M.look(eye,at));gl.useProgram(this.program);gl.uniformMatrix4fv(this.loc.uVP,false,this.vp);gl.uniform3fv(this.loc.uEye,eye);gl.depthMask(true);}
 draw(mesh,model=this.identity,alpha=1){if(!mesh||!mesh.count)return;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);this.attrs.forEach((id,i)=>{gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,3,gl.FLOAT,false,36,i*12);});gl.uniformMatrix4fv(this.loc.uModel,false,model);gl.uniform1f(this.loc.uAlpha,alpha);gl.uniform1f(this.loc.uShade,this.shade??1);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
 project(p){const m=this.vp;if(!m)return null;const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(w<.1)return null;return {x:((m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w*.5+.5)*this.w,y:(.5-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w*.5)*this.h,w};}
 ray(x,y){const forward=V.norm(V.sub(this.at,this.eye)),right=V.norm(V.cross(forward,[0,1,0])),up=V.cross(right,forward),t=Math.tan(this.fov/2);return {o:this.eye,d:V.norm(V.add(forward,V.add(V.mul(right,(x/this.w*2-1)*t*this.w/this.h),V.mul(up,(1-y/this.h*2)*t))))};}
}

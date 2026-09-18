(function(root){
 'use strict';
 // Short playout buffer: never extrapolate through a wall or invent a hit.
 class SnapshotBuffer {
  constructor(delay=80){this.delay=delay;this.reset();}
  reset(){this.frames=[];this.offset=Infinity;this.lastTime=-Infinity;}
  push(model,time,now){
   if(!Number.isFinite(time))return;
   const last=this.frames[this.frames.length-1];
   if(last && time<=last.time)return;
   if(last && (model.mission!==last.model.mission || model.stageId!==last.model.stageId || now-last.arrival>1000))this.reset();
   this.offset=Math.min(this.offset,now-time);
   this.frames.push({model,time,arrival:now});
   if(this.frames.length>30)this.frames.shift();
  }
  sample(now){
   if(!this.frames.length)return null;
   const latest=this.frames[this.frames.length-1];
   const time=Math.max(this.lastTime,Math.min(latest.time,now-this.offset-this.delay));
   this.lastTime=time;
   while(this.frames.length>1 && this.frames[1].time<=time)this.frames.shift();
   const a=this.frames[0], b=this.frames[1];
   if(!b || time<=a.time)return a.model;
   const t=(time-a.time)/(b.time-a.time), result={...a.model};
   for(const key of ['tanks','bullets','sparks','explosions']){
    const byId=new Map(b.model[key].map(v=>[key==='tanks'?v.playerIndex:v.id,v]));
    result[key]=a.model[key].map(v=>{
     const w=byId.get(key==='tanks'?v.playerIndex:v.id);
     if(!w || v.alive!==w.alive)return v;
     // A ricochet is a direction discontinuity; hold it until the next sample.
     if(key==='bullets' && (v.vx!==w.vx || v.vy!==w.vy))return v;
     const out={...v};
     for(const prop of ['x','y','radius','age','life'])if(Number.isFinite(v[prop]) && Number.isFinite(w[prop]))out[prop]=v[prop]+(w[prop]-v[prop])*t;
     for(const prop of ['bodyAngle','turretAngle'])if(Number.isFinite(v[prop]) && Number.isFinite(w[prop]))out[prop]=v[prop]+Math.atan2(Math.sin(w[prop]-v[prop]),Math.cos(w[prop]-v[prop]))*t;
     return out;
    });
   }
   return result;
  }
 }
 if(typeof module==='object' && module.exports)module.exports=SnapshotBuffer;
 else root.BoxSnapshotBuffer=SnapshotBuffer;
})(typeof window==='object'?window:globalThis);

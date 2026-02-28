import { normalizePointCloud } from './projection.js';

// Module: js/embedding/force-layout.js
// 3D spring-charge force-directed layout for refining UMAP positions
// using LLM-identified semantic relationships as springs.

const ITERATIONS=80;
const INITIAL_ALPHA=0.25;
const ALPHA_DECAY=0.975;
const REPULSION_K=0.08;
const ATTRACTION_K=0.15;
const TARGET_EDGE_LEN=0.4;
const MIN_DIST=0.05;

export function refinePositionsWithEdges(points,edges,termIndex){
  const n=points.length;
  if(n<2) return points.map(p=>[...p]);

  const edgePairs=[];
  for(const edge of edges){
    const idxA=termIndex.get(String(edge.term_a||"").toLowerCase().trim());
    const idxB=termIndex.get(String(edge.term_b||"").toLowerCase().trim());
    if(idxA===undefined||idxB===undefined||idxA===idxB) continue;
    const strength=Math.max(0,Math.min(1,Number(edge.strength)||0.5));
    const restLen=TARGET_EDGE_LEN*(1.0-strength*0.5);
    edgePairs.push({i:idxA,j:idxB,restLen,strength});
  }

  const pos=points.map(p=>[p[0]||0,p[1]||0,p[2]||0]);
  const forces=new Array(n);
  let alpha=INITIAL_ALPHA;

  for(let iter=0;iter<ITERATIONS;iter++){
    for(let i=0;i<n;i++) forces[i]=[0,0,0];

    // Repulsion: all pairs
    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const dx=pos[j][0]-pos[i][0];
        const dy=pos[j][1]-pos[i][1];
        const dz=pos[j][2]-pos[i][2];
        const dist=Math.max(Math.hypot(dx,dy,dz),MIN_DIST);
        const repulse=REPULSION_K/(dist*dist);
        const ux=dx/dist,uy=dy/dist,uz=dz/dist;
        forces[i][0]-=repulse*ux;forces[i][1]-=repulse*uy;forces[i][2]-=repulse*uz;
        forces[j][0]+=repulse*ux;forces[j][1]+=repulse*uy;forces[j][2]+=repulse*uz;
      }
    }

    // Attraction: spring forces for LLM edges
    for(const pair of edgePairs){
      const dx=pos[pair.j][0]-pos[pair.i][0];
      const dy=pos[pair.j][1]-pos[pair.i][1];
      const dz=pos[pair.j][2]-pos[pair.i][2];
      const dist=Math.max(Math.hypot(dx,dy,dz),MIN_DIST);
      const displacement=dist-pair.restLen;
      const attract=ATTRACTION_K*pair.strength*displacement;
      const ux=dx/dist,uy=dy/dist,uz=dz/dist;
      forces[pair.i][0]+=attract*ux;forces[pair.i][1]+=attract*uy;forces[pair.i][2]+=attract*uz;
      forces[pair.j][0]-=attract*ux;forces[pair.j][1]-=attract*uy;forces[pair.j][2]-=attract*uz;
    }

    // Apply forces with cooling
    for(let i=0;i<n;i++){
      pos[i][0]+=forces[i][0]*alpha;
      pos[i][1]+=forces[i][1]*alpha;
      pos[i][2]+=forces[i][2]*alpha;
    }
    alpha*=ALPHA_DECAY;
  }

  return normalizePointCloud(pos,1.45);
}

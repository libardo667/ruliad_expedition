import { DISCS, TERMS } from '../core/state.js';
import { callLLMJSON } from '../api/llm.js';
import { extractJSON } from '../api/json-recovery.js';
import { buildRelationshipSystemPrompt, buildRelationshipUserPrompt } from '../prompt/prompt-builders.js';
// Module: js/embedding/semantic-edges.js
// LLM-based semantic relationship extraction between terms.

const VALID_TYPES=new Set(["analogical","causal","contradictory","complementary","hierarchical","instantiates"]);
const BATCH_THRESHOLD=50;
const OVERLAP=10;

export function buildTermIndex(terms){
  const idx=new Map();
  for(let i=0;i<terms.length;i++){
    idx.set(terms[i].label.toLowerCase().trim(),i);
  }
  return idx;
}

export function normalizeRelationships(rawRelationships,termIndex){
  const seen=new Set();
  const out=[];
  for(const rel of (rawRelationships||[])){
    const a=String(rel?.term_a||"").trim();
    const b=String(rel?.term_b||"").trim();
    if(!a||!b||a.toLowerCase()===b.toLowerCase()) continue;
    if(!termIndex.has(a.toLowerCase())||!termIndex.has(b.toLowerCase())) continue;
    const type=VALID_TYPES.has(rel?.type)?rel.type:"complementary";
    const strength=Math.max(0,Math.min(1,Number(rel?.strength)||0.5));
    const rationale=String(rel?.rationale||"").trim().slice(0,200);
    const key=[a.toLowerCase(),b.toLowerCase()].sort().join("|||")+"|||"+type;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push({term_a:a,term_b:b,strength,type,rationale});
  }
  return out;
}

async function callRelationshipBatch(target,batchTerms,allDiscs,quality,cfg){
  const system=buildRelationshipSystemPrompt();
  const user=buildRelationshipUserPrompt(target,batchTerms,allDiscs,quality);
  const batchCfg={...cfg,__tempOverride:0,__maxTokens:3000};
  const raw=await callLLMJSON(system,user,batchCfg);
  const parsed=extractJSON(raw);
  return Array.isArray(parsed?.relationships)?parsed.relationships:[];
}

export async function extractSemanticEdges(target,cfg,quality){
  const terms=TERMS;
  const discs=DISCS;
  if(!terms.length) return null;

  const termIndex=buildTermIndex(terms);
  let allRawRelationships=[];

  if(terms.length<=BATCH_THRESHOLD){
    allRawRelationships=await callRelationshipBatch(target,terms,discs,quality,cfg);
  }else if(terms.length<=100){
    const mid=Math.floor(terms.length/2);
    const batch1=terms.slice(0,mid+OVERLAP);
    const batch2=terms.slice(mid-OVERLAP);
    const [r1,r2]=await Promise.all([
      callRelationshipBatch(target,batch1,discs,quality,cfg),
      callRelationshipBatch(target,batch2,discs,quality,cfg)
    ]);
    allRawRelationships=[...r1,...r2];
  }else{
    const third=Math.floor(terms.length/3);
    const batch1=terms.slice(0,third+OVERLAP);
    const batch2=terms.slice(third-OVERLAP,2*third+OVERLAP);
    const batch3=terms.slice(2*third-OVERLAP);
    const [r1,r2,r3]=await Promise.all([
      callRelationshipBatch(target,batch1,discs,quality,cfg),
      callRelationshipBatch(target,batch2,discs,quality,cfg),
      callRelationshipBatch(target,batch3,discs,quality,cfg)
    ]);
    allRawRelationships=[...r1,...r2,...r3];
  }

  const relationships=normalizeRelationships(allRawRelationships,termIndex);

  return {
    relationships,
    generatedAt:new Date().toISOString(),
    termCount:terms.length,
    batchCount:terms.length<=BATCH_THRESHOLD?1:(terms.length<=100?2:3)
  };
}

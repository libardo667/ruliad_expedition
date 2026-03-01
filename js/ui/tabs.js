import { LAST_RUN, TERMS, activeTab, isGenerating, plotInited, setActiveTab, setZenModeEnabled, zenModeEnabled } from '../core/state.js';
import { TAB_ORDER, dashboardPanelEl, dashboardTabBtn, explorePanelEl, exploreTabBtn, landingEl, lensPanelEl, lensTabBtn, plotPanelEl, plotTabBtn, vizEl } from '../core/refs.js';
import { showToast } from './notifications.js';
import { refreshArtifactList, setArtifactDrawer, setExportMenu } from './artifact-drawer-ui.js';
import { renderPlot } from '../plot/plot-render.js';

// Module: js/ui/tabs.js

export function updateZenModeUI(){const zenActive=Boolean(zenModeEnabled&&activeTab==="plot"&&!isGenerating);document.body.classList.toggle("plot-zen",zenActive);const btn=document.getElementById("zen-mode-btn");if(btn){btn.textContent=zenActive?"EXIT ZEN":"ZEN MODE";btn.setAttribute("aria-pressed",zenActive?"true":"false");btn.title=zenActive?"Restore top menu and left panel":"Hide top menu and left panel for cinematic capture";}}

export function toggleZenMode(){setZenModeEnabled(!zenModeEnabled);updateZenModeUI();if(plotInited&&activeTab==="plot"&&!isGenerating){requestAnimationFrame(()=>{try{Plotly.Plots.resize(document.getElementById("plot"));}catch{}});}}

export function tabNameForButton(btn){if(!btn) return "landing";if(btn.id==="tab-explore-btn") return "explore";if(btn.id==="tab-lens-btn") return "lens";if(btn.id==="tab-plot-btn") return "plot";if(btn.id==="tab-dashboard-btn") return "dashboard";return "landing";}

export function buttonForTabName(name){if(name==="explore") return exploreTabBtn;if(name==="lens") return lensTabBtn;if(name==="plot") return plotTabBtn;if(name==="dashboard") return dashboardTabBtn;return null;}

export function setPanelVisibility(el,visible,displayStyle){if(!el) return;el.hidden=!visible;el.setAttribute("aria-hidden",visible?"false":"true");el.style.display=visible?displayStyle:"none";}

export function updateTabState(activeName){for(const btn of TAB_ORDER){const selected=tabNameForButton(btn)===activeName;btn.classList.toggle("active",selected);btn.setAttribute("aria-selected",selected?"true":"false");btn.tabIndex=selected?0:-1;}}

export function focusTabTarget(activeName){
  if(activeName==="explore"){const focusEl=document.getElementById("target-input");if(focusEl) focusEl.focus();return;}
  if(activeName==="lens"){const focusEl=document.getElementById("seed-url-input");if(focusEl) focusEl.focus();return;}
  if(activeName==="plot"){const plotEl=document.getElementById("plot");if(plotEl){plotEl.setAttribute("tabindex","-1");plotEl.focus();}return;}
}

export function moveTabFocus(currentBtn,delta){const idx=TAB_ORDER.indexOf(currentBtn);if(idx===-1||!TAB_ORDER.length) return;const next=(idx+delta+TAB_ORDER.length)%TAB_ORDER.length;TAB_ORDER[next]?.focus();}

export function initTabAccessibility(){for(const btn of TAB_ORDER){btn.addEventListener("click",()=>switchMainTab(tabNameForButton(btn),{focusTarget:true}));btn.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){e.preventDefault();moveTabFocus(btn,1);return;}if(e.key==="ArrowLeft"){e.preventDefault();moveTabFocus(btn,-1);return;}if(e.key==="Home"){e.preventDefault();TAB_ORDER[0]?.focus();return;}if(e.key==="End"){e.preventDefault();TAB_ORDER[TAB_ORDER.length-1]?.focus();return;}if(e.key==="Enter"||e.key===" "){e.preventDefault();switchMainTab(tabNameForButton(btn),{focusTarget:true});}});}}

export function switchMainTab(tab,{silent=false,focusTarget=true}={}){
  const target=["explore","lens","plot","dashboard"].includes(tab)?tab:"landing";

  // Guards
  if(target==="plot"&&!isGenerating&&!plotInited&&!TERMS.length){if(!silent) showToast("No plot yet. Run an analysis first.");return;}
  if(target==="dashboard"&&!LAST_RUN&&!isGenerating){if(!silent) showToast("No results yet. Run an analysis first.");return;}

  setActiveTab(target);
  updateTabState(activeTab);

  // Hide everything first
  setPanelVisibility(landingEl,false,"flex");
  setPanelVisibility(explorePanelEl,false,"flex");
  setPanelVisibility(lensPanelEl,false,"flex");
  setPanelVisibility(plotPanelEl,false,"flex");
  setPanelVisibility(vizEl,false,"flex");
  setPanelVisibility(dashboardPanelEl,false,"flex");
  setArtifactDrawer(false);setExportMenu(false);

  if(activeTab==="landing"){
    setPanelVisibility(landingEl,true,"flex");
    landingEl.classList.add("mode-landing");
    updateZenModeUI();
    return;
  }
  // Remove landing class when not on landing
  landingEl.classList.remove("mode-landing");

  if(activeTab==="explore"){
    setPanelVisibility(explorePanelEl,true,"flex");
    updateZenModeUI();
    if(focusTarget) focusTabTarget("explore");
    return;
  }
  if(activeTab==="lens"){
    setPanelVisibility(lensPanelEl,true,"flex");
    updateZenModeUI();
    if(focusTarget) focusTabTarget("lens");
    return;
  }
  if(activeTab==="dashboard"){
    setPanelVisibility(dashboardPanelEl,true,"flex");
    updateZenModeUI();
    return;
  }
  // plot tab
  setPanelVisibility(plotPanelEl,true,"flex");
  setPanelVisibility(vizEl,true,"flex");
  refreshArtifactList();
  if(plotInited){requestAnimationFrame(()=>{try{Plotly.Plots.resize(document.getElementById("plot"));renderPlot();}catch(err){console.warn("Plot resize failed:",err);}});}
  updateZenModeUI();
  if(focusTarget) focusTabTarget("plot");
}

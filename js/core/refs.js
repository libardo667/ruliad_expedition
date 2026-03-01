// Module: js/core/refs.js

export const discInputsEl=document.getElementById("disc-inputs");

export const landingEl=document.getElementById("setup");

export const explorePanelEl=document.getElementById("explore-panel");

export const lensPanelEl=document.getElementById("lens-panel");

export const plotPanelEl=document.getElementById("plot-panel");

export const vizEl=document.getElementById("viz");

export const exploreTabBtn=document.getElementById("tab-explore-btn");

export const lensTabBtn=document.getElementById("tab-lens-btn");

export const plotTabBtn=document.getElementById("tab-plot-btn");

export const dashboardPanelEl=document.getElementById("dashboard-panel");

export const dashboardTabBtn=document.getElementById("tab-dashboard-btn");

export const TAB_ORDER=[exploreTabBtn,lensTabBtn,plotTabBtn,dashboardTabBtn].filter(Boolean);

export const themeSelectGlobalEl=document.getElementById("theme-select-global");

// All refs are const DOM nodes — no setters needed; importers receive the live binding.

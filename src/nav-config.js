import CurvedPanelPage from "./tabs/CurvedPanel.jsx";
import GussetPage from "./tabs/Gusset.jsx";
import TaperedPanelsPage from "./tabs/TaperedPanels.jsx";
import ShapedBottomsPage from "./tabs/ShapedBottoms.jsx";
import BoxedBottomsPage from "./tabs/BoxedBottoms.jsx";
import FoldedBottomsPage from "./tabs/FoldedBottoms.jsx";
import PipingPage from "./tabs/Piping.jsx";
import AccordionPocketPage from "./tabs/AccordionPocket.jsx";
import ZipperPocketPage from "./tabs/ZipperPocket.jsx";
import WeltPocketPage from "./tabs/WeltPocket.jsx";
import HandlesStrapsPage from "./tabs/HandlesStraps.jsx";
import PurseFeetPage from "./tabs/PurseFeet.jsx";
import RivetGuidesPage from "./tabs/RivetGuides.jsx";
import ZipperPouchPage from "./tabs/ZipperPouch.jsx";
import GroceryTotePage from "./tabs/GroceryTote.jsx";

// Data-driven nav: adding a tab = one entry here (plus its file in src/tabs/).
// Colors reference the per-group token families defined in moonshot.css
// (--sp-, --bc-, --tp-, --hh-, --cb-) per the Pass 6 color system.
export const NAV_GROUPS = [
  {
    id:"sides-panels", label:"Sides & Panels", color:"var(--sp-violet)",
    pages:[
      {id:"curved-panel", label:"Curved Panels", color:"var(--sp-violet)", component:CurvedPanelPage},
      {id:"gusset", label:"Gussets", color:"var(--sp-plum)", component:GussetPage},
      {id:"tapered-panels", label:"Tapered Panels", color:"var(--sp-lavender)", component:TaperedPanelsPage, coming:true},
    ],
  },
  {
    id:"bottoms", label:"Bottoms", color:"var(--bc-pumpkin)",
    pages:[
      {id:"shaped-bottoms", label:"Shaped Bottoms", color:"var(--bc-amber)", component:ShapedBottomsPage},
      {id:"boxed-bottoms", label:"Boxed Bottoms", color:"var(--bc-pumpkin)", component:BoxedBottomsPage},
      {id:"folded-bottoms", label:"Folded Bottoms", color:"var(--bc-ochre)", component:FoldedBottomsPage, coming:true},
    ],
  },
  {
    id:"trims-pockets", label:"Trims & Pockets", color:"var(--tp-moss)",
    pages:[
      {id:"piping", label:"Piping", color:"var(--tp-forest)", component:PipingPage},
      {id:"accordion", label:"Accordion Pocket", color:"var(--tp-sage)", component:AccordionPocketPage},
      {id:"zipper-pocket", label:"Zipper Pocket", color:"var(--tp-moss)", component:ZipperPocketPage, coming:true},
      {id:"welt-pocket", label:"Welt Pocket", color:"var(--tp-muted)", component:WeltPocketPage, coming:true},
    ],
  },
  {
    id:"handles-hardware", label:"Handles & Hardware", color:"var(--hh-denim)",
    pages:[
      {id:"handles-straps", label:"Handles & Straps", color:"var(--hh-slate)", component:HandlesStrapsPage, coming:true},
      {id:"purse-feet", label:"Purse Feet Placement", color:"var(--hh-denim)", component:PurseFeetPage, coming:true},
      {id:"rivet-guides", label:"Rivet Guides", color:"var(--hh-indigo)", component:RivetGuidesPage, coming:true},
    ],
  },
  {
    id:"complete-bags", label:"Complete Bags", color:"var(--cb-maroon)",
    pages:[
      {id:"zipper-pouch", label:"Two Panel Zipper Pouch", color:"var(--cb-maroon)", component:ZipperPouchPage, coming:true},
      {id:"grocery-tote", label:"Grocery Tote", color:"var(--cb-burgundy)", component:GroceryTotePage, coming:true},
    ],
  },
];

export function navGroupForPage(pageId) {
  return NAV_GROUPS.find(group => group.pages.some(item => item.id === pageId)) || NAV_GROUPS[0];
}

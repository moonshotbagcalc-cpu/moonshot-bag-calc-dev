import SimpleBottomPage from "./tabs/SimpleBottom.jsx";
import RectangularPanelPage from "./tabs/RectangularPanel.jsx";
import CurvedPanelPage from "./tabs/CurvedPanel.jsx";
import TaperedPanelPage from "./tabs/TaperedPanel.jsx";
import BoxedBottomsPage from "./tabs/BoxedBottoms.jsx";
import GussetPage from "./tabs/Gusset.jsx";

import AccordionPocketPage from "./tabs/AccordionPocket.jsx";
import ZipperPocketPage from "./tabs/ZipperPocket.jsx";
import WeltPocketPage from "./tabs/WeltPocket.jsx";
import TissuePocketPage from "./tabs/TissuePocket.jsx";
import PipingPage from "./tabs/Piping.jsx";
import ZipperOverlaysPage from "./tabs/ZipperOverlays.jsx";

import HandlesPage from "./tabs/Handles.jsx";
import CrossbodyStrapPage from "./tabs/CrossbodyStrap.jsx";
import PurseFeetGuidePage from "./tabs/PurseFeetGuide.jsx";
import RivetGuidePage from "./tabs/RivetGuide.jsx";

import FlatZipperPouchPage from "./tabs/FlatZipperPouch.jsx";
import ShoppingBagPage from "./tabs/ShoppingBag.jsx";

// Data-driven nav: adding a tab = one entry here (plus its file in src/tabs/).
// Colors reference the per-group token families defined in moonshot.css
// (--sp-, --bc-, --tp-, --hh-, --cb-) per the Pass 6 color system.
// 4-group structure established in Pass 7 — see CLAUDE.md "Navigation Structure".
export const NAV_GROUPS = [
  {
    id:"bag-structures", label:"Bag Structures", color:"var(--sp-plum)",
    pages:[
      {id:"simple-bottom", label:"Simple Bottom", color:"var(--sp-plum)", component:SimpleBottomPage, coming:true},
      {id:"rectangular-panel", label:"Rectangular Panel", color:"var(--sp-plum)", component:RectangularPanelPage, coming:true},
      {id:"curved-panel", label:"Curved Panel", color:"var(--sp-plum)", component:CurvedPanelPage},
      {id:"tapered-panel", label:"Tapered Panel", color:"var(--sp-plum)", component:TaperedPanelPage, coming:true},
      {id:"boxed-bottom", label:"Boxed Bottom", color:"var(--sp-plum)", component:BoxedBottomsPage},
      {id:"gussets", label:"Gussets", color:"var(--sp-plum)", component:GussetPage},
    ],
  },
  {
    id:"trim-pockets", label:"Trim & Pockets", color:"var(--bc-pumpkin)",
    pages:[
      {id:"accordion", label:"Accordion Pocket", color:"var(--bc-pumpkin)", component:AccordionPocketPage},
      {id:"zipper-pocket", label:"Zipper Pocket", color:"var(--bc-pumpkin)", component:ZipperPocketPage, coming:true},
      {id:"welt-pocket", label:"Welt Pocket", color:"var(--bc-pumpkin)", component:WeltPocketPage, coming:true},
      {id:"tissue-pocket", label:"Tissue Pocket", color:"var(--bc-pumpkin)", component:TissuePocketPage, coming:true},
      {id:"piping", label:"Piping", color:"var(--bc-pumpkin)", component:PipingPage},
      {id:"zipper-overlays", label:"Zipper Overlays", color:"var(--bc-pumpkin)", component:ZipperOverlaysPage, coming:true},
    ],
  },
  {
    id:"handles-hardware", label:"Handles & Hardware", color:"var(--hh-denim)",
    pages:[
      {id:"handles", label:"Handles", color:"var(--hh-denim)", component:HandlesPage, coming:true},
      {id:"crossbody-strap", label:"Crossbody Strap", color:"var(--hh-denim)", component:CrossbodyStrapPage, coming:true},
      {id:"purse-feet", label:"Purse Feet Guide", color:"var(--hh-denim)", component:PurseFeetGuidePage, coming:true},
      {id:"rivet-guide", label:"Rivet Guide", color:"var(--hh-denim)", component:RivetGuidePage, coming:true},
    ],
  },
  {
    id:"basic-bags", label:"Basic Bags", color:"var(--tp-moss)",
    pages:[
      {id:"flat-zipper-pouch", label:"Flat Zipper Pouch", color:"var(--tp-moss)", component:FlatZipperPouchPage, coming:true},
      {id:"shopping-bag", label:"Shopping Bag", color:"var(--tp-moss)", component:ShoppingBagPage, coming:true},
    ],
  },
];

export function navGroupForPage(pageId) {
  return NAV_GROUPS.find(group => group.pages.some(item => item.id === pageId)) || NAV_GROUPS[0];
}

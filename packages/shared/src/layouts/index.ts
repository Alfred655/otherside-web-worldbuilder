export type {
  CoverCluster,
  WallLine,
  TemplateDecoration,
  EnemyHint,
  PickupHint,
  LayoutTemplateDef,
} from "./types.js";

import type { LayoutTemplateDef } from "./types.js";
import { warehouseTemplate } from "./warehouse.js";
import { courtyardTemplate } from "./courtyard.js";
import { corridorsTemplate } from "./corridors.js";
import { rooftopTemplate } from "./rooftop.js";
import { bunkerTemplate } from "./bunker.js";

export { warehouseTemplate } from "./warehouse.js";
export { courtyardTemplate } from "./courtyard.js";
export { corridorsTemplate } from "./corridors.js";
export { rooftopTemplate } from "./rooftop.js";
export { bunkerTemplate } from "./bunker.js";

export const LAYOUT_TEMPLATES: Record<string, LayoutTemplateDef> = {
  warehouse: warehouseTemplate,
  courtyard: courtyardTemplate,
  corridors: corridorsTemplate,
  rooftop: rooftopTemplate,
  bunker: bunkerTemplate,
};

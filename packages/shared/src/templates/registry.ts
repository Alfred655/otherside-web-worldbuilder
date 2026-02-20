import { ShooterSpecSchema } from "../schemas/shooter.js";
import type { z } from "zod";

export const TEMPLATES = {
  shooter: {
    id: "shooter" as const,
    name: "Shooter",
    description: "Fast-paced FPS with weapons and combat",
    schema: ShooterSpecSchema,
  },
} as const;

export type TemplateId = keyof typeof TEMPLATES;
export type TemplateSpec = z.infer<(typeof TEMPLATES)[TemplateId]["schema"]>;

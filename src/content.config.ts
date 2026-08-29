import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// One shared schema across the four lanes (INTERFACES §3). Astro validates every
// entry at build time and fails the build with the offending file + field.
const maturity = z.enum(['seedling', 'growing', 'evergreen']).default('seedling');
const base = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  maturity,
  tags: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).default([]),
  draft: z.boolean().default(false),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
  aliases: z.array(z.string().startsWith('/')).default([]),
});
const project = base.extend({
  status: z.enum(['live', 'in-progress', 'private', 'archived']),
  url: z.string().url().optional(),
  featured: z.number().int().min(1).max(3).optional(),
});

const lane = (name: string) => glob({ pattern: '**/*.md', base: `./src/content/${name}` });

export const collections = {
  writing: defineCollection({ loader: lane('writing'), schema: base }),
  projects: defineCollection({ loader: lane('projects'), schema: project }),
  notes: defineCollection({ loader: lane('notes'), schema: base }),
  playbooks: defineCollection({ loader: lane('playbooks'), schema: base }),
};

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const builds = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/builds' }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    subtitle: z.string(),
    league: z.string(),
    updated: z.string(),
    content: z.record(z.string(), z.any()),
  }),
});

export const collections = { builds };

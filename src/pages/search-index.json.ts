import type { APIRoute } from 'astro';
import { guides } from '../lib/guide';
import { contentPath, normalizeTags, searchableText } from '../lib/search';
import { buildDetails } from '../lib/build';

export const GET: APIRoute = () => new Response(JSON.stringify(guides.map((guide) => ({
  slug: guide.slug, title: guide.title, subtitle: guide.subtitle, ...buildDetails(guide), updated: guide.updated,
  kind: guide.kind ?? 'build', tags: normalizeTags(guide.tags ?? []), text: searchableText(guide.content), path: contentPath(guide),
}))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });

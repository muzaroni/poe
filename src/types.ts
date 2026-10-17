import type { JSONContent } from '@tiptap/core';

export type Guide = {
  kind?: 'build' | 'article';
  tags?: string[];
  slug: string;
  title: string;
  subtitle: string;
  league: string;
  ascendancy?: string;
  updated: string;
  content: JSONContent;
};

export type GemColor = 'red' | 'green' | 'blue';

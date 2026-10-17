import type { JSONContent } from '@tiptap/core';

export type Guide = {
  slug: string;
  title: string;
  subtitle: string;
  league: string;
  updated: string;
  content: JSONContent;
};

export type GemColor = 'red' | 'green' | 'blue';

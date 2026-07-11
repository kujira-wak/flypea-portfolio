import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const learningLog = defineCollection({
  loader: glob({ base: "./src/content/learningLog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const works = defineCollection({
  loader: glob({ base: "./src/content/works", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.string(),
    order: z.number().int().default(0),
    tags: z.array(z.string()).default([]),
    url: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  learningLog,
  works,
};

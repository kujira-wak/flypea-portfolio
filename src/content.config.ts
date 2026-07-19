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
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        status: z.enum(["公開中", "整備中", "計画中"]),
        order: z.number().int().default(0),
        featured: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        role: z.string().optional(),
        period: z.string().optional(),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        liveUrl: z.url().optional(),
        repositoryUrl: z.url().optional(),
        draft: z.boolean().default(false),
      })
      .refine(({ cover, coverAlt }) => !cover || Boolean(coverAlt?.trim()), {
        message: "coverを指定する場合はcoverAltも入力してください。",
        path: ["coverAlt"],
      }),
});

export const collections = {
  learningLog,
  works,
};

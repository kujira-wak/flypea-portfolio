import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { SHELF_KIND_IDS, STATUS_IDS, TECHNOLOGY_IDS, TOPIC_IDS } from "./data/taxonomy";

const commonFields = {
  title: z.string().min(1),
  description: z.string().min(1),
  topics: z.array(z.enum(TOPIC_IDS)).default([]),
  technologies: z.array(z.enum(TECHNOLOGY_IDS)).default([]),
  status: z.enum(STATUS_IDS),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  updatedAt: z.coerce.date().optional(),
};

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z
      .object({
        ...commonFields,
        type: z.literal("project"),
        startedAt: z.coerce.date(),
        period: z.string().optional(),
        role: z.string().optional(),
        order: z.number().int().default(0),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        liveUrl: z.url().optional(),
        repositoryUrl: z.url().optional(),
      })
      .refine(({ cover, coverAlt }) => !cover || Boolean(coverAlt?.trim()), {
        message: "coverを指定する場合はcoverAltも入力してください。",
        path: ["coverAlt"],
      }),
});

const notes = defineCollection({
  loader: glob({ base: "./src/content/notes", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z
      .object({
        ...commonFields,
        type: z.literal("note"),
        publishedAt: z.coerce.date(),
        reactionId: z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .max(80),
        cover: image().optional(),
        coverAlt: z.string().optional(),
      })
      .refine(({ cover, coverAlt }) => !cover || Boolean(coverAlt?.trim()), {
        message: "coverを指定する場合はcoverAltも入力してください。",
        path: ["coverAlt"],
      }),
});

const shelf = defineCollection({
  loader: glob({ base: "./src/content/shelf", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z
      .object({
        ...commonFields,
        type: z.literal("shelf"),
        kind: z.enum(SHELF_KIND_IDS),
        addedAt: z.coerce.date(),
        creator: z.string().optional(),
        externalUrl: z.url().optional(),
        cover: image().optional(),
        coverAlt: z.string().optional(),
      })
      .refine(({ cover, coverAlt }) => !cover || Boolean(coverAlt?.trim()), {
        message: "coverを指定する場合はcoverAltも入力してください。",
        path: ["coverAlt"],
      }),
});

export const collections = { projects, notes, shelf };

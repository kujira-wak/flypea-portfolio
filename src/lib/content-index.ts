import { type CollectionEntry, getCollection } from "astro:content";
import type { ContentTypeId, StatusId, TechnologyId, TopicId } from "../data/taxonomy";

export interface IndexEntry {
  id: string;
  type: ContentTypeId;
  title: string;
  description: string;
  href: string;
  date: Date;
  topics: TopicId[];
  technologies: TechnologyId[];
  status: StatusId;
  reactionId?: string;
}

export const projectToIndexEntry = (entry: CollectionEntry<"projects">): IndexEntry => ({
  id: entry.id,
  type: "project",
  title: entry.data.title,
  description: entry.data.description,
  href: `/projects/${entry.id}/`,
  date: entry.data.updatedAt ?? entry.data.startedAt,
  topics: [...entry.data.topics],
  technologies: [...entry.data.technologies],
  status: entry.data.status,
});

export const noteToIndexEntry = (entry: CollectionEntry<"notes">): IndexEntry => ({
  id: entry.id,
  type: "note",
  title: entry.data.title,
  description: entry.data.description,
  href: `/notes/${entry.id}/`,
  date: entry.data.updatedAt ?? entry.data.publishedAt,
  topics: [...entry.data.topics],
  technologies: [...entry.data.technologies],
  status: entry.data.status,
  reactionId: entry.data.reactionId,
});

export const shelfToIndexEntry = (entry: CollectionEntry<"shelf">): IndexEntry => ({
  id: entry.id,
  type: "shelf",
  title: entry.data.title,
  description: entry.data.description,
  href: `/shelf/${entry.id}/`,
  date: entry.data.updatedAt ?? entry.data.addedAt,
  topics: [...entry.data.topics],
  technologies: [...entry.data.technologies],
  status: entry.data.status,
});

export async function getAllIndexEntries(): Promise<IndexEntry[]> {
  const [projects, notes, shelf] = await Promise.all([
    getCollection("projects", ({ data }) => !data.draft),
    getCollection("notes", ({ data }) => !data.draft),
    getCollection("shelf", ({ data }) => !data.draft),
  ]);

  return [
    ...projects.map(projectToIndexEntry),
    ...notes.map(noteToIndexEntry),
    ...shelf.map(shelfToIndexEntry),
  ].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

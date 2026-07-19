import taxonomy from "./taxonomy.json";

type TaxonomyEntry = {
  label: string;
  description: string;
};

const keys = <T extends Record<string, TaxonomyEntry>>(record: T) =>
  Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];

export const topics = taxonomy.topics;
export const technologies = taxonomy.technologies;
export const statuses = taxonomy.statuses;
export const contentTypes = taxonomy.contentTypes;
export const shelfKinds = taxonomy.shelfKinds;

export type TopicId = keyof typeof topics;
export type TechnologyId = keyof typeof technologies;
export type StatusId = keyof typeof statuses;
export type ContentTypeId = keyof typeof contentTypes;
export type ShelfKindId = keyof typeof shelfKinds;

export const TOPIC_IDS = keys(topics);
export const TECHNOLOGY_IDS = keys(technologies);
export const STATUS_IDS = keys(statuses);
export const CONTENT_TYPE_IDS = keys(contentTypes);
export const SHELF_KIND_IDS = keys(shelfKinds);

export const taxonomyPath = {
  type: (id: ContentTypeId) => `/index/type/${id}/`,
  topic: (id: TopicId) => `/index/topic/${id}/`,
  technology: (id: TechnologyId) => `/index/technology/${id}/`,
  status: (id: StatusId) => `/index/status/${id}/`,
} as const;

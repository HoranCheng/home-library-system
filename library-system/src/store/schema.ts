import type { Book } from "../domain/book";

export const STORAGE_KEYS = {
  books: "lib:books:v1",
  isbnIndex: "lib:index:isbn:v1",
  fpIndex: "lib:index:fp:v1",
  meta: "lib:meta:v1",
  homeMode: "lib:home:mode:v1"
} as const;

export type LibraryMeta = {
  schemaVersion: number;
  updatedAt: string;
};

export type LibraryState = {
  books: Book[];
  meta: LibraryMeta;
};

export const DEFAULT_STATE: LibraryState = {
  books: [],
  meta: { schemaVersion: 1, updatedAt: new Date(0).toISOString() }
};

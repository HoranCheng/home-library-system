export type BookStatus = "in_library" | "to_be_sorted";

export type Book = {
  id: string;
  title: string;
  authors: string[];
  isbn13?: string;
  isbn10?: string;
  edition?: string;
  publisher?: string;
  publishedDate?: string;
  tags?: string[];
  coverUrl?: string;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookInput = Omit<Book, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

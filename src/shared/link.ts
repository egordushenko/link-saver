export type Link = {
  id: string;
  isFavorite: boolean;
  normalizedUrl: string;
  savedAt: string;
  title: string;
  url: string;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};


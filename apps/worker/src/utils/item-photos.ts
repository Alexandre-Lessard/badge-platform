type PhotoLike = {
  url: string;
  isPrimary: boolean;
};

type PhotoWithCreatedAt<T extends PhotoLike> = T & {
  createdAt: Date;
};

export function pickPrimaryPhotoUrl<T extends PhotoLike>(photos: T[]): string | null {
  const primary = photos.find((photo) => photo.isPrimary);
  return primary?.url ?? photos[0]?.url ?? null;
}

export function sortPhotosForDisplay<T extends PhotoWithCreatedAt<PhotoLike>>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    if (a.isPrimary === b.isPrimary) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.isPrimary ? -1 : 1;
  });
}

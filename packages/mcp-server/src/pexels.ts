export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface PexelsSearchResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
}

export type PexelsImageSize = keyof PexelsPhoto['src'];

export class PexelsClient {
  private apiKey: string;
  private baseUrl = 'https://api.pexels.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchPhotos(query: string, perPage = 5): Promise<PexelsPhoto[]> {
    const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
    const res = await fetch(url, {
      headers: { Authorization: this.apiKey },
    });

    if (!res.ok) {
      throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as PexelsSearchResponse;
    return data.photos;
  }

  async getPhotoUrl(query: string, size: PexelsImageSize = 'large'): Promise<{ url: string; photo: PexelsPhoto } | null> {
    const photos = await this.searchPhotos(query, 1);
    if (photos.length === 0) return null;
    const photo = photos[0];
    return { url: photo.src[size], photo };
  }
}

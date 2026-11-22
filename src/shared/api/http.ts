export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Thin typed wrapper over fetch with abort support and uniform errors. */
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

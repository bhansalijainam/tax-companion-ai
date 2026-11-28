import { normaliseMime, type UploadRequestView } from '@/domain/upload';
import type { DocKind } from '@/domain/types';

export interface UploadBackend {
  load(): Promise<UploadRequestView>;
  upload(file: File, kind?: DocKind): Promise<UploadRequestView>;
  /** Demo only: send the sample document for an item */
  sample?(kind: DocKind): Promise<UploadRequestView>;
}

/** The real backend: /api/upload/:token. Errors carry the server's plain-language message. */
export function apiUploadBackend(token: string): UploadBackend {
  const url = `/api/upload/${encodeURIComponent(token)}`;
  const parse = async (res: Response) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error ?? 'Something went wrong. Please try again.'), { status: res.status });
    return body as UploadRequestView;
  };
  return {
    load: async () => parse(await fetch(url)),
    upload: async (file, kind) => parse(await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': normaliseMime(file.type, file.name) ?? file.type,
        'x-file-name': encodeURIComponent(file.name),
        ...(kind ? { 'x-doc-kind': kind } : {}),
      },
      body: file,
    })),
  };
}


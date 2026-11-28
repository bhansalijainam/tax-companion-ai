import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { demoPractice } from '@/state/practiceStore';
import { apiUploadBackend, type UploadBackend } from './uploadBackend';
import { ClientUploadPage } from './ClientUploadPage';

/** /u/:token, the link a client receives */
export function TokenUploadRoute() {
  const { token = '' } = useParams();
  const backend = useMemo(() => apiUploadBackend(token), [token]);
  return <ClientUploadPage backend={backend} />;
}

const GONE = Object.assign(new Error('This upload link has expired or was turned off. Ask your CA to send a new one.'), { status: 410 });

/** /practice/:id/upload, the demo client's page (browser only) */
export function DemoUploadRoute() {
  const { id = '' } = useParams();
  const backend = useMemo<UploadBackend>(() => ({
    load: async () => { const v = demoPractice.uploadView(id); if (!v) throw GONE; return v; },
    upload: async (file, kind) => {
      const text = file.type.startsWith('text/') || /\.(txt|csv)$/i.test(file.name) ? await file.text() : undefined;
      const v = demoPractice.clientUpload(id, { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, text, kind });
      if (!v) throw GONE;
      return v;
    },
    sample: async (kind) => { const v = demoPractice.clientUploadSample(id, kind); if (!v) throw GONE; return v; },
  }), [id]);
  return <ClientUploadPage backend={backend} demo />;
}

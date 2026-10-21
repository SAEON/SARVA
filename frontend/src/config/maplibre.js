import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Bundle the matching module worker so vector tiles load in Vite and production.
maplibregl.setWorkerUrl(workerUrl);
export default maplibregl;

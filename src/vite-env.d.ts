/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Backend / API
    readonly VITE_API_BASE_URL: string;
    // LifeLink donor network (n8n) public endpoints; defaults to the n8n Cloud instance
    readonly VITE_NETWORK_BASE_URL?: string;
    // The project's contact inbox; email contact is hidden until it is set
    readonly VITE_CONTACT_EMAIL?: string;

    // Firebase
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID: string;

    // Supabase
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

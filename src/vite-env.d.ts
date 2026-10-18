/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Backend / API
    readonly VITE_API_BASE_URL: string;
    // The project's contact inbox; email contact is hidden until it is set
    readonly VITE_CONTACT_EMAIL?: string;
    // Grievance Officer named on the Terms and Privacy Policy (IT Rules, 2021)
    readonly VITE_GRIEVANCE_OFFICER_NAME?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

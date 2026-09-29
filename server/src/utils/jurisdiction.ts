/**
 * What an admin may see. National admins see everything; city admins see
 * hospitals and donors in their cities only (and, for hospitals, only in their
 * state, since city names repeat across states, e.g. Aurangabad).
 */
export interface AdminScope {
    userId: number;
    isNational: boolean;
    state: string | null;
    cities: string[]; // normalised with normalizeCity
}

export const normalizeCity = (city: unknown): string =>
    String(city ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Clean, de-duplicated city list from user input (keeps the original spelling). */
export const cleanCities = (cities: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of cities) {
        const label = String(c ?? '').trim().replace(/\s+/g, ' ');
        const key = normalizeCity(label);
        if (key && !seen.has(key)) {
            seen.add(key);
            out.push(label);
        }
    }
    return out;
};

export const scopeFromProfile = (userId: number, profile: { is_national: boolean; state: string | null; cities: string[] | null }): AdminScope => ({
    userId,
    isNational: !!profile.is_national,
    state: profile.state ?? null,
    cities: (profile.cities ?? []).map(normalizeCity).filter(Boolean),
});

/**
 * SQL condition limiting hospitals (alias `h`) to the admin's jurisdiction.
 * Appends its values to `params` and returns the condition text.
 */
export const hospitalScopeSql = (scope: AdminScope, params: unknown[], alias = 'h'): string => {
    if (scope.isNational) return 'TRUE';
    params.push(scope.cities);
    const cityCond = `lower(trim(${alias}.city)) = ANY($${params.length}::text[])`;
    if (!scope.state) return cityCond;
    params.push(scope.state);
    return `(${cityCond} AND (${alias}.state IS NULL OR ${alias}.state = $${params.length}))`;
};

/** SQL condition limiting donors (alias `d`) to the admin's cities. */
export const donorScopeSql = (scope: AdminScope, params: unknown[], alias = 'd'): string => {
    if (scope.isNational) return 'TRUE';
    params.push(scope.cities);
    return `lower(trim(${alias}.city)) = ANY($${params.length}::text[])`;
};

export const describeScope = (scope: { isNational?: boolean; is_national?: boolean; state: string | null; cities: string[] | null }): string => {
    if (scope.isNational ?? scope.is_national) return 'All India';
    const cities = (scope.cities ?? []).join(', ');
    return scope.state ? `${cities}, ${scope.state}` : cities;
};

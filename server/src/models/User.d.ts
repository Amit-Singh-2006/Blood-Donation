export interface User {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'donor' | 'hospital';
    created_at?: Date;
}
//# sourceMappingURL=User.d.ts.map
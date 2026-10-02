// Must be imported before anything that loads src/config/db: dotenv does not
// override variables that are already set, so the pool never reaches a real DB.
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test';
process.env.NODE_ENV = 'production'; // silences db.ts connection-error logging

export const fakeRes = () => {
    const res: any = {
        statusCode: 200, body: undefined, cookies: {} as Record<string, string>, cookieOptions: {} as Record<string, any>, cleared: [] as string[],
    };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    res.cookie = (name: string, value: string, options?: any) => { res.cookies[name] = value; res.cookieOptions[name] = options; return res; };
    res.clearCookie = (name: string) => { res.cleared.push(name); return res; };
    return res;
};

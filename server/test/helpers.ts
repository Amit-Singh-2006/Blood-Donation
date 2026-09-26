// Must be imported before anything that loads src/config/db: dotenv does not
// override variables that are already set, so the pool never reaches a real DB.
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test';
process.env.NODE_ENV = 'production'; // silences db.ts connection-error logging

export const fakeRes = () => {
    const res: any = { statusCode: 200, body: undefined };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
};

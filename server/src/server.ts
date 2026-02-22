import app from './app';
import dotenv from 'dotenv';
import initDb from './config/initDb';

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = process.env.PORT || 5000;

// Initialize Database
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

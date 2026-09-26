import app from './app';
import dotenv from 'dotenv';
import initDb from './config/initDb';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Initialize Database
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

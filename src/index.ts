import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import router from './routes';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json());

app.use('/api', router); // all routes are prefixed with /api

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

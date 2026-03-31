import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors()); // Enable CORS for all origins
app.use(express.json());

app.use('/api', router); // all routes are prefixed with /api

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

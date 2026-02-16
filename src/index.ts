import express, { Request, Response } from 'express';
import helmet from 'helmet';
// import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(helmet());
// app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'API running 🚀' });
});

app.get('/health', (req: Request, res: Response) => {
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

import { Router, Request, Response } from 'express';
import { getTree } from '../lib/teamspeak';

const router = Router();

// GET /api/teamspeak
router.get('', (req: Request, res: Response) => {
    // <-- use empty string instead of '/'
    res.json({ message: 'Hello Teamspeak' });
});

// GET /api/teamspeak/tree
router.get('/tree', async (req: Request, res: Response) => {
    res.json(await getTree());
});

export default router;

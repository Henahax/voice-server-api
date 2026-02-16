import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/teamspeak
router.get('', (req: Request, res: Response) => {
    // <-- use empty string instead of '/'
    res.json({ message: 'Hello Teamspeak' });
});

// GET /api/teamspeak/tree
router.get('/tree', (req: Request, res: Response) => {
    let tree = "tree";
    res.json({ message: `${tree}` });
});

export default router;

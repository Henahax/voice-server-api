import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/hello
router.get('', (req: Request, res: Response) => {
    // <-- use empty string instead of '/'
    res.json({ message: 'Hello from the API!' });
});

// GET /api/hello/:name
router.get('/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    res.json({ message: `Hello, ${name}!` });
});

export default router;

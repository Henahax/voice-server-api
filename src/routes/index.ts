import { Router } from 'express';
import helloRouter from './hello';
import teamspeakRouter from './teamspeak';

const router = Router();

router.use('/hello', helloRouter); // /api/hello and /api/hello/:name
router.use('/teamspeak', teamspeakRouter); // /api/teamspeak and /api/teamspeak/:name


export default router;

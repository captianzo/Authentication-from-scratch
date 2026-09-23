import express from 'express';
import { requireAuth } from '../middleware/authenticate.js';

const usersRouter = express.Router();

usersRouter.get('/', requireAuth, (req, res) => {
	res.json({userId: req.userId});
})

export default usersRouter;
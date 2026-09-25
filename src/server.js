import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import pool from './config/db.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import refreshRouter from './routes/refresh.js';
const PORT = 3000;

const secret = process.env.ACCESS_SECRET;
if (!secret || secret.length < 32) {
	console.error('FATAL: ACCESS_SECRET is missing or too short (need 32+ chars).');
	process.exit(1);
}

try {
	await pool.query('SELECT 1');
} catch (err) {
	console.error('FATAL: could not connect to database:', err);
	process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.use('/refresh', refreshRouter);
app.use('/me', usersRouter);
app.use('/', authRouter);

app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(400).json({ error: 'Invalid request' });
});

app.listen(PORT, () => {
	console.log(`Example app listening on port 3000`);
});
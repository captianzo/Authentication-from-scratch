import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import argon2 from 'argon2';

const DUMMY_HASH = await argon2.hash(crypto.randomBytes(16).toString('hex'));

const authRouter = express.Router();

export function generateJWT(id) {
	const payload = {
		"sub": id
	}

	const token = jwt.sign(
		payload,
		process.env.ACCESS_SECRET,
		{
			algorithm: 'HS256',
			expiresIn: '15m'
		}
	);

	return token;
}

export async function generateRefreshToken(userId, { client = pool, expiresAt } = {}) {
	const jti = crypto.randomUUID();
	const rawSecret = crypto.randomBytes(32).toString('hex');
	const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
	expiresAt = expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	await client.query(
		'INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
		[jti, userId, tokenHash, expiresAt]
	);
	return `${jti}.${rawSecret}`;
}

authRouter.post('/signup', async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Missing credentials' });
	}

	const normalizedEmail = email.trim().toLowerCase();

	let hash;
	try {
		hash = await argon2.hash(password);
	} catch (err) {
		console.error("Password hash error:", err);
		return res.status(500).json({error: "Something went wrong. Please try again."});
	}

	try {
		const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [normalizedEmail, hash]);
		return res.status(201).json(result.rows[0]);
	} catch (err) {
		if (err.code === '23505') {
			return res.status(409).json({ error: 'An account with this email already exists.' });
		}
		else {
			console.error('Signup error:', err);
			return res.status(500).json({ error: 'Something went wrong. Please try again.' });
		}
	}
})

authRouter.post('/login', async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
		return res.status(400).json({ error: 'Missing credentials' });
	}

	const normalizedEmail = email.trim().toLowerCase();

	try {
		const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);

		if (result.rows.length === 0) {
			await argon2.verify(DUMMY_HASH, password);
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		const user = result.rows[0];
		const match = await argon2.verify(user.password_hash, password);

		if (!match) {
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		const accessTokenJWT = generateJWT(user.id);
		const refreshToken = await generateRefreshToken(user.id);

		return res.status(200).json({ message: 'Login successful', accessToken: accessTokenJWT, refreshToken: refreshToken, id: user.id, email: user.email });

	} catch (err) {
		console.error('Login error:', err);
		return res.status(500).json({ error: 'Something went wrong. Please try again.' });
	}
})

export default authRouter;
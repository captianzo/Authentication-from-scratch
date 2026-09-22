import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import argon2 from 'argon2';

const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$iPRqnSosa5X9ELzwZUQ3MA$l1EMG4rEov6Xs+6XjUN44fw2kCFZK6Yep+xyXEVkeec';

const authRouter = express.Router();

function generateJWT(sub) {
	const header = {
		"alg": "HS256",
		"typ": "JWT"
	}
	const base64UrlEncodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');

	const payload = {
		"sub": "",
		"iat": "",
		"exp": ""
	}
}

authRouter.post('/signup', async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password){
		return res.status(400).json({error: 'Missing credentials'});
	}

	const hash = await argon2.hash(password);

	try {
		const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, hash]);
		return res.status(201).json(result.rows[0]);
	} catch (err) {
		if (err.code === '23505'){
			return res.status(409).json({error: 'An account with this email already exists.'});
		}
		else{
			console.error('Signup error:', err);
			return res.status(500).json({error: 'Something went wrong. Please try again.'});
		}
	}
})

authRouter.post('/login', async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password){
		return res.status(400).json({error: 'Missing credentials'});
	}

	try {
		const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
		
		if (result.rows.length === 0){
			await argon2.verify(DUMMY_HASH, password);
			return res.status(401).json({error: 'Invalid credentials'});
		}

		const user = result.rows[0];
		const match = await argon2.verify(user.password_hash, password);

		if (!match){
			return res.status(401).json({error: 'Invalid credentials'});
		}

		const accessTokenJWT = generateJWT(user.id);

		return res.status(200).json({message: 'Login successful', id: user.id, email: user.email});
		
	} catch (err) {
		console.error('Login error:', err);
		return res.status(500).json({error: 'Something went wrong. Please try again.'});
	}
})

export default authRouter;
import express from 'express';
import crypto from 'crypto';
import pool from '../config/db.js';
import { generateJWT, generateRefreshToken } from './auth.js';

const refreshRouter = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[0-9a-f]{64}$/i;

refreshRouter.post('/', async (req, res) => {
	const token = req.body?.refreshToken;

	if (typeof(token) !== 'string'){
		return res.status(401).json({error: "Invalid refresh token"});
	}

	const parts = token.split('.');
	if (parts.length !== 2){
		return res.status(401).json({error: "Invalid refresh token"});
	}

	const [jti, rawSecret] = parts;
	if (!UUID_RE.test(jti) || !SECRET_RE.test(rawSecret)){
		return res.status(401).json({error: "Invalid refresh token"});
	}

	const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
	
	const sql = `UPDATE refresh_tokens SET used_at = NOW() WHERE jti = $1 AND token_hash = $2 AND used_at IS NULL AND expires_at > NOW() RETURNING user_id, expires_at;`
	
	let client;
	try {
		client = await pool.connect();
	} catch (error) {
		console.error("Pool connect error:", error);
		return res.status(500).json({error: "Server error"});
	}

	try {
		await client.query('BEGIN');
		const result = await client.query(sql, [jti, tokenHash]);

		if (result.rowCount === 0){
			await client.query('ROLLBACK');
			return res.status(401).json({error: "Invalid refresh token"});
		}
		const { user_id, expires_at} = result.rows[0];

		const newRefreshToken = await generateRefreshToken(user_id, { client, expiresAt: expires_at });
		const accessToken = generateJWT(user_id);

		await client.query('COMMIT');
		return res.json({accessToken, refreshToken: newRefreshToken});
	} catch (err) {
		try {
			await client.query('ROLLBACK');
		} catch (rollbackError) {
			console.error("Rollback failed:", rollbackError);
		}
		console.error("Refresh error:", err);
		return res.status(500).json({error: 'Internal server error'});
	} finally {
		client.release();
	}
})

export default refreshRouter;
import jwt from 'jsonwebtoken';

export const requireAuth = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")){
		return res.status(401).json({error: "Problem authenticating"});
	}

	const token = authHeader?.replace(/^Bearer\s+/i, '');

	try {
		const payload = jwt.verify(token, process.env.ACCESS_SECRET, { algorithms: ['HS256'] });
		req.userId = payload.sub;
		
		next();
	} catch (error) {
		console.error("Failed JWT verification:", error);
		return res.status(401).json({error: "Problem authenticating"});
	}
};
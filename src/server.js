import express from 'express';
import authRouter from './routes/auth.js';
const PORT = 3000;

const app = express();
app.use(express.json());

app.use('/', authRouter);

app.listen(3000, () => {
	console.log(`Example app listening on port 3000`);
})
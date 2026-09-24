import express from 'express';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import refreshRouter from './routes/refresh.js';
const PORT = 3000;

const app = express();
app.use(express.json());

app.use('/refresh', refreshRouter);
app.use('/me', usersRouter);
app.use('/', authRouter);

app.listen(3000, () => {
	console.log(`Example app listening on port 3000`);
})
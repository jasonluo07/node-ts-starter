import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

const app = express();

app.get('/', (_req, res) => {
  res.send('Hello World!');
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});

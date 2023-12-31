import '@/config';

import type { Response } from 'express';
import express from 'express';

import { HttpCode } from '@/constants';
import { authenticate, errorHandler } from '@/middlewares';
import { authRouter, ordersRouter, productsRouter } from '@/routes';
import type { AuthenticatedRequest, UserPayload } from '@/types';
import { sendResponse } from '@/utils';

const app = express();

app.use(express.json());

app.get('/test-auth', authenticate, (req: AuthenticatedRequest, res: Response) => {
  // NOTE: req.user is defined in the authenticate middleware
  //       another way to use type guard
  const { userId, email } = req.user as UserPayload;
  sendResponse({
    res,
    statusCode: HttpCode.OK,
    message: 'Authenticated successfully',
    data: { userId, email },
  });
});

// Register routes
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/orders', authenticate, ordersRouter);

app.use(errorHandler);

const server = app.listen(process.env.PORT, () => {
  console.log(`Server is running on http://${process.env.HOST}:${process.env.PORT}`);
});

export { app, server };

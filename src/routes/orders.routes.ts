import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';

import pool from '@/databases';
import { HttpCode } from '@/enums';
import { catchAsyncError } from '@/middlewares';
import { Order, UserPayload } from '@/types';
import { sendResponse } from '@/utils';

const router = Router();

router.get(
  '/',
  catchAsyncError(async (req, res) => {
    const { email } = req.user as UserPayload;

    const [rows] = await pool.execute<RowDataPacket[]>(
      // TODO: Study JOIN syntax
      'SELECT total_price, status, payment_method FROM orders JOIN users ON orders.user_id = users.id WHERE email = ?',
      [email]
    );

    const orders = rows as Order[];

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Orders retrieved successfully',
      data: orders,
    });
  })
);

export default router;

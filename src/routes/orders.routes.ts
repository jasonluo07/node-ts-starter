import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';

import { HttpCode } from '@/constants';
import { NotFoundError } from '@/constants/errors';
import pool from '@/databases';
import { catchAsyncError } from '@/middlewares';
import { Order, UserPayload } from '@/types';
import { sendResponse } from '@/utils';

const router = Router();

router.get(
  '/',
  catchAsyncError(async (req, res) => {
    const { userId } = req.user as UserPayload;

    const [rows] = await pool.execute<RowDataPacket[]>(
      // TODO: Study JOIN syntax
      'SELECT total_price, status, payment_method FROM orders WHERE user_id = ?;',
      [userId]
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

router.get(
  '/:orderId',
  catchAsyncError(async (req, res) => {
    const { orderId } = req.params;
    const { userId } = req.user as UserPayload;

    const [rows] = await pool.execute<RowDataPacket[]>(
      // TODO: Study JOIN syntax
      `
        SELECT 
          o.total_price, o.status, o.payment_method,
          oi.product_id, oi.quantity, oi.purchase_price
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = ? AND o.user_id = ?;
      `,
      [orderId, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('Order not found');
    }

    const orderDetails = {
      total_price: rows[0].total_price,
      status: rows[0].status,
      payment_method: rows[0].payment_method,
      items: rows.map((row) => ({
        product_id: row.product_id,
        quantity: row.quantity,
        purchase_price: row.purchase_price,
      })),
    };

    sendResponse({
      res,
      statusCode: HttpCode.OK,
      message: 'Order retrieved successfully',
      data: orderDetails,
    });
  })
);

export default router;

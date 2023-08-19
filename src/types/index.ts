import type { Request, Response } from 'express';

import { HttpCode } from '@/constants';

export type ApiResponseStatus = 'success' | 'error';

export interface Product {
  id: number;
  name: string;
  original_price: number;
  discount_price: number;
  description: string;
  category_name: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_price: number;
  status: 'Pending' | 'Paid' | 'Shipped' | 'Completed' | 'Cancelled';
  payment_method: 'Credit Card' | 'PayPal' | 'Bank Transfer';
}

export interface ApiResponse<T> {
  status: ApiResponseStatus;
  message?: string;
  data?: T;
}

export interface SendResponseParams<T> {
  res: Response;
  statusCode: HttpCode;
  message?: string;
  data?: T;
}

export interface UserPayload {
  userId: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

import type { Response } from 'express';

import { HttpCode } from '@/enums';

export type ApiResponseStatus = 'success' | 'error';

export interface Product {
  id: number;
  name: string;
  original_price: number;
  discount_price: number;
  description: string;
}

export interface ApiResponse<T> {
  status: ApiResponseStatus;
  message: string;
  data?: T;
}

export interface SendResponseParams<T> {
  res: Response;
  statusCode: HttpCode;
  message: string;
  data?: T;
}

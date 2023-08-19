import { Router } from 'express';

import {
  createProduct,
  deleteProduct,
  getProductById,
  getProducts,
  patchProduct,
  updateProduct,
} from '@/controllers/products.controller';
import { catchAsyncError } from '@/middlewares';

const router = Router();

// GET /products?category=&priceMin=1000&priceMax=5000&search=&page=1&limit=10&sort_by=id&order=desc
router.get('/', catchAsyncError(getProducts));
router.get('/:productId', catchAsyncError(getProductById));
router.post('/', catchAsyncError(createProduct));
router.put('/:productId', catchAsyncError(updateProduct));
router.patch('/:productId', catchAsyncError(patchProduct));
router.delete('/:productId', catchAsyncError(deleteProduct));

export default router;

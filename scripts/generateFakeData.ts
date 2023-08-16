import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

import { SALT_ROUNDS } from '../src/constants';

const DATA_DIRECTORY_PATH = path.resolve(process.cwd(), 'data');
const PRODUCTS_NUM_RECORDS = 100;
const USERS_NUM_RECORDS = 100;
const ORDER_ITEMS_NUM_RECORDS = 300;
const ORDER_ITEMS_PER_ORDER = 3;
const PRICE_RANGE = { min: 100, max: 4000 };
const PASSWORD = 'Password1';

function createDataDir() {
  if (!fs.existsSync(DATA_DIRECTORY_PATH)) {
    fs.mkdirSync(DATA_DIRECTORY_PATH);
    console.log(`Created ${DATA_DIRECTORY_PATH} directory`);
  } else {
    console.log(`${DATA_DIRECTORY_PATH} directory already exists`);
  }
}

function createCsvFile(fileName: string, headers: string, rows: string[]) {
  const filePath = path.join(DATA_DIRECTORY_PATH, fileName);
  fs.writeFileSync(filePath, headers + rows.join(''));
  console.log(`${rows.length} fake records generated in ${fileName}`);
}

function readCsvFile(fileName: string) {
  const filePath = path.join(DATA_DIRECTORY_PATH, fileName);
  const data = fs.readFileSync(filePath, 'utf-8');
  const lines = data.split('\n').slice(1); // Remove headers
  return lines;
}

function generateProducts() {
  const headers = 'name,description,original_price,discount_price\n';
  const rows: string[] = [];

  for (let i = 1; i <= PRODUCTS_NUM_RECORDS; i++) {
    const originalPrice = Math.floor(Math.random() * (PRICE_RANGE.max - PRICE_RANGE.min + 1)) + PRICE_RANGE.min;
    const discountRate = 0.2 + Math.random() * 0.8; // 0.2 ~ 1.0
    const discountPrice = Math.floor(originalPrice * discountRate);
    rows.push(`Product ${i},Description for Product ${i},${originalPrice},${discountPrice}\n`);
  }

  createCsvFile('products.csv', headers, rows);
  console.log('Generated products.csv');
}

async function generateUsers() {
  const headers = 'email,password\n';
  const rows: string[] = [];

  for (let i = 1; i <= USERS_NUM_RECORDS; i++) {
    const email = `user${i}@ex.com`;
    const hashedPassword = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
    rows.push(`${email},${hashedPassword}\n`);
  }

  createCsvFile('users.csv', headers, rows);
  console.log('Generated users.csv');
}

function generateOrderItems() {
  const headers = 'order_id,product_id,quantity,purchase_price\n';
  const rows: string[] = [];
  const orderTotals: Record<number, number> = {};

  const products = readCsvFile('products.csv');

  for (let i = 1; i <= ORDER_ITEMS_NUM_RECORDS; i++) {
    const orderId = Math.ceil(i / ORDER_ITEMS_PER_ORDER);
    const productId = Math.floor(Math.random() * products.length) + 1;
    const quantity = Math.floor(Math.random() * 10) + 1;
    const productData = products[productId - 1].split(',');
    const purchasePrice = parseFloat(productData[3]);
    const totalForThisItem = purchasePrice * quantity;

    if (!orderTotals[orderId]) {
      orderTotals[orderId] = 0;
    }
    orderTotals[orderId] += totalForThisItem;

    rows.push(`${orderId},${productId},${quantity},${purchasePrice}\n`);
  }

  createCsvFile('order_items.csv', headers, rows);
  console.log('Generated order_items.csv');

  return orderTotals;
}

function generateOrders(orderTotals: Record<number, number>) {
  const headers = 'user_id,total_price,status,payment_method\n';
  const rows: string[] = [];

  for (const orderId in orderTotals) {
    const userId = Math.floor(Math.random() * USERS_NUM_RECORDS) + 1;
    const status = ['Pending', 'Paid', 'Shipped', 'Completed', 'Cancelled'][Math.floor(Math.random() * 5)];
    const paymentMethod = ['Credit Card', 'PayPal', 'Bank Transfer'][Math.floor(Math.random() * 3)];
    const totalPrice = orderTotals[orderId];
    rows.push(`${userId},${totalPrice},${status},${paymentMethod}\n`);
  }

  createCsvFile('orders.csv', headers, rows);
  console.log('Generated orders.csv');
}

function main() {
  console.log('Starting data seeding...');
  createDataDir();
  generateProducts();
  generateUsers();
  const orderTotals = generateOrderItems();
  generateOrders(orderTotals);
  console.log('Data seeding completed.');
}

if (require.main === module) {
  main();
}

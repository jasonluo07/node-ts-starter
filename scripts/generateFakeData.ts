import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

import { SALT_ROUNDS } from '../src/constants';

const DATA_DIRECTORY_PATH = path.resolve(process.cwd(), 'data');
const PRODUCTS_NUM_RECORDS = 100;
const USERS_NUM_RECORDS = 100;
const PRICE_RANGE = { min: 100, max: 10000 };
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

function generateProducts() {
  const headers = 'name,description,original_price,discount_price\n';
  const rows: string[] = [];

  for (let i = 1; i <= PRODUCTS_NUM_RECORDS; i++) {
    const originalPrice = Math.floor(Math.random() * (PRICE_RANGE.max - PRICE_RANGE.min + 1)) + PRICE_RANGE.min;
    const discountRate = (Math.floor(Math.random() * 9) + 2) / 10; // 0.2 ~ 1.0
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

function main() {
  console.log('Starting data seeding...');
  createDataDir();
  generateProducts();
  generateUsers();
  console.log('Data seeding completed.');
}

if (require.main === module) {
  main();
}

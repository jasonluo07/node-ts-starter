import fs from 'fs';
import path from 'path';

const DATA_DIRECTORY_PATH = path.resolve(process.cwd(), 'data');
const PRODUCTS_NUM_RECORDS = 100;
const USERS_NUM_RECORDS = 100;
const BASE_PRICE_RANGE = { min: 100, max: 10000 };
const PASSWORD = 'password'; // TODO: use proper encryption/hashing

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
  const headers = 'name,description,price\n';
  const rows: string[] = [];

  for (let i = 1; i <= PRODUCTS_NUM_RECORDS; i++) {
    const basePrice =
      Math.floor(Math.random() * (BASE_PRICE_RANGE.max - BASE_PRICE_RANGE.min + 1)) + BASE_PRICE_RANGE.min;
    const price = Math.random() < 0.5 ? basePrice : basePrice + 0.5;
    rows.push(`Product ${i},Description for Product ${i},${price}\n`);
  }

  createCsvFile('products.csv', headers, rows);
  console.log('Generated products.csv');
}

function generateUsers() {
  const headers = 'email,password\n';
  const rows: string[] = [];

  for (let i = 1; i <= USERS_NUM_RECORDS; i++) {
    const email = `user${i}@ex.com`;
    rows.push(`${email},${PASSWORD}\n`);
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

import fs from 'fs';
import path from 'path';

const dirPath = path.resolve(__dirname, '..', 'data');
const filePath = path.join(dirPath, 'products.csv');

if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath);
}

const file = fs.createWriteStream(filePath);
file.write('id,name,description,price\n');

for (let i = 1; i <= 100; i++) {
  const basePrice = Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000;
  const price = (Math.random() < 0.5 ? basePrice : basePrice + 0.5).toFixed(2);
  file.write(`${i},Product ${i},Description for Product ${i},${price}\n`);
}

file.end();

import app from './app.js';
import config from './app/config/index.js';
import mongoose from 'mongoose';

async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    app.listen(config.port, () => {
      console.log(`Example app listening on port ${config.port}`);
    });
  } catch (error) {
    console.log('ruhul', error, 'ruhul');
  }
}
main();

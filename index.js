import { app } from './app.js';
import dotenv from 'dotenv'
import connectDB from './src/db/index.js';

dotenv.config({
    path: './.env'  // Updated path to .env file
})

connectDB()
.then(() => {
    app.listen(
        process.env.PORT || 8000,
        () => {
            console.log(`* server is running at port : ${process.env.PORT}`);
        }
    )
})
.catch((e) => {
    console.log(`MongoDB connection failed ${e.message}`);
})
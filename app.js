import express from 'express'
const app = express();

import cors from 'cors';
import cookieParser from 'cookie-parser';
import { searchFactChecks } from './src/controllers/user.controller.js';
import { upload, handleImageUpload } from './src/controllers/image.controller.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import factCheckRoutes from './src/routes/factCheck.routes.js';
import newsRoutes from './src/routes/news.route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
const allowedOrigins = [
  'https://fact-check-frontend-lovat.vercel.app',
  'https://fact-check-frontend-git-main-naushad-ahmads-projects.vercel.app',
  'https://fact-check-frontend-blwoyoyp9-naushad-ahmads-projects.vercel.app',
  'http://localhost:5173'  // Optional: useful for local development
];

app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS Origin:", origin); // Helpful for debugging
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true
}));

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true
// }));


app.use(express.json({limit:"16kb"}));
app.use(express.urlencoded({extended:true,limit:"16kb"}));
app.use(express.static("public"));
app.use(cookieParser())

// routes import
//  import userRouter from './routes/user.routes.js';

// routes declaration
app.get("/",(req,res)=>{
res.send("All are ok")
})

// Use fact-check routes
app.use("/api/fact-check", factCheckRoutes);

// Use news routes
app.use("/api/news", newsRoutes);

// Test endpoint for Fact Check API
// app.get("/api/test-fact-check", async (req, res) => {
//     try {
//         console.log("Testing Fact Check API...");
//         const result = await searchFactChecks("covid");
//         res.json(result);
//     } catch (error) {
//         console.error("Test endpoint error:", error);
//         res.status(500).json({ error: error.message });
//     }
// });

// Main fact-check endpoint for text
app.post("/api/fact-check", async (req, res) => {
    const { content } = req.body;
    console.log("Received content:", content);
    
    if (!content) return res.status(400).json({ error: "Content is required." });

    try {
        const result = await searchFactChecks(content);
        res.json(result);
    } catch (error) {
        console.error("Fact check error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Image upload and fact-check endpoint
app.post("/api/fact-check-image", upload.single('image'), handleImageUpload);

export {app}
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

app.use(cors({
  origin: 'http://localhost:5173',
  // credentials: true
}));

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
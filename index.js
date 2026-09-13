import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const blogSchema = new mongoose.Schema({
    title: String,
    description: String,
    likes: {
        type: [String],
        default: []
    }
});

const Model = mongoose.model("db1", blogSchema, "blog");

// Serverless Mongoose connection caching
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts)
            .then((m) => {
                console.log("Database Connected");
                return m;
            })
            .catch((err) => {
                cached.promise = null;
                console.error("Database Connection Error:", err);
                throw err;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Ensure database connection before handling any requests
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error("DB Middleware Error:", error);
        res.status(500).json({
            success: false,
            message: "Database connection failed",
            error: error.message
        });
    }
});

app.get("/data", async (req, res) => {
    try {
        const data = await Model.find();
        res.json({ success: true, data: data });
    } catch (error) {
        console.log("Find Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/data", async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title and description are required"
            });
        }

        const newBlog = new Model({
            title: title.trim(),
            description: description.trim(),
            likes: []
        });

        await newBlog.save();

        res.status(201).json({
            success: true,
            data: newBlog
        });
    } catch (error) {
        console.log("Create Blog Error:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.patch("/data/:id/like", async (req, res) => {
    try {
        const { uid } = req.body;

        if (!uid) {
            return res.status(400).json({
                success: false,
                message: "User ID (uid) is required"
            });
        }

        const data = await Model.findById(req.params.id);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Data not found"
            });
        }

        if (!Array.isArray(data.likes)) {
            data.likes = [];
        }

        const userIndex = data.likes.indexOf(uid);
        if (userIndex > -1) {
            data.likes.splice(userIndex, 1);
        } else {
            data.likes.push(uid);
        }

        data.markModified("likes");
        await data.save();

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.log("Like Error:", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Application Started on http://localhost:${PORT}`);
    });
}

export default app;
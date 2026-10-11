const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");

const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const multer = require("multer");

const common = require("./public/lib/common.js");

const PORT = process.env.SERVER_PORT || 17000;

// VPS Persistent Upload Path
const BASE_UPLOAD_PATH = "/home/uploads";

// ================== MIDDLEWARE ==================

// Static public files
app.use("/", express.static("./public"));

// Body parser
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({
  limit: "500mb",
  extended: true,
}));

// ================== CORS (UPDATED) ==================

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true);

    // allow ALL localhost ports (dev)
    if (origin.startsWith("http://localhost")) {
      return callback(null, true);
    }

    // allow your production frontend
    // if (origin === "https://jodhpursweetsshop.netlify.app") {
    //   return callback(null, true);
    // }
    if (origin === "https://joswee.cloud") {
      return callback(null, true);
    }
    // https://jodhpur.stock.abhishekcv.in/
    // if (origin === "https://jodhpur.stock.abhishekcv.in") {
    //   return callback(null, true);
    // }

    // allow all (optional - remove if you want strict security)
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.options("*", cors());

// ================== DEBUG ORIGIN (OPTIONAL) ==================
app.use((req, res, next) => {
  console.log("Origin:", req.headers.origin);
  next();
});

// ================== STATIC UPLOADS ==================

// Serve uploaded files
app.use("/uploads", express.static(BASE_UPLOAD_PATH));

// ================== ROUTES ==================

app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

app.use("/common", common);

// ================== FILE UPLOAD ==================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "ShopMedia");

    // create folder if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2000000000 }, // 2GB
});

// Upload API
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).send({
        status: false,
        message: "No file selected",
      });
    }

    res.status(200).send({
      status: true,
      message: "File uploaded successfully",
      data: {
        name: file.filename,
        originalname: file.originalname,
        foPa: `/uploads/ShopMedia/${file.filename}`, // file URL
        mimetype: file.mimetype,
        size: file.size,
      },
    });

  } catch (err) {
    console.error("Upload error:", err);

    res.status(500).send({
      status: false,
      message: "Upload failed",
      error: err.message,
    });
  }
});

// ================== SERVER ==================

function time() {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata"
  });
}

app.listen(PORT, () => {
   console.log(time());
  console.log(`Server running on port ${PORT} 🚀`);
});
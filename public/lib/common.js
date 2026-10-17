const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const libFunc = require("./functions.js");
const path = require("path");
var atob = require("atob");
const multer = require("multer");
const queries = require("./connect_db/queries.js");

var fs = require("fs");
require("./library.js")();

// secret key
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Common Function Commnunication
 */

function decodeReqData(data) {
  return JSON.parse(decodeURIComponent(atob(data)));
}

const schema = "abg";

function sendTokenError(res, msg) {
  const errorResponse = { msg, status: 2 };

  return res
    .status(401)
    .send(Buffer.from(JSON.stringify(errorResponse)).toString("base64"));
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  // 1. Check authorization header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendTokenError(res, "Please login again");
  }

  const token = authHeader.split(" ")[1];

  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).send({
      status: 1,
      msg: "Authentication configuration error",
    });
  }

  // 2. Verify JWT
  jwt.verify(token, JWT_SECRET, async function (err, decoded) {
    if (err) {
      return sendTokenError(res, "Invalid or expired token");
    }

    try {
      // 3. Fetch current account status from database
      const userTable = `${schema}.users`;

      const result = await queries.custom_query(
        `SELECT row_id, role, is_active, deleted_at
         FROM ${userTable}
         WHERE row_id = '${decoded.userId}'
         LIMIT 1`,
      );

      const user = result && result[0];

      // 4. Block missing, inactive, and deleted accounts
      if (!user) {
        return sendTokenError(res, "User account not found");
      }

      if (user.deleted_at != null) {
        return sendTokenError(
          res,
          "Your account has been deleted. Please contact admin.",
        );
      }

      if (user.is_active !== true) {
        return sendTokenError(
          res,
          "Your account is inactive. Please contact admin.",
        );
      }

      // 5. Set trusted values from the database/JWT
      req.userId = user.row_id;
      req.role = user.role;
      req.counterId = decoded.counterId;
      req.shopId = decoded.shopId;
      req.supplierId = decoded.supplierId;
      req.token = token;

      // 6. Continue to the protected API
      return next();
    } catch (error) {
      console.error("verifyToken database error:", error);

      return res.status(500).send({
        status: 1,
        msg: "Unable to verify account status",
      });
    }
  });
}

router.post("/", verifyToken, function (req, res, next) {
  try {
    const data = decodeReqData(req.body.payload);

    data.data = data.data || {};
    data.data.userId = req.userId;
    data.data.user_role = req.role;
    data.data.token = req.token;

    const se = data.se;

    if (!common_fn[se] || typeof common_fn[se] !== "function") {
      return res.status(400).send({
        status: 1,
        msg: "Invalid function selector",
      });
    }

    common_fn[se](data, res);
  } catch (error) {
    console.error("Common API payload error:", error);

    return res.status(400).send({
      status: 400,
      msg: "Invalid request payload",
    });
  }
});

router.post("/create-user", function (req, res, next) {
  try {
    const data = decodeReqData(req.body.payload);

    const fn = "common_fn";
    const se = data.se;

    if (!common_fn[se] || typeof common_fn[se] !== "function") {
      return res.status(400).send({
        status: 1,
        msg: "Invalid function selector",
      });
    }

    common_fn[se](data, res);
  } catch (error) {
    console.error("Create-user payload error:", error);

    return res.status(400).send({
      status: 1,
      msg: "Invalid request payload",
    });
  }
});

//==========================================================================================//

/**
 *
 *File Uploading
 */

//  NEW BASE PATH (VPS persistent storage)
const BASE_UPLOAD_PATH = "/home/uploads";

// Configure multer storage
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(BASE_UPLOAD_PATH, "ShopMedia");

    // Create directory if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

// Initialize multer
var upload = multer({
  storage: storage,
  limits: { fileSize: 2000000000 },
});

// Upload API
router.post("/uploads", verifyToken, upload.any(), async (req, res) => {
  try {
    const files = req.files;

    const foldername = "ShopMedia";
    let respFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      respFiles.push({
        name: file.filename,

        // IMPORTANT: URL path (NOT system path)
        foPa: `/uploads/${foldername}/${file.filename}`,

        mimetype: file.mimetype,
        size: file.size,
      });
    }

    res.status(200).send({
      rsp: {
        status: true,
        message: "Files uploaded successfully.",
        data: { filesInfo: respFiles },
      },
    });
  } catch (err) {
    console.error("Error during upload:", err);

    res.status(500).send({
      rsp: {
        status: false,
        message: "Error during upload",
        error: err.message,
      },
    });
  }
});

module.exports = router;

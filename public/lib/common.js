const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const libFunc = require("./functions.js");
const path = require("path");
var atob = require("atob");
const multer = require("multer");
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

function verifyToken(req, res, next) {
  const token = req.headers.authorization.split(" ")[1];
  const secret = JWT_SECRET;

  jwt.verify(token, secret, function (err, decoded) {
    if (err) {
      var errr = { msg: "Invalid Token", status: 2 };
      var enErr = btoa(JSON.stringify(errr));
      res.send(enErr);
    } else {
      req.userId = decoded.userId;
      req.role = decoded.role;
      req.counterId = decoded.counterId;
      req.shopId = decoded.shopId;
      req.supplierId = decoded.supplierId;
      req.token = token;
      next();
    }
  });
}
const ACUBE_WEBHOOK_SECRET = "Ip!@zvHbhrAGadjco";
router.post("/acube-24", async function (req, res) {
  console.log("Acube WEbhook");
  // console.log(req);
  console.log(req.body);
  if (req.body.type == "message_api_clicked") {
    var messageTemplateData = JSON.parse(req.body.data.message.message);
    var customerMobile = req.body.data.customer.phone_number;
    await common_fn.markAsDone(messageTemplateData, customerMobile, res);
  } else {
    res.status(200).json({
      message: "Done",
    });
  }
});

router.post("/", verifyToken, function (req, res, next) {
  try {
    const data = decodeReqData(req.body.payload);

    data.data = data.data || {};
    data.data.userId = req.userId;
    data.data.user_role = req.role;
    data.data.token = req.token;
    data.data.counterId = req.counterId;
    data.data.shopId = req.shopId;
    data.data.supplierId = req.supplierId;

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

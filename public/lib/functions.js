const crypto = require("aes256");
const crypt = require("crypto");
const express = require("express");
const exp = express();
var btoa = require("btoa");
var atob = require("atob");
const bodyParser = require("body-parser");
const fs = require("fs");
var request = require("request");
const { v1 } = require("uuid");
exp.use(bodyParser.json()); // support json encoded bodies
exp.use(bodyParser.urlencoded({ limit: "1000mb", extended: true })); // support encoded bodies
const FILE_PATH = "./public/uploads";
const { createSecureServer } = require("http2");
const INITIALIZATION_VECTOR = crypt.randomBytes(16);

/**
 * Libarary Functions
 */
// function sendResponse(res, dataResponse) {
//     var encodedResponse = btoa((JSON.stringify(dataResponse)));

//     // var encodedResponse = btoa(JSON.stringify(dataResponse));
//     res.send(encodedResponse);
// }

/**
 * Library Functions
 */
function sendResponse(res, dataResponse) {
  var jsonString = JSON.stringify(dataResponse);

  var encodedResponse = btoa(
    encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, function (_, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    }),
  );

  res.send(encodedResponse);
}

function deleteFile(filepath) {
  return new Promise((resolve, reject) => {
    fs.unlink(filepath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

function sum(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function isEmpty(argument) {
  if (getType(argument) == "array") {
    if (argument.length == 0) {
      return true;
    } else {
      return false;
    }
  } else if (getType(argument) == "object") {
    // // // console.log(argument);

    if (Object.keys(argument).length === 0 && argument.constructor === Object) {
      return true;
    } else {
      return false;
    }
  } else {
    switch (argument) {
      case "":
      case null:
      case false:
      case undefined:
      case NaN:
        return true;
      default:
        return false;
    }
  }
}
// for random id generation
function randomid() {
  var randomTxt = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 4; i++) {
    randomTxt += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return getTimeStamp() + "_" + randomTxt;
}
// for random id generation
function generateApikey(length) {
  var randomTxt = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    randomTxt += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomTxt;
}
function generateHostName(length) {
  var randomTxt = "";
  var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    randomTxt += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomTxt;
}
// for random number generation
function randomNumber(len) {
  var randomTxt = "";
  var possible = "0123456789";

  for (var i = 0; i < len; i++) {
    randomTxt += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return randomTxt;
}

function getTimeStamp(timeStamp) {
  if (timeStamp != undefined) {
    return new Date(timeStamp);
  } else {
    return Date.now();
  }
}

function getKey() {
  var key = "123456-xyz"; // This Will be Replaced by the user's licence key.
  return key;
}
function decrypt128(data, key) {
  const cipher = crypt.createDecipheriv(
    "aes-128-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(INITIALIZATION_VECTOR),
  );
  return cipher.update(data, "hex", "utf8") + cipher.final("utf8");
}
function encrypt128(data, key) {
  const cipher = crypt.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "hex"),
    Buffer.from(INITIALIZATION_VECTOR),
  );
  return cipher.update(data, "utf8", "hex") + cipher.final("hex");
}

function encrypt(data) {
  var cryptoKey = getKey();
  if (getType(data) == "object") {
    for (var key in data) {
      if (is_ebc_rowId(key)) {
      } else if (
        getType(data[key]) == "object" ||
        getType(data[key]) == "array"
      ) {
        data[key] = crypto.encrypt(cryptoKey, JSON.stringify(data[key]));
      } else {
        if (!isEmpty(data[key])) {
          data[key] = crypto.encrypt(cryptoKey, data[key]);
        }
      }
    }
    return data;
  } else if (getType(data) == "array") {
    for (var i = 0; i < data.length; i++) {
      for (var key in data[i]) {
        if (!isEmpty(data[i][key])) {
          data[i][key] = crypto.encrypt(cryptoKey, data[i][key]);
        }
      }
    }
    return data;
  } else if (getType(data) == "string") {
    if (isEmpty(data) == false) {
      data = crypto.encrypt(cryptoKey, data);
      return data;
    }
  }
}

function decrypt(data) {
  var cryptoKey = getKey();
  if (getType(data) == "object") {
    for (var key in data) {
      if (is_ebc_rowId(key)) {
      } else {
        data[key] = crypto.decrypt(cryptoKey, data[key]);
      }
    }
    return data;
  } else if (getType(data) == "array") {
    for (var i = 0; i < data.length; i++) {
      for (var key in data[i]) {
        if (is_ebc_rowId(key)) {
        } else {
          if (!isEmpty(data[i][key])) {
            data[i][key] = crypto.decrypt(cryptoKey, data[i][key]);
          }
        }
      }
    }
    return data;
  } else if (getType(data) == "string") {
    if (isEmpty(data) == false) {
      data = crypto.decrypt(cryptoKey, data);
      return data;
    }
  }
}

function getType(p) {
  if (Array.isArray(p)) return "array";
  else if (typeof p == "string") return "string";
  else if (p != null && typeof p == "object") return "object";
  else return "other";
}

function is_ebc_rowId(str) {
  var tempSplit = str.split("_");
  if (
    findIndexByKey(tempSplit, "rowId") != -1 ||
    str == "ebc_id" ||
    str == "ebc_cr_on" ||
    str == "ebc_up_on"
  ) {
    return true;
  } else {
    return false;
  }
}

function findAllIndex(scope, keyValue, keyTitle) {
  var index = [];

  for (var i = 0; i < scope.length; i++) {
    if (scope[i][keyTitle] == keyValue) {
      index.push(i);
    }
  }
  return index.length > 0 ? index : -1;
}
function findIndexByKey(scope, keyValue, keyTitle) {
  var index = null;
  if (getType(scope) == "array") {
    index = scope.indexOf(keyValue);
  } else if (getType(scope) == "object") {
    index = scope
      .map(function (key) {
        return key[keyTitle];
      })
      .indexOf(keyValue);
  }
  return index;
}
function readFileFromPath(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}
function writeFileToPath(path, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, function (err) {
      if (err) {
        reject(err);
      } else {
        var res = { msg: "file written" };
        resolve(res);
      }
    });
  });
}
module.exports = {
  sum: sum,
  multiply: multiply,
  randomid: randomid,
  randomNumber: randomNumber,
  encrypt: encrypt,
  decrypt: decrypt,
  isEmpty: isEmpty,
  getType: getType,
  sendResponse: sendResponse,
  decrypt128: decrypt128,
  encrypt128: encrypt128,
  deleteFile: deleteFile,
  findAllIndex: findAllIndex,
  generateApikey: generateApikey,
  generateHostName: generateHostName,
  readFileFromPath: readFileFromPath,
  writeFileToPath: writeFileToPath,
};

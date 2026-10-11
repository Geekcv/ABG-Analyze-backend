const { Pool } = require('pg');
const db_connector = require('./config.js');
console.log("db_connector-----------");
console.log(db_connector);
const pool = new Pool(db_connector);
module.exports = pool;


const HOST = process.env.DB_HOST;
const PORT = process.env.DB_PORT;
const USER = process.env.DB_USER;
const PASSWORD = process.env.DB_PASS;
const DATABASE = process.env.DB_NAME;
console.log(HOST, PORT, USER, PASSWORD, DATABASE);

const db_connector = {
    host: HOST,
    database: DATABASE,
    user: USER,
    password: PASSWORD,
    port: PORT,
    // ssl:{
    //     rejectUnauthorized: false
    // }
};
module.exports = db_connector;

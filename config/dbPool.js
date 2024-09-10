const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: "srv414.hstgr.io",
    user: "u153499884_Autoswiper",
    password: "1705Aaron",
    database: "u153499884_Autoswiper"
});

module.exports = pool;
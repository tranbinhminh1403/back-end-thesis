const mysql = require('mysql2/promise')

const mySqlPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1403',
    database: 'laptop_compare2'
});

module.exports = mySqlPool;
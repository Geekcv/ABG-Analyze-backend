
const connect_db = require('./db_connect.js');

function createView(schema, table, viewName, fields) {
    return new Promise((resolve, reject) => {
        var sqlString = "CREATE OR REPLACE VIEW " + schema + "." + viewName + " AS SELECT " + fields.join(",") + " FROM " + schema + "." + table;
        // console.log(sqlString);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // console.log('response: table cretions', response);
            resolve(response);
        });
    });
}
function createTable(schema, table, data) {
    return new Promise((resolve, reject) => {
        var colString = " id SERIAL NOT NULL, row_id text NOT NULL PRIMARY KEY, cr_on timestamp without time zone NOT NULL DEFAULT now(), up_on timestamp without time zone NOT NULL DEFAULT now(), ";
        const lastKey = Object.keys(data).pop();
        // // console.log("lastKey--------field");
        // // console.log(lastKey)
        // // console.log(data[lastKey])
        // // console.log(data[lastKey]['id'])
        for (var k = 0; k < data.length; k++) {
            // // console.log("k--------field");
            // // console.log(data[k]);
            // // console.log(data[k]['id']);
            // // console.log(data[k]['id'].replaceAll(" ", ''));
            // // console.log(data[k]['required']);
            var colname = data[k]['id'].replaceAll(" ", '');
            var coltype = data[k]['fdtype'];
            var colNull = data[k]['required'] ? " NOT NULL" : " NULL ";
            if (data[k]['id'] != data[lastKey]['id']) {
                colString += colname + " " + coltype + " " + colNull + " , ";

            } else {
                colString += colname + " " + coltype + " " + colNull + " ";

            }
        }
        var sqlString = "CREATE TABLE IF NOT EXISTS " + schema + "." + table + " ( " + colString + ")";
        // console.log(sqlString);
        // var dropQuery="DROP TABLE IF EXISTS "+ schema + "." + table +" CASCADE ;";
        // // console.log(dropQuery);
        // connect_db.query(dropQuery , function (err, response) {
        //     // console.log("response===========");
        //     // console.log(response);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // console.log('response: table cretions', response);
            resolve(response);
            // });
        });
    });
}

function customQuery(query) {
    return new Promise((resolve, reject) => {

        var sqlString = query;


        // console.log("sqlString------------");
        // console.log(sqlString);

        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rows.length > 0) {
                resolve(response.rows);
            } else {
                resolve(response.rows);
            }

        });
    });

}
function countRecords(tablename, cond) {
    return new Promise((resolve, reject) => {

        var sqlString = "SELECT COUNT(*) as total FROM " + tablename;


        if (cond != undefined) {

            whereString = prepareWhereClause(cond);
        } else {
            whereString = " ;";
        }
        sqlString += whereString;
        // // console.log("sqlString------------");
        // // console.log(sqlString);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rows.length > 0) {
                resolve(response.rows[0]['total']);
            } else {
                resolve(false);
            }

        });
    });

}
function prepareWhereClause(cond) {
    var colString = " WHERE ";
    if (cond.length > 1) {
        for (var k in cond) {
            if (k == 'OR') {
                for (var key in cond[k]) {
                    const lastk = Object.keys(key).pop();
                    if (key != lastk) {
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' OR "
                        }

                        else if (key.includes("ics")) {//case insensitive search
                            colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') OR "
                        } else {

                            colString += key + " = '" + cond[k][key] + "' OR "
                        }
                        // colString += key + " = '" + cond[k][key] + "' OR "
                    } else {
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' "
                        }

                        else if (key.includes("ics")) {
                            colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') "
                        }

                        else {

                            colString += key + " = '" + cond[k][key] + "'";
                        }
                        // colString += key + " = '" + cond[k][key] + "'";
                    }
                }
            }
            if (k == 'AND') {
                for (var key in cond[k]) {
                    const lastk = Object.keys(key).pop();
                    if (key != lastk) {
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' AND "
                        }
                        // else{

                        //     colString += key + " = '" + cond[k][key] + "' AND "
                        // }
                        else if (key.includes("ics")) {
                            colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') AND "
                        } else {

                            colString += key + " = '" + cond[k][key] + "' AND "
                        }
                    } else {
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' "
                        }

                        else if (key.includes("ics")) {
                            colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') "
                        }

                        else {

                            colString += key + " = '" + cond[k][key] + "'";
                        }
                    }
                }
            }
            // if (k != lastKey) {
            //     colString += k + ",";
            // } else {
            //     colString += k + ")";
            // }

        }
    } else {
        for (var k in cond) {
            if (k == 'OR') {
                // // console.log("k");
                // // console.log(k);
                // // console.log(cond[k]);
                for (var key in cond[k]) {
                    const lastk = Object.keys(cond[k]).pop();
                    if (key != lastk) {
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' OR "
                        }
                        else if (key.includes("ics")) {
                            colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') OR "
                        }
                        else {

                            colString += key + " = '" + cond[k][key] + "' OR "
                        }
                        // colString += key + " = '" + cond[k][key] + "' OR "
                    } else {

                        // colString += key + " = '" + cond[k][key] + "'";
                        if (key.includes("%")) {
                            colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%'"
                        } else
                            if (key.includes("ics")) {
                                colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "')"
                            }
                            else {

                                colString += key + " = '" + cond[k][key] + "'";
                            }


                    }
                }
            } else
                if (k == 'AND') {
                    for (var key in cond[k]) {
                        const lastk = Object.keys(cond[k]).pop();
                        if (key != lastk) {
                            if (key.includes("%")) {
                                colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%' AND "
                            }
                            else if (key.includes("ics")) {
                                colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "') AND "
                            }
                            else {

                                colString += key + " = '" + cond[k][key] + "' AND "
                            }

                        } else {

                            if (key.includes("%")) {
                                colString += key.replace("%", '') + "::text ILIKE '%" + cond[k][key] + "%'"
                            } else
                                if (key.includes("ics")) {
                                    colString += "LOWER(" + key.replace("ics", '') + ") = LOWER ('" + cond[k][key] + "')"
                                }
                                else {

                                    colString += key + " = '" + cond[k][key] + "'";
                                }


                        }
                    }

                } else {
                    colString += " " + k + " = '" + cond[k] + "'";

                }

        }
    }

    return colString;
}

function prepareOrderBy(cond) {
    var orderString = " ORDER BY "
    for (var key in cond) {

        const lastk = Object.keys(cond).pop();
        if (key != lastk) {

            orderString += key + " " + cond[key].toUpperCase() + " , ";
        } else {
            orderString += key + " " + cond[key].toUpperCase();

        }
    }

    return orderString;
}

function prepareLimit(cond) {
    var limitString = " LIMIT "
    limitString += Object.values(cond)[0];
    return limitString;
}
function prepareOffset(cond) {
    var offsetString = " OFFSET "
    offsetString += Object.values(cond)[0];
    return offsetString;
}
/**
 * SELECT bo.bookname, bo.authorname, us.fullname as fullname, us.mobile as contactnumber,bois.cr_on as issuedate,
    bore.returndate as returndate from jain_library.t_book_return bore
    INNER JOIN jain_library.t_book_issue bois on bore.bookissueid=bois.row_id 
    INNER JOIN jain_library.t_book bo on bore.bookid=bo.row_id 
    INNER  JOIN jain_library.t_user us ON bore.userid=us.row_id;
 */
function prepareJoin(joins) {
    var joinString = "  "
    for (var i = 0; i < joins.length; i++) {
        if (joins[i]['jointype'] == 'inner') {
            joinString += " INNER JOIN "
        } else if (joins[i]['jointype'] == 'left') {
            joinString += " LEFT JOIN "
        } else if (joins[i]['jointype'] == 'right') {
            joinString += " RIGHT JOIN "
        } else if (joins[i]['jointype'] == 'outer') {
            joinString += " OUTER JOIN "
        }
        if (joins[i]['tables'] != undefined) {
            joinString += joins[i]['tables'][joins[i]['tables'].length - 1]['tb'] + " ON ";
            // for (var tb = 0; tb < joins[i]['tables'].length; tb++) {
            joinString += joins[i]['tables'][0]['tb'] + "." + joins[i]['tables'][0]['on'] + " = " + joins[i]['tables'][1]['tb'] + "." + joins[i]['tables'][1]['on']
            // }
        }
    }
    return joinString;
}

function selectQuery({ tablename, data, cond, orderby, limit, joins, offset }) {
    return new Promise((resolve, reject) => {
        var joinString = " ";
        var whereString = " ";
        var orderString = " ";
        var limitString = " ";
        var sqlString = " ";
        var dataString = "";
        var offsetString = "";
        if (data != undefined) {
            for (var i = 0; i < data.length; i++) {
                if (i == data.length - 1) {
                    if (data[i].includes("-as-")) {
                        dataString += data[i].split("-as-")[0] + " AS " + data[i].split("-as-")[1];
                    }
                    else {
                        dataString += data[i];
                    }
                } else {
                    if (data[i].includes("-as-")) {
                        dataString += data[i].split("-as-")[0] + " AS " + data[i].split("-as-")[1] + ",";
                    }
                    else {
                        dataString += data[i] + ",";
                    }

                }

            }
        } else {
            dataString = "*";
        }
        sqlString = "SELECT " + dataString + " FROM " + tablename;

        // const lastKey = Object.keys(cond).pop();


        if (cond != undefined) {

            whereString = prepareWhereClause(cond);
        }
        if (orderby != undefined) {
            orderString = prepareOrderBy(orderby);
        }
        if (limit != undefined) {
            limitString = prepareLimit(limit);
        }
        if (offset != undefined) {
            offsetString = prepareOffset(offset);
        }
        if (joins != undefined) {
            joinString = prepareJoin(joins);
            // console.log("joinString============");
            // console.log(joinString);
        }
        sqlString += " " + joinString + " " + whereString + " " + orderString + " " + limitString + " " + offsetString + ";"

        // console.log("sqlString------------");
        // console.log(sqlString);



        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rows.length > 0) {
                resolve(response.rows);
            } else {
                resolve(response.rows);
            }

        });
    });

}
function fetchData(tablename, cond) {
    return new Promise((resolve, reject) => {
        var colString = " WHERE ";
        // console.log("cond");
        // console.log(cond);
        // const lastKey = Object.keys(cond).pop();
        var sqlString = "SELECT * FROM " + tablename;
        if (cond == undefined) {
            sqlString += " ;";
            // console.log(sqlString);
        } else {
            if (cond.length > 1) {
                for (var k in cond) {
                    if (k == 'OR') {
                        for (var key in cond[k]) {
                            const lastk = Object.keys(key).pop();
                            if (key != lastk) {

                                colString += key + " = '" + cond[k][key] + "' OR "
                            } else {

                                colString += key + " = '" + cond[k][key] + "'";
                            }
                        }
                    }
                    if (k == 'AND') {
                        for (var key in cond[k]) {
                            const lastk = Object.keys(key).pop();
                            if (key != lastk) {

                                colString += key + " = '" + cond[k][key] + "' AND "
                            } else {

                                colString += key + " = '" + cond[k][key] + "'";
                            }
                        }
                    }
                    // if (k != lastKey) {
                    //     colString += k + ",";
                    // } else {
                    //     colString += k + ")";
                    // }

                }
            } else {
                for (var k in cond) {
                    if (k == 'OR') {
                        // console.log("k");
                        // console.log(k);
                        // console.log(cond[k]);
                        for (var key in cond[k]) {
                            const lastk = Object.keys(cond[k]).pop();
                            if (key != lastk) {

                                colString += key + " = '" + cond[k][key] + "' OR "
                            } else {

                                colString += key + " = '" + cond[k][key] + "'";

                                sqlString += colString + " ;";

                            }
                        }
                    } else
                        if (k == 'AND') {
                            for (var key in cond[k]) {
                                const lastk = Object.keys(cond[k]).pop();
                                if (key != lastk) {

                                    colString += key + " = '" + cond[k][key] + "' AND "
                                } else {

                                    colString += key + " = '" + cond[k][key] + "'";

                                    sqlString += colString + " ;";
                                }
                            }
                        } else if (k == 'LIMIT') {

                            sqlString += " LIMIT " + cond[k] + " ;";
                        } else if (k == 'ORDER') {
                            var orderString = " ORDER BY "
                            for (var key in cond[k]) {

                                const lastk = Object.keys(cond[k]).pop();
                                if (key != lastk) {

                                    orderString += key + " " + cond[k][key].toUpperCase() + " , ";
                                } else {
                                    orderString += key + " " + cond[k][key].toUpperCase();
                                    sqlString += orderString + " ;";
                                }
                            }
                        } else {
                            colString += " " + k + " = '" + cond[k] + "'";
                            sqlString += colString + " ;";
                        }

                }
            }
        }


        // // console.log("sqlString------------");
        // // console.log(sqlString);

        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rows.length > 0) {
                resolve(response.rows);
            } else {
                resolve(response.rows);
            }

        });
    });

}
function updateData(tablename, columns, cond) {
    // console.log("columns");
    // console.log(columns);
    // console.log("cond");
    // console.log(cond);
    // console.log("tablename");
    // console.log(tablename);
    return new Promise((resolve, reject) => {
        var colString = "";
        const lastKey = Object.keys(columns).pop();
        for (var k in columns) {
            if (columns[k] != undefined) {
                // // console.log("columns==========");
                // // console.log(columns);
                // // console.log(k);
                // // console.log(lastKey);
                // // console.log(k != lastKey);
                if (k != lastKey) {
                    // console.log("kast jet===")
                    // colString += k + " = '" + columns[k] + "',";

                    if (isArray(columns[k])) {

                        colString += k + " = '" + JSON.stringify(columns[k]).replaceAll("'","`") + "' ,";
                    } else {

                        colString += k + " = '" + columns[k].toString().replaceAll("'","`") + "',";
                    }
                } else {
                    // console.log("lst key")
                    // colString += k + " = '" + columns[k] + "'";
                    if (isArray(columns[k])) {

                        colString += k + " = '" + JSON.stringify(columns[k]).replaceAll("'","`") + "' ,";
                    } else {

                        colString += k + " = '" + columns[k].toString().replaceAll("'","`") + "',";
                    }


                }
            }
        }
        // // console.log("colString------------");
        // // console.log(colString);
        if (colString[colString.length - 1].includes(",")) {
            colString = colString.substring(0, colString.length - 1);
        }
        // // console.log("colString-------after replace-----");
        // // console.log(colString[colString.length - 1]);
        // // console.log("colString------------");
        // // console.log(cond);

        var sqlString = "UPDATE " + tablename + " SET " + colString + " WHERE " + Object.keys(cond)[0] + " = '" + Object.values(cond)[0] + "';";
        // console.log(sqlString);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rowCount > 0) {
                resolve(response.rowCount);
            } else {
                resolve(response);
            }

        });
    });

}
let isArray = function (a) {
    return (!!a) && (a.constructor === Array);
};
function insertData(tablename, columns) {
    return new Promise((resolve, reject) => {
        var colString = "(";
        const lastKey = Object.keys(columns).pop();
        for (var k in columns) {
            if (columns[k] != undefined) {
            if (k != lastKey) {
                colString += k + ",";
            } else {
                colString += k + ")";
            }
        }
        }
        // // console.log("colString------------");
        // // console.log(colString);
        var valString = "('";
        for (var k in columns) {
            if (columns[k] != undefined) {
            if (k != lastKey) {
                if (isArray(columns[k])) {

                    valString += JSON.stringify(columns[k]).replaceAll("'","`") + "' ,'";
                } else {

                    valString += columns[k].toString().replaceAll("'","`") + "' ,'";
                }
            } else {
                if (isArray(columns[k])) {

                    valString += JSON.stringify(columns[k]).replaceAll("'","`") + "')";
                } else {

                    valString += columns[k].toString().replaceAll("'","`") + "')";
                }
            }
        }

        }
        // // console.log("valString------------");
        // // console.log(valString);
        var sqlString = "INSERT INTO " + tablename + "" + colString + " VALUES" + valString + " ON CONFLICT(row_id) DO NOTHING RETURNING row_id;";
        // console.log(sqlString);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rowCount > 0) {
                resolve(response.rows[0]);
            } else {
                resolve(response);
            }

        });
    });

}
// function insertData(tablename, columns) {
//     return new Promise((resolve, reject) => {
//         const keys = Object.keys(columns).filter(k => columns[k] !== undefined);
//         const colString = `(${keys.join(",")})`;
//         const valPlaceholders = keys.map((_, i) => `$${i + 1}`).join(",");
//         const values = keys.map(k => {
//             if (isArray(columns[k])) {
//                 return JSON.stringify(columns[k]).replaceAll("'", "`");
//             } else {
//                 return columns[k].toString().replaceAll("'", "`");
//             }
//         });
//         const sqlString = `INSERT INTO ${tablename} ${colString} VALUES (${valPlaceholders}) ON CONFLICT(row_id) DO NOTHING RETURNING row_id;`;
//         connect_db.query(sqlString, values, function (err, response) {
//             if (err) {
//                 return console.error('error running query', err);
//             }
//             if (response.rows[0] && response.rows[0]['row_id'] !== undefined) {
//                 resolve(response.rows[0]);
//             } else {
//                 resolve(false);
//             }
//         });
//     });

// }
function deleteData(tablename, cond) {
    /**
     * DELETE FROM table_name WHERE condition;
     */

    return new Promise((resolve, reject) => {
        var op = "";
        var condValue;
        if (isArray(Object.values(cond)[0])) {
            op = " IN  ";
            var tcondValue = [];
            for (var i = 0; i < Object.values(cond)[0].length; i++) {
                tcondValue.push(`'${Object.values(cond)[0][i]}'`);
                condValue = "(" + tcondValue.join(',') + ")";
            }
        } else {
            op = " = '";
            condValue = Object.values(cond)[0] + "'";
        }
        var sqlString = "DELETE FROM " + tablename + " WHERE " + Object.keys(cond)[0] + op + condValue + ";";
        // console.log(sqlString);
        connect_db.query(sqlString, function (err, response) {
            if (err) {
                return console.error('error running query', err);
            }
            // // console.log('response:', response);
            if (response.rowCount > 0) {
                resolve(response.rowCount);
            } else {
                resolve(response);
            }

        });
    });
}

module.exports = {
    "createTable": createTable,
    "createView": createView,
    "insert_data": insertData,
    "count": countRecords,
    "fetch_data": fetchData,
    "delete_data": deleteData,
    "update_data": updateData,
    "custom_query": customQuery,
    "select_query": selectQuery,
}
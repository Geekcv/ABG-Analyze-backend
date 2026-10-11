
const query = require('./queries_new.js');
const libFunc = require('../functions.js');
async function addData(tablename, columns, rowId, message) {

    return new Promise(async function (resolve, reject) {
        if (rowId) {
            delete columns.row_id;
            var row_id = rowId;
            var resp = await query.update_data(tablename, columns, { "row_id": row_id });
            if (resp != false) {
                var resp = {
                    "status": 0,
                    "msg": message + " Updated Successfully",
                    "data": resp
                }
                resolve(resp);
            } else {
                var resp = {
                    "status": 1,
                    "msg": message + " Not Updated"
                }
                resolve(resp);
            }


        } else {
            if(columns.row_id==undefined){

                var row_id = libFunc.randomid();
                columns.row_id = row_id;
            }
            var resp = await query.insert_data(tablename, columns);
            if (resp != false) {
                var resp = {
                    "status": 0,
                    "msg": message + " Created Successfully",
                    "data": resp
                }
                resolve(resp);
            } else {
                var resp = {
                    "status": 1,
                    "msg": message + " Not Created"
                }
                resolve(resp);
            }
        }
    });
}
async function fetchData(tablename, limit, offset, orderby, cond, message) {
    return new Promise(async function (resolve, reject) {
        var resp = await query.select_query({ "tablename": tablename, "limit": { "limit": limit }, "offset": { "offset": offset }, "cond": cond, "orderby": orderby });
      // console.log("resp",resp);
        if (resp != false) {
            var resp = {
                "status": 0,
                "msg": message + " Fetched Successfully",
                "data": resp
            }
            resolve(resp);
        } else {
            var resp = {
                "status": 1,
                "msg": message + " Not Fetched"
            }
            resolve(resp);
        }
    });

}
async function customQuery(customSql, message,params) {
    return new Promise(async function (resolve, reject) {
        // console.log("customSql==========",customSql);
        var resp = await query.custom_query(customSql, params);
      // console.log("resp",resp);
        if (resp != false) {
            var resp = {
                "status": 0,
                "msg": message + "  Successfully",
                "data": resp
            }
            resolve(resp);
        } else {
            var resp = {
                "status": 1,
                "msg": "Not Found "
            }
            resolve(resp);
        }
    });

}


module.exports = {
    addData: addData,
    fetchData: fetchData,
    customQuery: customQuery
}
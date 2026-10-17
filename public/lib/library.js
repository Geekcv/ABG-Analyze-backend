const connect_db = require("./connect_db/db_connect.js");
const libFunc = require("./functions.js");
const jwt = require("jsonwebtoken");
const query = require("./connect_db/queries.js");
const db_query = require("./connect_db/query_wrapper.js");
const path = require("path");
const cron = require("node-cron");

const ExcelJS = require("exceljs");
const queries = require("./connect_db/queries.js");
const functions = require("./functions.js");

// Import at the top of your backend file
const {
  sendWelcomeEmail,
  sendAdminRegistrationEmail,
} = require("./email/email.js");
const { lutimes } = require("fs");

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function () {
  this.common_fn = common_fn;
};

/**
 *  Description :  Common Data Base Functions
 */
let common_fn = {
  /**
   * New API Creation
   *
   */

  res_user: registerUser,
  lo_ap_us: loginUser,
  fetch_user: getAllUsers,
  cr_pat: createPatient,
  fetch_pat: getAllPatients,
  del_pat: deletePatient,
  add_patient_sugar: addPatientSugar,
  fetch_patient_sugar_history: getPatientSugarHistory,
  fetch_patient_current_sugar: getAllPatientCurrentSugar,
  update_patient_sugar: updatePatientSugar,
  manage_user_status: manageUserStatus,

  // profile
  up_prp: updateCurrentProfile,
  fe_prp: getCurrentProfile,
};

const schema = "abg";

async function manageUserStatus(req, res) {
  console.log("req", req);
  try {
    const table = schema + ".users";
    const { row_id, action } = req.data || {};

    if (!row_id || typeof row_id !== "string") {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid row_id is required",
      });
    }

    const allowedActions = ["activate", "deactivate", "delete", "restore"];

    if (!allowedActions.includes(action)) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid action",
      });
    }

    let sql;

    switch (action) {
      case "activate":
        sql = `
          UPDATE ${table}
          SET is_active = TRUE,
              up_on = NOW()
          WHERE row_id = '${row_id}'
            AND deleted_at IS NULL
          RETURNING row_id, name, email, role,
                    is_active, deleted_at, up_on
        `;
        break;

      case "deactivate":
        sql = `
          UPDATE ${table}
          SET is_active = FALSE,
              up_on = NOW()
          WHERE row_id = '${row_id}'
            AND deleted_at IS NULL
          RETURNING row_id, name, email, role,
                    is_active, deleted_at, up_on
        `;
        break;

      case "delete":
        sql = `
          UPDATE ${table}
          SET deleted_at = NOW(),
              is_active = FALSE,
              up_on = NOW()
          WHERE row_id = '${row_id}'
            AND deleted_at IS NULL
          RETURNING row_id, name, email, role,
                    is_active, deleted_at, up_on
        `;
        break;

      case "restore":
        sql = `
          UPDATE ${table}
          SET deleted_at = NULL,
              is_active = FALSE,
              up_on = NOW()
          WHERE row_id = '${row_id}'
            AND deleted_at IS NOT NULL
          RETURNING row_id, name, email, role,
                    is_active, deleted_at, up_on
        `;
        break;
    }

    // Use your database helper's documented parameterized
    // query signature here. Do not interpolate row_id into SQL.
    const result = await queries.custom_query(sql);

    if (!result || result.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User not found or action not applicable",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: `User ${action} successful`,
      data: result[0],
    });
  } catch (error) {
    console.error("manageUserStatus error:", error.message);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Unable to update user status",
    });
  }
}

async function registerUser(req, res) {
  try {
    const tablename = schema + ".users";
    const { name, email, password } = req.data || {};

    // 1. Validation
    if (!name || !email || !password) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Name, email and password are required",
      });
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid input",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Name, email and password are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Please enter a valid email address",
      });
    }

    const row_id = libFunc.randomid();

    // 2. Check duplicate email
    // Escape single quotes for SQL string values
    const safeEmail = cleanEmail.replace(/'/g, "''");

    const checkEmail = await queries.custom_query(
      `SELECT id FROM ${tablename}
       WHERE LOWER(email) = LOWER('${safeEmail}')
       LIMIT 1`,
    );

    if (checkEmail && checkEmail.length > 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Email already exists",
      });
    }

    // 3. Insert user
    const safeName = cleanName.replace(/'/g, "''");
    const safePassword = password.replace(/'/g, "''");

    const result = await queries.custom_query(
      `INSERT INTO ${tablename}
       (row_id, name, email, password_hash, role)
       VALUES (
         '${row_id}',
         '${safeName}',
         '${safeEmail}',
         '${safePassword}',
         'USER'
       )
       RETURNING id, row_id, name, email, role, cr_on`,
    );

    const savedUser = result && result[0];

    if (!savedUser) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Unable to create user account",
      });
    }

    // 4. Send both emails independently
    // Email failure must not fail registration
    // try {
    //   const emailTasks = [
    //     {
    //       label: "Welcome email",
    //       task: () =>
    //         sendWelcomeEmail(savedUser.name, savedUser.email),
    //     },
    //     {
    //       label: "Admin notification",
    //       task: () =>
    //         sendAdminRegistrationEmail(
    //           savedUser.name,
    //           savedUser.email
    //         ),
    //     },
    //   ];

    //   await Promise.all(
    //     emailTasks.map(async ({ label, task }) => {
    //       try {
    //         await task();
    //         console.log(`${label} sent successfully`);
    //       } catch (emailError) {
    //         console.error(
    //           `${label} failed:`,
    //           emailError.message
    //         );
    //       }
    //     })
    //   );
    // } catch (emailError) {
    //   // Extra protection: email issues won't fail registration
    //   console.error("Email processing error:", emailError.message);
    // }

    // 5. Registration success
    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Registration successful",
      data: savedUser,
    });
  } catch (error) {
    console.error("registerUser error:", error.message);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Registration failed. Please try again.",
    });
  }
}

async function loginUser(req, res) {
  try {
    const tablename = schema + ".users";
    const { email, password } = req.data || {};

    // Validation
    if (!email || !password) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Email and password are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Fetch user; exclude deleted accounts
    const result = await queries.custom_query(
      `SELECT
          id,
          row_id,
          name,
          email,
          password_hash,
          role,
          is_active,
          deleted_at
       FROM ${tablename}
       WHERE LOWER(email) = LOWER('${cleanEmail}')
       LIMIT 1`,
    );

    if (!result || result.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid email or password",
      });
    }

    const user = result[0];

    // Deleted user cannot login
    if (user.deleted_at !== null && user.deleted_at !== undefined) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Your account has been deleted",
      });
    }

    // Inactive user cannot login
    if (user.is_active !== true) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Your account is inactive",
      });
    }

    // Password check
    if (user.password_hash !== password) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.row_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "3d",
      },
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Login successful",
      data: {
        token,
        user_id: user.row_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("loginUser error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Login failed",
    });
  }
}

async function getAllUsers(req, res) {
  try {
    const tablename = schema + ".users";

    const result = await queries.custom_query(
      `SELECT
      id,
      row_id,
      name,
      email,
      role,
      is_active,
      password_hash,
      cr_on,
      up_on,
      deleted_at
   FROM ${schema}.users
   WHERE role != 'ADMIN'
   ORDER BY cr_on DESC`,
    );

    console.log("users", result);

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Users fetched successfully",
      data: result || [],
    });
  } catch (error) {
    console.error("getAllUsers error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch users",
    });
  }
}

async function createPatient(req, res) {
  try {
    const {
      name,
      age,
      gender,
      ipdNo,
      bedNo,
      diagnosis,
      oldHistory = "",
      admittedAt,
      dischargedAt = null,
    } = req.data || {};

    console.log("req", req.data);

    // Validate required fields
    if (
      !name?.trim() ||
      age === undefined ||
      age === null ||
      age === "" ||
      !gender ||
      !ipdNo?.trim() ||
      !bedNo?.trim() ||
      !diagnosis?.trim()
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Please provide all required patient details.",
      });
    }

    const patientAge = Number(age);

    if (!Number.isInteger(patientAge) || patientAge < 0 || patientAge > 120) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Age must be a whole number between 0 and 120.",
      });
    }

    if (!["Male", "Female", "Other"].includes(gender)) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid gender.",
      });
    }

    const admissionDate = admittedAt ? new Date(admittedAt) : new Date();

    if (Number.isNaN(admissionDate.getTime())) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid admission date and time.",
      });
    }

    let dischargeDate = null;

    if (dischargedAt) {
      dischargeDate = new Date(dischargedAt);

      if (Number.isNaN(dischargeDate.getTime())) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: "Invalid discharge date and time.",
        });
      }

      if (dischargeDate < admissionDate) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: "Discharge cannot be earlier than admission.",
        });
      }
    }

    const rowId = libFunc.randomid();

    const sqlValue = (value) =>
      value === null || value === undefined
        ? "NULL"
        : `'${String(value).replace(/'/g, "''")}'`;

    const sql = `
      INSERT INTO abg.patients (
        row_id,
        name,
        age,
        gender,
        ipd_no,
        bed_no,
        diagnosis,
        old_history,
        admitted_at,
        discharged_at
      )
      VALUES (
        ${sqlValue(rowId)},
        ${sqlValue(name.trim())},
        ${patientAge},
        ${sqlValue(gender)},
        ${sqlValue(ipdNo.trim())},
        ${sqlValue(bedNo.trim())},
        ${sqlValue(diagnosis.trim())},
        ${sqlValue(oldHistory)},
        ${sqlValue(admissionDate.toISOString())}::timestamptz,
        ${
          dischargeDate
            ? `${sqlValue(dischargeDate.toISOString())}::timestamptz`
            : "NULL"
        }
      )
      RETURNING
        id,
        row_id,
        name,
        age,
        gender,
        ipd_no,
        bed_no,
        diagnosis,
        old_history,
        admitted_at,
        discharged_at;
    `;

    const result = await queries.custom_query(sql);
    const patient = Array.isArray(result)
      ? result[0]
      : (result?.rows?.[0] ?? result?.[0]);

    console.log("patient", patient);

    if (!patient) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient could not be saved.",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient saved successfully.",
      data: patient,
    });
  } catch (error) {
    console.error("createPatient error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to save patient.",
    });
  }
}

async function getAllPatients(req, res) {
  try {
    const tablename = schema + ".patients";

    const result = await queries.custom_query(
      `SELECT
          id,
          row_id,
          name,
          age,
          gender,
          ipd_no,
          bed_no,
          diagnosis,
          old_history,
          created_by,
          cr_on,
          up_on,
          admitted_at,
  discharged_at
       FROM ${tablename}
       ORDER BY cr_on DESC`,
    );

    // console.log("patients", result);

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patients fetched successfully",
      data: result || [],
    });
  } catch (error) {
    console.error("getAllPatients error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch patients",
    });
  }
}

async function deletePatient(req, res) {
  console.log("req", req);
  try {
    const { id, row_id } = req.data || {};

    if (!id && !row_id) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient ID is required.",
      });
    }

    const tablename = schema + ".patients";

    const sqlValue = (value) => `'${String(value).replace(/'/g, "''")}'`;

    const condition = id
      ? `id = ${Number(id)}`
      : `row_id = ${sqlValue(row_id)}`;

    if (id && (!Number.isInteger(Number(id)) || Number(id) <= 0)) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid patient ID.",
      });
    }

    const sql = `
      DELETE FROM ${tablename}
      WHERE ${condition}
      RETURNING id, row_id;
    `;

    const result = await queries.custom_query(sql);
    const deletedPatient = Array.isArray(result)
      ? result[0]
      : (result?.rows?.[0] ?? result?.[0]);

    if (!deletedPatient) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient not found.",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient deleted successfully.",
      data: deletedPatient,
    });
  } catch (error) {
    console.error("deletePatient error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to delete patient.",
    });
  }
}

async function addPatientSugar(req, res) {
  try {
    const { patient_id, sugar, treatments = "" } = req.data || {};

    const patientId = Number(patient_id);
    const sugarValue = Number(sugar);

    if (
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      sugar === null ||
      sugar === undefined ||
      sugar === "" ||
      !Number.isFinite(sugarValue) ||
      sugarValue <= 0 ||
      sugarValue > 2000
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid patient ID and sugar value are required.",
      });
    }

    const sqlValue = (value) => `'${String(value).replace(/'/g, "''")}'`;

    const row_id = libFunc.randomid();

    const sql = `
      INSERT INTO abg.patient_sugar
        (row_id,patient_id, sugar, treatments)
      SELECT
      '${row_id}',
        p.id,
        '${sugarValue}',
        '${sqlValue(treatments)}'
      FROM abg.patients p
      WHERE p.id = '${patientId}'
      RETURNING id,row_id, patient_id, sugar, treatments, cr_on;
    `;

    const result = await queries.custom_query(sql);

    const record = Array.isArray(result)
      ? result[0]
      : (result?.rows?.[0] ?? result?.[0]);

    if (!record) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient not found.",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient sugar saved successfully.",
      data: record,
    });
  } catch (error) {
    console.error("addPatientSugar error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to save patient sugar.",
    });
  }
}

async function getPatientSugarHistory(req, res) {
  try {
    const { patient_id } = req.data || {};
    const patientId = Number(patient_id);

    if (!Number.isInteger(patientId) || patientId <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid patient ID is required.",
      });
    }

    const patientTable = schema + ".patients";
    const sugarTable = schema + ".patient_sugar";

    const patientResult = await queries.custom_query(`
      SELECT
        id,
        row_id,
        name,
        age,
        gender,
        ipd_no,
        bed_no,
        diagnosis,
        old_history,
        admitted_at,
        discharged_at
      FROM ${patientTable}
      WHERE id = ${patientId}
      LIMIT 1;
    `);

    const patient = Array.isArray(patientResult)
      ? patientResult[0]
      : (patientResult?.rows?.[0] ?? patientResult?.[0]);

    if (!patient) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient not found.",
      });
    }

    const sugarResult = await queries.custom_query(`
      SELECT
        id,
        row_id,
        patient_id,
        sugar,
        treatments,
        cr_on,
        up_on
      FROM ${sugarTable}
      WHERE patient_id = ${patientId}
      ORDER BY cr_on DESC, id DESC;
    `);

    const sugarRecords = Array.isArray(sugarResult)
      ? sugarResult
      : (sugarResult?.rows ?? []);

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient sugar history fetched successfully.",
      data: {
        patient,
        sugarRecords,
      },
    });
  } catch (error) {
    console.error("getPatientSugarHistory error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch patient sugar history.",
    });
  }
}

async function updatePatientSugar(req, res) {
  try {
    const { patient_id, sugar, treatments = "" } = req.data || {};

    const patientId = Number(patient_id);
    const sugarValue = Number(sugar);

    if (
      !Number.isInteger(patientId) ||
      patientId <= 0 ||
      sugar === null ||
      sugar === undefined ||
      sugar === "" ||
      !Number.isFinite(sugarValue) ||
      sugarValue <= 0 ||
      sugarValue > 2000
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid patient ID and sugar value are required.",
      });
    }

    const sqlValue = (value) =>
      value === null || value === undefined
        ? "NULL"
        : `'${String(value).replace(/'/g, "''")}'`;

    const rowId = libFunc.randomid();

    const sql = `
      WITH updated AS (
        UPDATE abg.patient_sugar
        SET
          sugar = ${sugarValue},
          treatments = ${sqlValue(treatments)},
          up_on = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id
          FROM abg.patient_sugar
          WHERE patient_id = ${patientId}
          ORDER BY cr_on DESC, id DESC
          LIMIT 1
        )
        RETURNING id, row_id, patient_id, sugar, treatments, cr_on, up_on
      ),
      inserted AS (
        INSERT INTO abg.patient_sugar (
          row_id,
          patient_id,
          sugar,
          treatments
        )
        SELECT
          ${sqlValue(rowId)},
          p.id,
          ${sugarValue},
          ${sqlValue(treatments)}
        FROM abg.patients p
        WHERE p.id = ${patientId}
          AND NOT EXISTS (SELECT 1 FROM updated)
        RETURNING id, row_id, patient_id, sugar, treatments, cr_on, up_on
      )
      SELECT * FROM updated
      UNION ALL
      SELECT * FROM inserted;
    `;

    const result = await queries.custom_query(sql);
    const record = Array.isArray(result)
      ? result[0]
      : (result?.rows?.[0] ?? result?.[0]);

    if (!record) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Patient not found.",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient sugar and treatment updated successfully.",
      data: record,
    });
  } catch (error) {
    console.error("updatePatientSugar error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to update patient sugar.",
    });
  }
}

async function getAllPatientCurrentSugar(req, res) {
  try {
    const sql = `
      SELECT
        p.id AS patient_id,
        p.name,
        p.age,
        p.gender,
        p.bed_no,
        s.id AS sugar_record_id,
        s.sugar,
        s.treatments,
        s.cr_on,
        s.up_on
      FROM abg.patients p
      LEFT JOIN LATERAL (
        SELECT
          id,
          sugar,
          treatments,
          cr_on,
          up_on
        FROM abg.patient_sugar
        WHERE patient_id = p.id
        ORDER BY cr_on DESC, id DESC
        LIMIT 1
      ) s ON TRUE
      ORDER BY p.name ASC;
    `;

    const result = await queries.custom_query(sql);
    const patients = Array.isArray(result) ? result : (result?.rows ?? []);

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Patient sugar data fetched successfully.",
      data: patients,
    });
  } catch (error) {
    console.error("getAllPatientCurrentSugar error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch patient sugar data.",
    });
  }
}

async function getCurrentProfile(req, res) {
  console.log("log", req);
  try {
    const tablename = schema + ".users";
    const userId = req.data?.userId;

    if (!userId) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User ID not found. Please login again",
      });
    }

    const result = await queries.custom_query(
      `SELECT
        row_id,
        name,
        email,
        role,
        is_active,
        cr_on,
        up_on
      FROM ${tablename}
      WHERE row_id = '${userId}'
        AND deleted_at IS NULL
      LIMIT 1`,
    );

    if (!result || result.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User not found or account deleted",
      });
    }

    const user = result[0];

    if (user.is_active !== true) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Your account is inactive",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Profile fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("getCurrentProfile error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch profile",
    });
  }
}

async function updateCurrentProfile(req, res) {
  try {
    const tablename = schema + ".users";
    const userId = req.data?.userId;

    const { name, email, currentPassword, newPassword } = req.data || {};

    // 1. Validate logged-in user
    if (!userId) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User ID not found. Please login again",
      });
    }

    // 2. Validate name and email
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Name and email are required",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length > 100 || cleanEmail.length > 255) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Name or email is too long",
      });
    }

    // 3. Password fields must be supplied together
    const changingPassword =
      currentPassword !== undefined || newPassword !== undefined;

    if (
      changingPassword &&
      (typeof currentPassword !== "string" ||
        !currentPassword ||
        typeof newPassword !== "string" ||
        !newPassword)
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Current password and new password are required",
      });
    }

    if (changingPassword && newPassword.length < 8) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "New password must be at least 8 characters",
      });
    }

    if (changingPassword && currentPassword === newPassword) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "New password must be different from current password",
      });
    }

    // Escape SQL string values
    // Parameterized queries are preferred if supported by your query helper.
    const escapeSql = (value) => String(value).replace(/'/g, "''");

    const safeUserId = escapeSql(userId);

    // 4. Get current user
    const currentUser = await queries.custom_query(
      `SELECT row_id, is_active, password_hash
       FROM ${tablename}
       WHERE row_id = '${safeUserId}'
         AND deleted_at IS NULL
       LIMIT 1`,
    );

    if (!currentUser || currentUser.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User not found",
      });
    }

    const user = currentUser[0];

    if (user.is_active !== true) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Your account is inactive",
      });
    }

    // 5. Verify current password and prepare new password
    if (changingPassword) {
      if (user.password_hash !== currentPassword) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: "Current password is incorrect",
        });
      }
    }

    // 6. Check duplicate email
    const duplicateEmail = await queries.custom_query(
      `SELECT row_id
       FROM ${tablename}
       WHERE LOWER(email) = '${escapeSql(cleanEmail)}'
         AND row_id != '${safeUserId}'
         AND deleted_at IS NULL
       LIMIT 1`,
    );

    if (duplicateEmail && duplicateEmail.length > 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Email is already registered",
      });
    }

    // 7. Update profile and optional password
    let updateQuery = `
      UPDATE ${tablename}
      SET
        name = '${escapeSql(cleanName)}',
        email = '${escapeSql(cleanEmail)}',
        up_on = NOW()
    `;

    if (changingPassword) {
      // Plain-text storage requested for the existing implementation
      updateQuery += `,
        password_hash = '${escapeSql(newPassword)}'
      `;
    }

    updateQuery += `
      WHERE row_id = '${safeUserId}'
        AND deleted_at IS NULL
    `;

    await queries.custom_query(updateQuery);

    // 8. Return updated profile without password
    const result = await queries.custom_query(
      `SELECT
         row_id,
         name,
         email,
         role,
         is_active,
         cr_on,
         up_on
       FROM ${tablename}
       WHERE row_id = '${safeUserId}'
         AND deleted_at IS NULL
       LIMIT 1`,
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: changingPassword
        ? "Profile and password updated successfully"
        : "Profile updated successfully",
      data: result?.[0] || {},
    });
  } catch (error) {
    console.error("updateCurrentProfile error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to update profile",
    });
  }
}

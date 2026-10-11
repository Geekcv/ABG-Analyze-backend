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
  fetch_user:getAllUsers
};

const schema = "abg";

async function registerUser(req, res) {
  console.log("req", req);
  try {
    const tablename = schema + ".users";

    const { name, email, password } = req.data || {};

    // Validation
    if (!name || !email || !password) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Name, email and password are required",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    const row_id = libFunc.randomid();

    // Check email already exists
    const checkEmail = await queries.custom_query(
      `SELECT id FROM ${tablename}
       WHERE LOWER(email) = LOWER('${cleanEmail}')
       LIMIT 1`,
    );

    if (checkEmail && checkEmail.length > 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Email already exists",
      });
    }

    // Save password as plain text
    const result = await queries.custom_query(
      `INSERT INTO ${tablename}
       (row_id,name, email, password_hash, role)
       VALUES ('${row_id}','${cleanName}', '${cleanEmail}', '${password}', 'USER')
       RETURNING id,row_id, name, email, role, cr_on`,
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Registration successful",
      data: result[0],
    });
  } catch (error) {
    console.error("registerUser error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Registration failed",
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

    // Get user
    const result = await queries.custom_query(
      `SELECT id, name, email, password_hash, role, is_active
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

    if (!user.is_active) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Your account is inactive",
      });
    }

    // Direct plain-text password comparison
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
          cr_on,
          up_on
       FROM ${tablename}
       WHERE role != 'ADMIN'
       ORDER BY cr_on DESC`
    );

    console.log("users",result)

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


async function getCurrentUser(req, res) {
  try {
    const tablename = schema + ".users";

    const userId = req.user.userId;

    const result = await queries.custom_query(
      `SELECT id, name, email, role, is_active, created_at
       FROM ${tablename}
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!result || result.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User not found",
      });
    }

    const user = result[0];

    if (!user.is_active) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User account is inactive",
      });
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "User details fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("getCurrentUser error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch user details",
    });
  }
}

async function changePassword(req, res) {
  try {
    const tablename = schema + ".users";

    const userId = req.user.userId;
    const { oldPassword, newPassword } = req.data || {};

    // Validation
    if (!oldPassword || !newPassword) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Old password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "New password must be at least 8 characters",
      });
    }

    // Get current password
    const result = await queries.custom_query(
      `SELECT id, password_hash, is_active
       FROM ${tablename}
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    if (!result || result.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User not found",
      });
    }

    const user = result[0];

    if (!user.is_active) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "User account is inactive",
      });
    }

    // Verify old password
    if (user.password_hash !== oldPassword) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Old password is incorrect",
      });
    }

    // Update new password
    await queries.custom_query(
      `UPDATE ${tablename}
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newPassword, userId],
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Password changed successfully",
    });
  } catch (error) {
    console.error("changePassword error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to change password",
    });
  }
}

function validateABGValues(req, res) {
  try {
    const { ph, paco2, hco3, pao2, sodium, chloride, albumin } = req.data || {};

    // Required field validation
    if (
      ph === undefined ||
      ph === null ||
      ph === "" ||
      paco2 === undefined ||
      paco2 === null ||
      paco2 === "" ||
      hco3 === undefined ||
      hco3 === null ||
      hco3 === ""
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "pH, PaCO2 and HCO3 are required",
      });
    }

    const values = {
      ph,
      paco2,
      hco3,
      pao2,
      sodium,
      chloride,
      albumin,
    };

    // Validate supplied numeric values
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (typeof value !== "number" || !Number.isFinite(value)) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: `${key} must be a valid number`,
        });
      }
    }

    // Basic input bounds, not diagnostic reference ranges
    if (ph < 0 || ph > 14) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "pH must be between 0 and 14",
      });
    }

    if (paco2 <= 0 || hco3 <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "PaCO2 and HCO3 must be greater than zero",
      });
    }

    const positiveFields = ["pao2", "sodium", "chloride", "albumin"];

    for (const field of positiveFields) {
      const value = values[field];

      if (value !== undefined && value !== null && value !== "") {
        if (value <= 0) {
          return libFunc.sendResponse(res, {
            status: 1,
            msg: `${field} must be greater than zero`,
          });
        }
      }
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG input validation successful",
      data: {
        valid: true,
        values,
      },
    });
  } catch (error) {
    console.error("validateABGValues error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to validate ABG values",
    });
  }
}

function classifyABG(req, res) {
  try {
    const { ph, paco2, hco3 } = req.data || {};

    // Required fields
    if (
      ph === undefined ||
      ph === null ||
      ph === "" ||
      paco2 === undefined ||
      paco2 === null ||
      paco2 === "" ||
      hco3 === undefined ||
      hco3 === null ||
      hco3 === ""
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "pH, PaCO2 and HCO3 are required",
      });
    }

    // Validate numeric values
    if (
      !Number.isFinite(ph) ||
      !Number.isFinite(paco2) ||
      !Number.isFinite(hco3) ||
      paco2 <= 0 ||
      hco3 <= 0 ||
      ph < 0 ||
      ph > 14
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid ABG values",
      });
    }

    let acidBaseStatus = "Normal pH range";
    let primaryAssessment = "Undetermined";

    // Common adult reference interval for initial screening
    if (ph < 7.35) {
      acidBaseStatus = "Acidemia";
    } else if (ph > 7.45) {
      acidBaseStatus = "Alkalemia";
    }

    // Initial primary-disorder assessment
    if (ph < 7.35) {
      if (paco2 > 45 && hco3 < 22) {
        primaryAssessment =
          "Acidemia with respiratory and metabolic abnormalities; possible mixed disorder";
      } else if (paco2 > 45) {
        primaryAssessment = "Respiratory acidosis pattern";
      } else if (hco3 < 22) {
        primaryAssessment = "Metabolic acidosis pattern";
      } else {
        primaryAssessment = "Acidemia; primary cause undetermined";
      }
    } else if (ph > 7.45) {
      if (paco2 < 35 && hco3 > 26) {
        primaryAssessment =
          "Alkalemia with respiratory and metabolic abnormalities; possible mixed disorder";
      } else if (paco2 < 35) {
        primaryAssessment = "Respiratory alkalosis pattern";
      } else if (hco3 > 26) {
        primaryAssessment = "Metabolic alkalosis pattern";
      } else {
        primaryAssessment = "Alkalemia; primary cause undetermined";
      }
    } else {
      primaryAssessment =
        "pH within reference interval; evaluate compensation and possible mixed disorders";
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG classification completed",
      data: {
        input: {
          ph,
          paco2,
          hco3,
        },
        acid_base_status: acidBaseStatus,
        primary_assessment: primaryAssessment,
        interpretation_status: "Preliminary; compensation not assessed",
      },
    });
  } catch (error) {
    console.error("classifyABG error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "ABG classification failed",
    });
  }
}

function analyzeABGCompensation(req, res) {
  try {
    const { ph, paco2, hco3, sodium, chloride, albumin } = req.data || {};

    // Required field validation
    if (
      ph === undefined ||
      ph === null ||
      ph === "" ||
      paco2 === undefined ||
      paco2 === null ||
      paco2 === "" ||
      hco3 === undefined ||
      hco3 === null ||
      hco3 === ""
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "pH, PaCO2 and HCO3 are required",
      });
    }

    // Numeric validation
    const requiredValues = { ph, paco2, hco3 };

    for (const [key, value] of Object.entries(requiredValues)) {
      if (!Number.isFinite(value)) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: `${key} must be a valid number`,
        });
      }
    }

    if (ph < 0 || ph > 14 || paco2 <= 0 || hco3 <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid ABG values",
      });
    }

    let compensation = {
      assessed: false,
      message: "No compensation rule selected",
    };

    // Metabolic acidosis: Winter's formula
    if (hco3 < 22 && ph < 7.35) {
      const expectedPaco2 = 1.5 * hco3 + 8;
      const lowerLimit = expectedPaco2 - 2;
      const upperLimit = expectedPaco2 + 2;

      let interpretation;

      if (paco2 < lowerLimit) {
        interpretation =
          "PaCO2 below expected range; possible additional respiratory alkalosis";
      } else if (paco2 > upperLimit) {
        interpretation =
          "PaCO2 above expected range; possible additional respiratory acidosis";
      } else {
        interpretation = "PaCO2 within expected compensation range";
      }

      compensation = {
        assessed: true,
        rule: "Winters formula",
        expected_paco2: Number(expectedPaco2.toFixed(2)),
        expected_range: {
          lower: Number(lowerLimit.toFixed(2)),
          upper: Number(upperLimit.toFixed(2)),
        },
        interpretation,
      };
    }

    // Respiratory acidosis: estimated HCO3 compensation
    else if (paco2 > 45 && ph < 7.35) {
      const deltaPaco2 = paco2 - 40;

      const acuteHco3 = 24 + deltaPaco2 * 0.1;
      const chronicHco3 = 24 + deltaPaco2 * 0.35;

      compensation = {
        assessed: true,
        rule: "Respiratory acidosis compensation estimate",
        expected_hco3: {
          acute: Number(acuteHco3.toFixed(2)),
          chronic: Number(chronicHco3.toFixed(2)),
        },
        note: "Compare measured HCO3 with expected values; clinical context is required",
      };
    }

    // Respiratory alkalosis: estimated HCO3 compensation
    else if (paco2 < 35 && ph > 7.45) {
      const deltaPaco2 = 40 - paco2;

      const acuteHco3 = 24 - deltaPaco2 * 0.2;
      const chronicHco3 = 24 - deltaPaco2 * 0.4;

      compensation = {
        assessed: true,
        rule: "Respiratory alkalosis compensation estimate",
        expected_hco3: {
          acute: Number(acuteHco3.toFixed(2)),
          chronic: Number(chronicHco3.toFixed(2)),
        },
        note: "Compare measured HCO3 with expected values; clinical context is required",
      };
    }

    // Metabolic alkalosis: approximate expected PaCO2
    else if (hco3 > 26 && ph > 7.45) {
      const expectedPaco2 = 40 + 0.7 * (hco3 - 24);

      compensation = {
        assessed: true,
        rule: "Metabolic alkalosis compensation estimate",
        expected_paco2: Number(expectedPaco2.toFixed(2)),
        expected_range: {
          lower: Number((expectedPaco2 - 5).toFixed(2)),
          upper: Number((expectedPaco2 + 5).toFixed(2)),
        },
        note: "Approximate estimate; confirm the range against your selected clinical reference",
      };
    }

    // Anion gap
    let anionGap = null;
    let correctedAnionGap = null;

    if (
      sodium !== undefined &&
      sodium !== null &&
      sodium !== "" &&
      chloride !== undefined &&
      chloride !== null &&
      chloride !== ""
    ) {
      if (
        !Number.isFinite(sodium) ||
        !Number.isFinite(chloride) ||
        sodium <= 0 ||
        chloride <= 0
      ) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: "Sodium and chloride must be valid positive numbers",
        });
      }

      anionGap = sodium - (chloride + hco3);

      if (albumin !== undefined && albumin !== null && albumin !== "") {
        if (!Number.isFinite(albumin) || albumin <= 0) {
          return libFunc.sendResponse(res, {
            status: 1,
            msg: "Albumin must be a valid positive number",
          });
        }

        correctedAnionGap = anionGap + 2.5 * (4 - albumin);
      }
    }

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "Compensation analysis completed",
      data: {
        compensation,
        anion_gap: anionGap === null ? null : Number(anionGap.toFixed(2)),
        corrected_anion_gap:
          correctedAnionGap === null
            ? null
            : Number(correctedAnionGap.toFixed(2)),
        note: "Preliminary educational estimates only; use lab-specific reference ranges and clinical review",
      },
    });
  } catch (error) {
    console.error("analyzeABGCompensation error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Compensation analysis failed",
    });
  }
}

async function saveABGReport(req, res) {
  const client = await pool.connect();

  try {
    const { report_name, ph, paco2, hco3, pao2, sodium, chloride, albumin } =
      req.data || {};

    const userId = req.user.userId;

    // Required validation
    if (
      ph === undefined ||
      ph === null ||
      ph === "" ||
      paco2 === undefined ||
      paco2 === null ||
      paco2 === "" ||
      hco3 === undefined ||
      hco3 === null ||
      hco3 === ""
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "pH, PaCO2 and HCO3 are required",
      });
    }

    // Numeric validation
    const requiredValues = { ph, paco2, hco3 };

    for (const [key, value] of Object.entries(requiredValues)) {
      if (!Number.isFinite(value)) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: `${key} must be a valid number`,
        });
      }
    }

    if (ph < 0 || ph > 14 || paco2 <= 0 || hco3 <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid ABG values",
      });
    }

    // Optional fields
    const optionalValues = { pao2, sodium, chloride, albumin };

    for (const [key, value] of Object.entries(optionalValues)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (!Number.isFinite(value) || value <= 0) {
        return libFunc.sendResponse(res, {
          status: 1,
          msg: `${key} must be a valid positive number`,
        });
      }
    }

    await client.query("BEGIN");

    // Save report
    const reportQuery = `
      INSERT INTO abg.abg_reports
      (
        user_id,
        report_name,
        ph,
        paco2,
        hco3,
        pao2,
        sodium,
        chloride,
        albumin,
        input_units
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, report_name, ph, paco2, hco3, created_at
    `;

    const reportResult = await client.query(reportQuery, [
      userId,
      report_name || "ABG Report",
      ph,
      paco2,
      hco3,
      pao2 ?? null,
      sodium ?? null,
      chloride ?? null,
      albumin ?? null,
      JSON.stringify({
        ph: "pH",
        paco2: "mmHg",
        hco3: "mmol/L",
        pao2: "mmHg",
        sodium: "mmol/L",
        chloride: "mmol/L",
        albumin: "g/dL",
      }),
    ]);

    const report = reportResult.rows[0];

    // Basic acid-base classification
    let acidBaseStatus = "Normal pH range";
    let primaryAssessment = "Undetermined";

    if (ph < 7.35) {
      acidBaseStatus = "Acidemia";

      if (paco2 > 45 && hco3 < 22) {
        primaryAssessment = "Possible mixed respiratory and metabolic disorder";
      } else if (paco2 > 45) {
        primaryAssessment = "Respiratory acidosis pattern";
      } else if (hco3 < 22) {
        primaryAssessment = "Metabolic acidosis pattern";
      } else {
        primaryAssessment = "Acidemia; cause undetermined";
      }
    } else if (ph > 7.45) {
      acidBaseStatus = "Alkalemia";

      if (paco2 < 35 && hco3 > 26) {
        primaryAssessment = "Possible mixed respiratory and metabolic disorder";
      } else if (paco2 < 35) {
        primaryAssessment = "Respiratory alkalosis pattern";
      } else if (hco3 > 26) {
        primaryAssessment = "Metabolic alkalosis pattern";
      } else {
        primaryAssessment = "Alkalemia; cause undetermined";
      }
    } else {
      primaryAssessment =
        "pH within reference interval; compensation and mixed disorders need assessment";
    }

    // Anion gap when electrolytes are supplied
    let anionGap = null;
    let correctedAnionGap = null;

    if (sodium != null && chloride != null) {
      anionGap = sodium - chloride - hco3;

      if (albumin != null) {
        correctedAnionGap = anionGap + 2.5 * (4 - albumin);
      }
    }

    const resultPayload = {
      acid_base_status: acidBaseStatus,
      primary_assessment: primaryAssessment,
      compensation_assessed: false,
      note: "Preliminary educational assessment; compensation analysis not included in this endpoint.",
    };

    // Save analysis results
    const analysisQuery = `
      INSERT INTO abg.abg_analysis_results
      (
        report_id,
        primary_assessment,
        compensation_result,
        anion_gap,
        warnings,
        result_payload,
        algorithm_version
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, report_id, anion_gap, algorithm_version, created_at
    `;

    const analysisResult = await client.query(analysisQuery, [
      report.id,
      JSON.stringify({
        acid_base_status: acidBaseStatus,
        primary_assessment: primaryAssessment,
      }),
      JSON.stringify({
        assessed: false,
        message: "Compensation analysis not included in this endpoint",
      }),
      anionGap,
      JSON.stringify([
        "Preliminary educational assessment only",
        "Clinical validation is required before patient-care use",
      ]),
      JSON.stringify({
        ...resultPayload,
        corrected_anion_gap: correctedAnionGap,
      }),
      "1.0.0",
    ]);

    await client.query("COMMIT");

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG report saved successfully",
      data: {
        report,
        analysis: analysisResult.rows[0],
        result: resultPayload,
        anion_gap: anionGap,
        corrected_anion_gap: correctedAnionGap,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("saveABGReport error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to save ABG report",
    });
  } finally {
    client.release();
  }
}

async function getABGReports(req, res) {
  try {
    const tablename = schema + ".abg_reports";

    const userId = req.user.userId;

    const page = Number(req.data?.page ?? 1);
    const limit = Number(req.data?.limit ?? 10);

    // Pagination validation
    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Invalid page or limit",
      });
    }

    const offset = (page - 1) * limit;

    // Get total reports for logged-in user
    const countResult = await queries.custom_query(
      `SELECT COUNT(*)::int AS total
       FROM ${tablename}
       WHERE user_id = $1`,
      [userId],
    );

    const total = countResult[0].total;

    // Get reports
    const result = await queries.custom_query(
      `SELECT
         id,
         user_id,
         report_name,
         ph,
         paco2,
         hco3,
         pao2,
         sodium,
         chloride,
         albumin,
         created_at
       FROM ${tablename}
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG reports fetched successfully",
      data: {
        reports: result,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("getABGReports error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch ABG reports",
    });
  }
}

async function getABGReportById(req, res) {
  try {
    const reportId = Number(req.params.id);
    const userId = req.user.userId;

    // Validate report ID
    if (!Number.isSafeInteger(reportId) || reportId <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid report ID is required",
      });
    }

    const reportTable = schema + ".abg_reports";
    const analysisTable = schema + ".abg_analysis_results";

    // Check report ownership and fetch report
    const reportResult = await queries.custom_query(
      `SELECT
         r.id,
         r.user_id,
         r.report_name,
         r.ph,
         r.paco2,
         r.hco3,
         r.pao2,
         r.sodium,
         r.chloride,
         r.albumin,
         r.input_units,
         r.created_at,
         r.updated_at
       FROM ${reportTable} r
       WHERE r.id = $1
         AND r.user_id = $2
       LIMIT 1`,
      [reportId, userId],
    );

    if (!reportResult || reportResult.length === 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "ABG report not found",
      });
    }

    const report = reportResult[0];

    // Fetch saved analysis
    const analysisResult = await queries.custom_query(
      `SELECT
         id,
         report_id,
         primary_assessment,
         compensation_result,
         anion_gap,
         warnings,
         result_payload,
         algorithm_version,
         created_at
       FROM ${analysisTable}
       WHERE report_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [reportId],
    );

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG report fetched successfully",
      data: {
        report,
        analysis:
          analysisResult && analysisResult.length > 0
            ? analysisResult[0]
            : null,
      },
    });
  } catch (error) {
    console.error("getABGReportById error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to fetch ABG report",
    });
  }
}

async function deleteABGReport(req, res) {
  const client = await pool.connect();

  try {
    const reportId = Number(req.params.id);
    const userId = req.user.userId;

    // Validate report ID
    if (!Number.isSafeInteger(reportId) || reportId <= 0) {
      return libFunc.sendResponse(res, {
        status: 1,
        msg: "Valid report ID is required",
      });
    }

    await client.query("BEGIN");

    // Verify ownership and lock the report
    const reportResult = await client.query(
      `SELECT id
       FROM abg.abg_reports
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [reportId, userId],
    );

    if (reportResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return libFunc.sendResponse(res, {
        status: 1,
        msg: "ABG report not found",
      });
    }

    // Delete associated analysis results first
    await client.query(
      `DELETE FROM abg.abg_analysis_results
       WHERE report_id = $1`,
      [reportId],
    );

    // Delete report
    await client.query(
      `DELETE FROM abg.abg_reports
       WHERE id = $1 AND user_id = $2`,
      [reportId, userId],
    );

    await client.query("COMMIT");

    return libFunc.sendResponse(res, {
      status: 0,
      msg: "ABG report deleted successfully",
      data: {
        report_id: reportId,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("deleteABGReport error:", error);

    return libFunc.sendResponse(res, {
      status: 1,
      msg: "Failed to delete ABG report",
    });
  } finally {
    client.release();
  }
}

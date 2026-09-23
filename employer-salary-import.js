(function (root) {
  "use strict";

  var NOTICE_VERSION = "employer-salary-20260923.1";
  var HEADERS = ["email", "full_name", "business_unit", "team", "annual_base_salary", "salary_currency"];
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Strict CSV parsing: malformed quotes and ambiguous columns never become
  // silently repaired salary amounts. Error messages never echo cell contents.
  function rowsFromCSV(input) {
    var text = String(input || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    var rows = [], row = [], value = "", quoted = false, closed = false;
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') { quoted = false; closed = true; }
        else value += char;
      } else if (char === ',' || char === '\n') {
        row.push(value); value = ""; closed = false;
        if (char === '\n') { rows.push(row); row = []; }
      } else if (char === '"') {
        if (value || closed) throw new Error("CSV contains an unexpected quotation mark.");
        quoted = true;
      } else {
        if (closed) throw new Error("CSV contains text after a closing quotation mark.");
        value += char;
      }
    }
    if (quoted) throw new Error("CSV contains an unclosed quotation mark.");
    if (value || row.length || closed) { row.push(value); rows.push(row); }
    return rows;
  }

  function validateCSV(input) {
    var parsed;
    try { parsed = rowsFromCSV(input); }
    catch (error) { return { ok: false, rows: [], errors: [{ row: 1, message: error.message }] }; }
    if (!parsed.length) return { ok: false, rows: [], errors: [{ row: 1, message: "Add a header and at least one recipient." }] };
    var headers = parsed[0].map(function (value) { return value.trim().toLowerCase(); });
    var errors = [], rows = [], emails = new Set();
    if (new Set(headers).size !== headers.length) errors.push({ row: 1, message: "Each column header must appear only once." });
    if (headers.some(function (header) { return HEADERS.indexOf(header) < 0; })) errors.push({ row: 1, message: "Use only the column headers shown in the salary template." });
    ["email", "annual_base_salary", "salary_currency"].forEach(function (header) {
      if (headers.indexOf(header) < 0) errors.push({ row: 1, message: "Missing required column: " + header + "." });
    });
    if (errors.length) return { ok: false, rows: [], errors: errors };
    parsed.slice(1).forEach(function (cells, index) {
      var line = index + 2;
      if (cells.every(function (cell) { return cell === ""; })) return;
      if (cells.length !== headers.length) { errors.push({ row: line, message: "The number of cells does not match the header." }); return; }
      var record = {};
      headers.forEach(function (header, position) { record[header] = cells[position].trim(); });
      if (!EMAIL.test(record.email)) errors.push({ row: line, message: "Enter a valid recipient email." });
      var key = record.email.toLowerCase();
      if (emails.has(key)) errors.push({ row: line, message: "Duplicate recipient email. Keep one row per person." });
      emails.add(key);
      var salary = record.annual_base_salary;
      if (salary && (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(salary) || !Number.isFinite(Number(salary)) || Number(salary) <= 0 || Number(salary) > 10000000)) {
        errors.push({ row: line, message: "Annual base salary must be a positive amount up to 10,000,000 with at most two decimal places; omit currency symbols and thousands separators." });
      }
      if (salary && record.salary_currency !== "USD") errors.push({ row: line, message: "Salary currency must be USD. Other currencies are not supported." });
      if (!salary && record.salary_currency) errors.push({ row: line, message: "Leave currency blank when no salary is supplied." });
      rows.push(record);
    });
    if (!rows.length && !errors.length) errors.push({ row: 2, message: "Add at least one recipient." });
    return { ok: errors.length === 0, rows: errors.length ? [] : rows, errors: errors, salaryCount: errors.length ? 0 : rows.filter(function (row) { return !!row.annual_base_salary; }).length };
  }

  function hasSalaryColumns(input) {
    return /salary|compensation/i.test(String(input || "").split(/[\r\n]/)[0]);
  }

  function validateSettings(hours, overhead) {
    function decimal(value) {
      if (typeof value !== "string" && typeof value !== "number") return null;
      var text = String(value).trim();
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) return null;
      var number = Number(text);
      return Number.isFinite(number) ? number : null;
    }
    var annualHours = decimal(hours), percent = decimal(overhead);
    if (annualHours === null || annualHours <= 0 || annualHours > 8784) return { ok: false, error: "Enter annual working hours greater than zero and no more than 8,784, using at most two decimal places." };
    if (percent === null || percent < 0 || percent > 300) return { ok: false, error: "Enter benefits and overhead as a percentage from 0 to 300, using at most two decimal places. Enter 0 explicitly if none is included." };
    return { ok: true, settings: { annual_working_hours: annualHours, benefits_overhead_percent: percent } };
  }

  root.MondermanEmployerSalaryImport = Object.freeze({
    noticeVersion: NOTICE_VERSION,
    parse: validateCSV,
    validateSettings: validateSettings,
    hasSalaryColumns: hasSalaryColumns,
    template: "email,annual_base_salary,salary_currency\nalex@example.com,85000,USD\njordan@example.com,,\n"
  });
})(typeof window !== "undefined" ? window : globalThis);

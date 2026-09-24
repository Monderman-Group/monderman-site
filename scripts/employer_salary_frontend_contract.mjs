import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const scope = vm.createContext({ window: {} });
vm.runInContext(read("employer-salary-import.js"), scope);
const importer = scope.window.MondermanEmployerSalaryImport;
const header = "email,annual_base_salary,salary_currency\n";
assert.equal(importer.parse(header + "alex@example.com,85000,USD\njordan@example.com,,\n").salaryCount, 1);
assert.equal(importer.parse(header + '"alex@example.com","85000.25","USD"').ok, true);
assert.equal(importer.parse("\uFEFF" + header + "alex@example.com,85000,USD").ok, true);
for (const invalid of ["0", "-2", "1e5", "85000USD", "$85000", "85,000", "085000", "12.001", "Infinity", "NaN", "10000001", "=85000"]) {
  const result = importer.parse(header + `alex@example.com,"${invalid}",USD`);
  assert.equal(result.ok, false, invalid);
  assert.equal(result.rows.length, 0, "an invalid amount must not yield a partial import");
}
for (const body of [
  "alex@example.com,85000,EUR", "alex@example.com,85000,usd", "alex@example.com,85000,",
  "alex@example.com,,USD", "wrong,85000,USD", '"alex@example.com,85000,USD',
  '"alex@example.com"x,85000,USD', "alex@example.com,85000,USD,extra",
  "alex@example.com,85000,USD\nAlex@example.com,95000,USD"
]) assert.equal(importer.parse(header + body).ok, false, body);
assert.equal(importer.parse("email,annual_base_salary,salary_currency,salary_currency\nalex@example.com,80000,USD,USD").ok, false);
assert.equal(importer.parse("email,annual_base_salary\nalex@example.com,80000").ok, false);
assert.equal(importer.parse(header + "alex@example.com,9999999999,USD").errors.some((error) => error.message.includes("9999999999")), false, "error messages must not echo amounts");
assert.equal(importer.hasSalaryColumns(header), true);
for (const [hours, overhead] of [["", "30"], ["2080", ""], ["0", "30"], ["8784.01", "0"], ["2080", "300.01"], ["1e3", "30"], ["2080", "-1"], ["2080", "12.001"], [null, "0"], ["2080", null], ["2,080", "30%"]]) {
  assert.equal(importer.validateSettings(hours, overhead).ok, false, "settings must be explicit, unambiguous, and bounded");
}
for (const [hours, overhead] of [["2080", "0"], ["1920", "27.5"], ["8784", "300"], ["0.01", "0"]]) {
  const result = importer.validateSettings(hours, overhead);
  assert.equal(result.ok, true);
  assert.equal(result.settings.annual_working_hours, Number(hours));
  assert.equal(result.settings.benefits_overhead_percent, Number(overhead));
}

let resolvedConfig;
const assignmentScope = vm.createContext({
  window: { location: { search: "?assignment_token=local-test" } },
  URLSearchParams,
  fetch: async () => ({ json: async () => ({ ok: true, assignment: resolvedConfig }) })
});
vm.runInContext(read("assignment-mode.js"), assignmentScope);
const assignment = assignmentScope.window.MondermanAssignment;
const fields = [{ id: "employeeCount" }, { id: "hourlyCost" }, { id: "frequency" }];
assert.equal(assignment.prestartFields(fields, {}).length, 3, "unassigned diagnostic retains its cost question");
for (const tool of ["decision_velocity", "structural_clarity", "operational_systems", "institutional_performance"]) {
  for (const lens of ["operational", "managerial", "executive"]) {
    for (const depth of ["10", "30", "60", "choice"]) {
      resolvedConfig = { tool_type: tool, participant_lens: lens, depth, omit_hourly_cost_question: true };
      await assignment.resolve("local-test");
      const values = { hourlyCost: 111, hourlyRate: 222, frequency: 10 };
      assert.deepEqual(Array.from(assignment.prestartFields(fields, values), (field) => field.id), ["employeeCount", "frequency"]);
      assert.deepEqual(values, { frequency: 10 }, "old draft cost must be dropped");
    }
  }
}
for (const capability of [undefined, false, "true", 1]) {
  resolvedConfig = { omit_hourly_cost_question: capability };
  await assignment.resolve("local-test");
  assert.equal(assignment.prestartFields(fields, {}).length, 3, "only the server boolean capability may omit the cost question");
}
for (const file of ["decision-velocity.html", "structural-clarity.html", "operational-systems.html", "institutional-performance.html"]) {
  const source = read(file);
  assert.match(source, /function activePrestartFields\(\)/, file);
  assert.match(source, /MondermanAssignment\?\.prestartFields\(PRESTART_FIELDS, state.preflight\)/, file);
  assert.match(source, /activePrestartFields\(\)\.forEach/, `${file} reads only active fields`);
  assert.match(source, /enhanceFields\(mount, activePrestartFields\(\)\)/, `${file} pager sees only active fields`);
  assert.doesNotMatch(source, /annual_base_salary|salary_currency|salaryAuthorization/, `${file} must contain no salary UI or supplied amounts`);
}
const composer = read("workspace-diagnostics.html");
const draft = composer.slice(composer.indexOf("function collectDraft()"), composer.indexOf("function draftMeaningful"));
assert.doesNotMatch(draft, /employerSalaries|annual_base_salary|salary_currency/);
assert.doesNotMatch(draft, /salaryAnnualHours|salaryOverheadPercent|salary_annual_working_hours|salary_benefits_overhead_percent/, "new campaign settings are not silently restored from a draft");
assert.match(composer, /if\(state.salarySendAttempt\?\.material===material\) return state.salarySendAttempt.key/, "salary send retries must retain their in-memory identity");
assert.ok(composer.indexOf("return state.salarySendAttempt.key;") < composer.indexOf("const fingerprint=await campaignPayloadFingerprint(material)"), "salary fingerprints must not reach localStorage");
assert.match(composer, /id="salaryAuthorization">/, "attestation starts unchecked");
assert.match(composer, /data.enabled===true && data.can_upload===true/);
assert.match(composer, /data.can_configure===true/);
for(const id of ["salaryAnnualHours","salaryOverheadPercent"]){
  const input=composer.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0];
  assert.ok(input);
  assert.doesNotMatch(input,/\bvalue=/,"no preset conversion value");
}
const settings = read("employer-salary-settings.js");
assert.doesNotMatch(settings, /localStorage|sessionStorage|console\./);
assert.match(settings, /form.append\("preview_only", String\(previewOnly\)\)/);
assert.match(settings, /id="settingsSalaryAuthority">/, "dedicated attestation starts unchecked");
assert.match(settings, /capability.enabled !== true/);
assert.match(settings, /capability.can_configure === true/);
// server.js mounts the batch-assignment router at /api/workspace; these are
// full client routes, not suffix-only mocks. Public participant resolve routes
// deliberately remain under the separate /api/assignments router.
const salaryRoutes = ["salary-capability?organization_id=", "salary-settings", "import-salaries", "salary-delegation"].map(route => "/api/workspace/assignments/" + route);
function checkSalaryRoutes(source) {
  assert.deepEqual([...source.matchAll(/\brequest\("([^"]+)"/g)].map(match=>match[1]),salaryRoutes);
  assert.match(source,/method: method \|\| "GET"/);
  for(const route of salaryRoutes.slice(1))assert.ok(source.includes(`request("${route}", "POST",`),route+' is an exact POST');
}
checkSalaryRoutes(settings);
for(const route of salaryRoutes){
  const broken=settings.replace(route,route.replace('/api/workspace/','/api/'));
  assert.notEqual(broken,settings);assert.throws(()=>checkSalaryRoutes(broken),'An unmounted route must fail the contract');
}
assert.ok(composer.includes('/api/workspace/assignments/salary-capability?organization_id=${encodeURIComponent(state.orgId)}'));
for(const file of readdirSync(new URL('../',import.meta.url)).filter(name=>/\.(?:html|js)$/.test(name)))
  assert.doesNotMatch(read(file),/\/api\/assignments\/(?:salary-capability|salary-settings|salary-delegation|import-salaries)\b/,file+': no unmounted employer-salary endpoint');
assert.match(read('workspace-settings.html'),/employer-salary-settings\.js\?v=20260923\.2/,'Corrected module has a new cache identity');
assert.doesNotMatch(settings, /form.append\("(?:salary_)?(?:annual_working_hours|benefits_overhead_percent)"/, "salary import cannot override saved campaign settings");
console.log("Salary frontend contract passed: strict CSV, 48 assigned role/depth combinations, no saved salary drafts, explicit permission and attestation gates. Browser checks not run.");

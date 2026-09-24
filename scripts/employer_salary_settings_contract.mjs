import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Run the shipped settings module with a minimal DOM and a mock API. This is
// not a browser, layout, database, or production-network test.
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const routeMethods = Object.freeze({
  "/api/workspace/assignments/salary-capability":"GET",
  "/api/workspace/assignments/salary-settings":"POST",
  "/api/workspace/assignments/import-salaries":"POST",
  "/api/workspace/assignments/salary-delegation":"POST"
});
const authHeaders = () => ({Authorization:"Bearer SETTINGS-FIXTURE-ONLY","X-Monderman-Organization-Id":"org-test"});
function assertSettingsRequest(address, options) {
  const url=new URL(address), headers=new Headers(options.headers);
  assert.equal(url.origin,"https://local.invalid","exact API origin");
  assert.ok(Object.hasOwn(routeMethods,url.pathname),"exact mounted Workspace salary route");
  assert.equal(options.method,routeMethods[url.pathname],"exact salary route method");
  assert.equal(url.search,url.pathname==="/api/workspace/assignments/salary-capability"?"?organization_id=org-test":"","exact capability query; no mutation query");
  assert.equal(headers.get("authorization"),"Bearer SETTINGS-FIXTURE-ONLY","salary request carries caller authorization");
  assert.equal(headers.get("x-monderman-organization-id"),"org-test","salary request carries selected Workspace");
  return url.pathname;
}
let routeNegativeControls=0;
for (const [pathname,method] of Object.entries(routeMethods)) {
  const address="https://local.invalid"+pathname+(method==="GET"?"?organization_id=org-test":"");
  const options={method,headers:authHeaders()};
  assertSettingsRequest(address,options);
  for (const [wrongAddress,wrongOptions] of [
    [address.replace("/api/workspace/assignments/","/api/assignments/"),options],
    [address,{...options,method:method==="GET"?"POST":"GET"}],
    [address.replace("local.invalid","wrong.invalid"),options],
    [address+(method==="GET"?"&unexpected=true":"?organization_id=org-test"),options],
    [address,{...options,headers:{"X-Monderman-Organization-Id":"org-test"}}],
    [address,{...options,headers:{...authHeaders(),"X-Monderman-Organization-Id":"other-org"}}]
  ]) { assert.throws(()=>assertSettingsRequest(wrongAddress,wrongOptions)); routeNegativeControls++; }
  if(method==="GET")for(const query of ["", "?organization_id=other-org"]){
    assert.throws(()=>assertSettingsRequest("https://local.invalid"+pathname+query,options));routeNegativeControls++;
  }
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function tick() { await new Promise(setImmediate); }
async function fixture({admin=true, configured=false, enabled=true}={}) {
  const elements = new Map(), requests = [], transportErrors=[];
  class Element {
    constructor(id, parent=null) { this.id=id; this.parent=parent; this.children=[]; this.listeners={}; this.value=""; this.checked=false; this.disabled=false; this.hidden=false; this._html=""; this.textContent=""; }
    set innerHTML(html) {
      const remove=node=>{ node.children.forEach(remove); elements.delete(node.id); };
      this.children.forEach(remove); this.children=[]; this._html=html;
      for (const match of html.matchAll(/<(?:[a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
        const element=new Element(match[1],this); element.disabled=/\bdisabled\b/.test(match[0]);
        this.children.push(element); elements.set(element.id,element);
      }
    }
    get innerHTML() { return this._html; }
    querySelector(selector) { return elements.get(selector.replace(/^#/,"")) || null; }
    querySelectorAll() { return []; }
    addEventListener(name,listener) { this.listeners[name]=listener; }
    async fire(name,event={}) { await this.listeners[name]?.({target:this,...event}); await tick(); assert.deepEqual(transportErrors,[],"no invalid salary transport hidden by UI error handling"); }
  }
  const host=new Element("employerSalarySettings"); elements.set(host.id,host);
  const capability={ok:true,enabled,can_upload:true,can_delegate:admin,can_configure:admin,currency:"USD",notice_version:"employer-salary-20260923.1",eligible_batches:[
    {id:"campaign-a",label:"Operations",salary_settings:configured?{annual_working_hours:2080,benefits_overhead_percent:0,locked:true}:null},
    {id:"campaign-b",label:"Finance",salary_settings:null}
  ]};
  const scope=vm.createContext({window:{},document:{getElementById:id=>elements.get(id)},FormData,Blob,URL,setTimeout,
    fetch:async (url,options)=>{
      let pathname;
      try { pathname=assertSettingsRequest(url,options); }
      catch (error) { transportErrors.push(error.message); throw error; }
      requests.push({url,options});
      if(pathname==="/api/workspace/assignments/salary-capability")return{ok:true,json:async()=>JSON.parse(JSON.stringify(capability))};
      if(pathname==="/api/workspace/assignments/salary-settings"){
        const body=JSON.parse(options.body); assert.ok(admin,"Analyst cannot save settings");
        capability.eligible_batches.find(batch=>batch.id===body.batch_id).salary_settings={annual_working_hours:body.annual_working_hours,benefits_overhead_percent:body.benefits_overhead_percent,locked:true};
      }
      return{ok:true,json:async()=>({ok:true,invalid_rows:[]})};
    }
  });
  vm.runInContext(read("employer-salary-import.js"),scope);
  vm.runInContext(read("employer-salary-settings.js"),scope);
  await scope.window.MondermanEmployerSalarySettings.mount({organizationId:"org-test",apiBase:"https://local.invalid",headers:async()=>authHeaders(),members:[]});
  assert.deepEqual(transportErrors,[],"no invalid salary capability hidden by UI error handling");
  const field=id=>elements.get(id);
  async function campaign(id) { field("salaryBatch").value=id; await field("salaryBatch").fire("change"); }
  async function file() {
    field("settingsSalaryFile").files=[{size:90,text:async()=>"email,annual_base_salary,salary_currency\na@example.test,98765.43,USD\n"}];
    await field("settingsSalaryFile").fire("change");
  }
  return{field,host,requests,capability,campaign,file};
}

{
  const f=await fixture({enabled:false});
  assert.equal(f.host.hidden,true); assert.equal(f.field("salaryBatch"),undefined);
}
{
  const f=await fixture(); await f.campaign("campaign-a");
  assert.equal(f.field("settingsSalaryHours").value,""); assert.equal(f.field("settingsSalaryOverhead").value,"");
  await f.field("settingsSalarySaveCalculation").fire("click");
  assert.equal(f.requests.length,1,"blank settings produce no mutation");
  f.field("settingsSalaryHours").value="1920"; f.field("settingsSalaryOverhead").value="0";
  await f.field("settingsSalarySaveCalculation").fire("click");
  assert.deepEqual(JSON.parse(f.requests[1].options.body),{organization_id:"org-test",batch_id:"campaign-a",annual_working_hours:1920,benefits_overhead_percent:0});
  assert.equal(f.field("settingsSalaryHours"),undefined,"saved values cannot be edited");
  assert.match(f.field("salaryCampaignSettings").innerHTML,/<strong>0% of base salary<\/strong>/,"zero must not disappear");
  assert.equal(f.field("salaryBatch").value,"campaign-a");
  await f.file(); assert.equal(f.field("settingsSalaryAuthority").checked,false);
  assert.equal(f.field("settingsSalaryPreview").disabled,true);
  f.field("settingsSalaryAuthority").checked=true; await f.field("settingsSalaryAuthority").fire("change");
  await f.field("settingsSalaryPreview").fire("click");
  assert.equal(f.field("settingsSalarySave").disabled,false);
  const preview=f.requests.at(-1).options.body;
  assert.equal(preview.get("preview_only"),"true");
  assert.equal(preview.get("annual_working_hours"),null); assert.equal(preview.get("salary_annual_working_hours"),null);
  assert.equal(preview.get("benefits_overhead_percent"),null); assert.equal(preview.get("salary_benefits_overhead_percent"),null);
  assert.doesNotMatch(f.field("settingsSalaryResult").textContent,/98765/);
  await f.field("settingsSalarySave").fire("click");
  assert.equal(f.requests.at(-1).options.body.get("preview_only"),"false");
  assert.equal(f.field("settingsSalaryAuthority").checked,false);
  assert.equal(f.field("settingsSalaryPreview").disabled,true);
}
{
  const f=await fixture({admin:false,configured:true}); await f.campaign("campaign-a");
  assert.equal(f.field("settingsSalarySaveCalculation"),undefined);
  assert.equal(f.field("settingsSalaryHours"),undefined);
  await f.file(); f.field("settingsSalaryAuthority").checked=true; await f.field("settingsSalaryAuthority").fire("change");
  await f.field("settingsSalaryPreview").fire("click");
  assert.equal(f.requests.at(-1).options.body.get("batch_id"),"campaign-a");
  await f.campaign("campaign-b");
  assert.equal(f.field("settingsSalaryAuthority").checked,false);
  await f.file(); f.field("settingsSalaryAuthority").checked=true; await f.field("settingsSalaryAuthority").fire("change");
  const count=f.requests.length; await f.field("settingsSalaryPreview").fire("click");
  assert.equal(f.requests.length,count,"unconfigured campaign cannot import even when an Analyst has upload authority");
}
{
  const f=await fixture({configured:true}); await f.campaign("campaign-a");
  const delayed=deferred(); f.field("settingsSalaryFile").files=[{size:90,text:()=>delayed.promise}];
  const reading=f.field("settingsSalaryFile").fire("change"); await f.campaign("campaign-b");
  delayed.resolve("email,annual_base_salary,salary_currency\na@example.test,98765.43,USD\n"); await reading;
  assert.equal(f.field("settingsSalaryResult").textContent,"");
  assert.equal(f.field("settingsSalaryPreview").disabled,true,"late file reads cannot attach data to a different campaign");
}
console.log(`Salary settings interaction contract passed: four exact mounted routes, ${routeNegativeControls} rejected transport mutations, explicit values, zero overhead, immutable settings, Admin/Analyst separation, preview/apply payloads, release gate and stale-file protection. Mock DOM/API only; no browser or production requests.`);

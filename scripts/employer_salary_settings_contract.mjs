import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Run the shipped settings module with a minimal DOM and a mock API. This is
// not a browser, layout, database, or production-network test.
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function tick() { await new Promise(setImmediate); }
async function fixture({admin=true, configured=false, enabled=true}={}) {
  const elements = new Map(), requests = [];
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
    async fire(name,event={}) { await this.listeners[name]?.({target:this,...event}); await tick(); }
  }
  const host=new Element("employerSalarySettings"); elements.set(host.id,host);
  const capability={ok:true,enabled,can_upload:true,can_delegate:admin,can_configure:admin,currency:"USD",notice_version:"employer-salary-20260923.1",eligible_batches:[
    {id:"campaign-a",label:"Operations",salary_settings:configured?{annual_working_hours:2080,benefits_overhead_percent:0,locked:true}:null},
    {id:"campaign-b",label:"Finance",salary_settings:null}
  ]};
  const scope=vm.createContext({window:{},document:{getElementById:id=>elements.get(id)},FormData,Blob,URL,setTimeout,
    fetch:async (url,options)=>{
      assert.ok(url.startsWith("https://local.invalid/api/assignments/"));
      requests.push({url,options});
      if(url.includes("salary-capability?"))return{ok:true,json:async()=>JSON.parse(JSON.stringify(capability))};
      if(url.endsWith("/salary-settings")){
        const body=JSON.parse(options.body); assert.ok(admin,"Analyst cannot save settings");
        capability.eligible_batches.find(batch=>batch.id===body.batch_id).salary_settings={annual_working_hours:body.annual_working_hours,benefits_overhead_percent:body.benefits_overhead_percent,locked:true};
      }
      return{ok:true,json:async()=>({ok:true,invalid_rows:[]})};
    }
  });
  vm.runInContext(read("employer-salary-import.js"),scope);
  vm.runInContext(read("employer-salary-settings.js"),scope);
  await scope.window.MondermanEmployerSalarySettings.mount({organizationId:"org-test",apiBase:"https://local.invalid",headers:async()=>({}),members:[]});
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
console.log("Salary settings interaction contract passed: explicit values, zero overhead, immutable settings, Admin/Analyst separation, preview/apply payloads, release gate and stale-file protection. Mock DOM/API only; no browser or production requests.");

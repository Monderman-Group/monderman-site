import assert from "node:assert/strict";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.SITE_BASE || "http://127.0.0.1:4173";
let cases=0;
for (const [name,type] of [["chromium",chromium],["webkit",webkit]]) {
 const browser=await type.launch({headless:true});
 try {
  for (const width of [390,768,1440]) {
   const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:"reduce"});
   await context.addInitScript(()=>{
    // Offline anonymous Auth double. This suite tests public presentation and
    // retirement, not real account sessions or the separate access gate.
    window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({})}})};
    localStorage.setItem("monderman_measurement_choice",JSON.stringify({choice:"allow",version:"2026-09-10-v1"}));
    sessionStorage.setItem("monderman_first_run_journey","10000000-1000-4000-8000-100000000000");
    sessionStorage.setItem("monderman_first_run_attribution",JSON.stringify({acquisitionSource:"email",acquisitionCampaign:"first-dv-202609"}));
    sessionStorage.setItem("evaluation-test-saved-run","preserve");
   });
   const page=await context.newPage(),events=[],errors=[];
   page.on("pageerror",error=>errors.push(error.message));
   await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/api/first-run-events")events.push(route.request().postData());
    return url.origin===new URL(base).origin?route.continue():route.abort();
   });
   for (const file of ["index.html","pilot.html","platform-services.html","Monderman_Platform_Brief.html","new-in-the-role.html","after-an-acquisition.html","after-a-reorganization.html","transformation-behind-schedule.html"]) {
    await page.goto(base+"/"+file,{waitUntil:"load"});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator("h1").count(),1,name+"/"+width+"/"+file);
    assert.equal(await page.locator("#siteHeader .site-entry-link").getAttribute("href"),"pilot.html");
    assert.equal(await page.locator("#siteHeader .site-entry-link").textContent(),"Request an invitation");
    assert.equal(await page.locator("#mnd-measurement-panel,#mnd-measurement-settings,[data-measurement-settings]").count(),0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),name+"/"+width+"/"+file+": overflow");
    if(await page.locator('script[src*="first-run-telemetry.js"]').count()){
     assert.equal(await page.evaluate(()=>MondermanFirstRun.isMeasurementAllowed()),false);
     assert.equal(await page.evaluate(()=>localStorage.getItem("monderman_measurement_choice")),null);
     assert.equal(await page.evaluate(()=>sessionStorage.getItem("monderman_first_run_journey")),null);
     assert.equal(await page.evaluate(()=>sessionStorage.getItem("evaluation-test-saved-run")),"preserve");
     await page.evaluate(()=>{MondermanFirstRun.track("primary_cta_clicked");MondermanFirstRun.trackOnce("diagnostic_started");MondermanFirstRun.openMeasurementChoices();});
    }
    cases++;
   }
   assert.deepEqual(events,[],name+"/"+width+": retired telemetry must never send");
   assert.deepEqual(errors,[],name+"/"+width+": runtime errors");
   await context.close();
  }
 } finally {await browser.close();}
}
console.log(JSON.stringify({passed:true,cases,engines:2,widths:[390,768,1440],retiredAllowPreferenceTested:true,productionRequests:0}));

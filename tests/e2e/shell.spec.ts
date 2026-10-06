import { test, expect, type Page } from '@playwright/test';
async function signedIn(page: Page) {
 await page.addInitScript(()=>{
   const uid='00000000-0000-4000-8000-000000000001';const expires=Math.floor(Date.now()/1000)+3600;
   const jwt=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:expires,iat:expires-3600,aud:'authenticated',role:'authenticated'}))+'.test-signature';
   localStorage.setItem('sb-localhost-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-only-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{user_name:'Test user'},created_at:new Date().toISOString()}}));
 });
}

test('configured app presents OAuth sign-in before any project data',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Accedi con GitHub →'})).toBeVisible();
 await expect(page.getByText('Test workspace')).toHaveCount(0);
});
test('real Monaco component edits through the durable collaboration provider',async({page})=>{
 await signedIn(page);
 await page.goto('/projects/20000000-0000-4000-8000-000000000001/files/30000000-0000-4000-8000-000000000001');
 await expect(page.getByRole('heading',{name:'Progetto di test'})).toBeVisible();
 await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 const input=page.locator('.monaco-editor .view-lines');await input.click({position:{x:30,y:10}});await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Monaco collaborativo funziona');
 await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await expect(page.locator('.view-lines')).toContainText('Monaco collaborativo funziona');
 await page.screenshot({path:'test-results/workspace.png',fullPage:true});
});

test('OAuth login sends GitHub provider, root redirect and PKCE challenge',async({page})=>{
 await page.route('http://localhost:8788/auth/v1/authorize**',route=>route.fulfill({contentType:'text/html',body:'OAuth provider fixture'}));
 await page.goto('/');
 const outgoing=page.waitForRequest(request=>request.url().includes('/auth/v1/authorize'));
 await page.getByRole('button',{name:'Accedi con GitHub →'}).click();
 const url=new URL((await outgoing).url());
 expect(url.searchParams.get('provider')).toBe('github');
 expect(url.searchParams.get('redirect_to')).toBe('http://localhost:5173/');
 expect(url.searchParams.get('code_challenge')).toBeTruthy();
 expect(url.searchParams.get('code_challenge_method')).toBe('s256');
});
test('OAuth callback error is visible and permits another login attempt',async({page})=>{
 await page.goto('/#error=access_denied&error_description=fixture');
 await expect(page.getByRole('alert')).toContainText('Accesso non completato');
 await expect(page.getByRole('button',{name:'Accedi con GitHub →'})).toBeEnabled();
});

test('local HTTP and mutations use the frontend proxy with auth and body intact',async({page})=>{
 await signedIn(page);
 const outgoing=page.waitForRequest(request=>request.url().includes('/api/v1/bootstrap'));
 await page.goto('/');const request=await outgoing;
 expect(new URL(request.url()).origin).toBe('http://localhost:5173');
 expect(request.headers().authorization).toMatch(/^Bearer /);
 const result=await page.evaluate(async()=>{
   const response=await fetch('/api/v1/mutations',{method:'POST',headers:{Authorization:'Bearer test-proxy-token','Content-Type':'application/json'},body:JSON.stringify({op:'create_workspace',args:{name:'Proxy workspace'}})});
   return {status:response.status,body:await response.json()};
 });
 expect(result.status).toBe(200);expect(result.body).toEqual({op:'create_workspace',args:{name:'Proxy workspace'},authorized:true});
});
for(const mode of ['network','unavailable'] as const) test(`API ${mode} failure is actionable and a recovered backend can be retried`,async({page})=>{
 await signedIn(page);
 await page.route('**/api/v1/bootstrap',route=>mode==='network'?route.abort('failed'):route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'API_UNAVAILABLE'})}));
 await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('Backend UltraPad non raggiungibile');
 await page.unroute('**/api/v1/bootstrap');
 await page.getByRole('button',{name:'Riprova',exact:true}).click();
 await expect(page.getByRole('heading',{name:'I tuoi lavori'})).toBeVisible();
});

test('origin rejection explains the configured frontend address',async({page})=>{
 await signedIn(page);
 await page.route('**/api/v1/bootstrap',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'ORIGIN',expectedOrigin:'http://localhost:5173'})}));
 await page.goto('/');
 await expect(page.getByRole('alert')).toContainText('Origine della pagina non consentita');
 await expect(page.getByRole('alert')).toContainText('http://localhost:5173');
});

test('v1.1 full home groups real accessible files by team activity and topic',async({page})=>{
 await signedIn(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'Ultime modifiche del team'})).toBeVisible();
 await page.getByRole('button',{name:'Attività del team',exact:true}).click();
 await expect(page.getByRole('heading',{name:'idee.md',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'Per tema',exact:true}).click();await expect(page.getByRole('heading',{name:'Ricerca',exact:true})).toBeVisible();
 await page.getByRole('searchbox',{name:'Cerca lavori'}).fill('inesistente');await expect(page.getByRole('heading',{name:'idee.md',exact:true})).toHaveCount(0);
 await page.getByRole('searchbox',{name:'Cerca lavori'}).fill('');await page.screenshot({path:'test-results/v11-home-dark.png',fullPage:true});
});
test('temporary files use format tools, survive reload and never send content to the API',async({page})=>{
 await signedIn(page);let mutations=0;page.on('request',r=>{if(r.url().includes('/v1/mutations'))mutations++;});await page.goto('/');
 await page.getByRole('button',{name:'✎ File temporaneo',exact:true}).click();await page.getByRole('button',{name:'Nome e formato',exact:true}).click();
 await page.getByLabel('Nome', {exact:true}).fill('bozza.md');await page.getByRole('button',{name:'Salva',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('temporaneo',{timeout:20000});
 await page.getByRole('button',{name:'Strumenti sorgente',exact:true}).click();await page.getByRole('button',{name:'Grassetto',exact:true}).click();await expect(page.locator('.view-lines')).toContainText('**testo**');
 await page.reload();await expect(page.locator('.view-lines')).toContainText('**testo**');expect(mutations).toBe(0);
 await page.getByRole('button',{name:'UltraPad',exact:true}).click();await expect(page.getByRole('heading',{name:'bozza.md',exact:true})).toBeVisible();
});
test('appearance switches both page and Monaco, custom accent persists across reload',async({page})=>{
 await signedIn(page);await page.goto('/projects/20000000-0000-4000-8000-000000000001/files/30000000-0000-4000-8000-000000000001');
 await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});await page.getByRole('button',{name:'Aspetto',exact:true}).click();
 await page.getByRole('button',{name:'☀ Bianco',exact:true}).click();await page.getByRole('button',{name:'Colore #a5d9ca',exact:true}).click();
 await page.getByRole('button',{name:'Chiudi',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('.monaco-editor').first()).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#a5d9ca');
 await page.getByRole('button',{name:'UltraPad',exact:true}).click();await page.screenshot({path:'test-results/v11-home-light.png',fullPage:true});
});
test('source toolbar edits go through collaborative persistence and undo',async({page})=>{
 await signedIn(page);await page.goto('/projects/20000000-0000-4000-8000-000000000001/files/30000000-0000-4000-8000-000000000001');
 await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.locator('.view-lines').click({position:{x:30,y:10}});await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('collaborazione');
 await page.keyboard.press('ControlOrMeta+A');await page.getByRole('button',{name:'Strumenti sorgente',exact:true}).click();await page.getByRole('button',{name:'Grassetto',exact:true}).click();
 await expect(page.locator('.view-lines')).toContainText('**collaborazione**');await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.getByRole('button',{name:'↶ Annulla',exact:true}).click();await expect(page.locator('.view-lines')).toContainText('collaborazione');await expect(page.locator('.view-lines')).not.toContainText('**collaborazione**');
});
test('viewer cannot use modifying toolbar actions',async({page})=>{
 await signedIn(page);await page.route('**/api/v1/bootstrap',async route=>{const response=await route.fetch();const data=await response.json();data.projects[0].role='viewer';await route.fulfill({json:data});});
 await page.route('**/api/v1/files/*/collaboration-ticket',async route=>{const response=await page.request.post('http://localhost:8788/ticket',{data:{token:'viewer',fileId:'30000000-0000-4000-8000-000000000001',generation:1}});await route.fulfill({json:await response.json()});});
 await page.goto('/projects/20000000-0000-4000-8000-000000000001/files/30000000-0000-4000-8000-000000000001');
 await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.getByRole('button',{name:'Strumenti sorgente',exact:true}).click();await expect(page.getByRole('button',{name:'Grassetto',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'↶ Annulla',exact:true})).toBeDisabled(); await page.getByRole('button',{name:'UltraPad',exact:true}).click();await page.unrouteAll({behavior:'wait'});
});

async function personalFileFixture(page:Page) {
 const file={id:crypto.randomUUID(),project_id:'20000000-0000-4000-8000-000000000001',workspace_id:'10000000-0000-4000-8000-000000000001',name:'personale.md',kind:'text',parent_id:null,generation:1,language:'markdown',metadata_version:1,status:'ready'};
 await page.route('**/api/v1/mutations',async route=>{const body=route.request().postDataJSON();if(body.op==='create_standalone'){file.name=body.args.name;await route.fulfill({json:file});}else await route.continue();});
 await page.route('**/api/v1/projects/*/files',route=>route.fulfill({json:[file]}));return file;
}
test('single file creation needs no project selection and opens durable editor',async({page})=>{
 await signedIn(page);await personalFileFixture(page);await page.goto('/');
 await page.getByRole('button',{name:'+ File singolo',exact:true}).click();await page.getByLabel('Nome',{exact:true}).fill('personale.md');
 await page.getByRole('button',{name:'Crea',exact:true}).click();await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.getByRole('button',{name:'Strumenti sorgente',exact:true}).click();await expect(page.getByRole('toolbar',{name:'Strumenti Markdown',exact:true})).toBeVisible();
});
test('promotion retains temporary text until durable ACK and preserves recovery copy',async({page})=>{
 await signedIn(page);await personalFileFixture(page);await page.goto('/');
 await page.getByRole('button',{name:'✎ File temporaneo',exact:true}).click();await page.getByRole('button',{name:'Nome e formato',exact:true}).click();await page.getByLabel('Nome',{exact:true}).fill('da-conservare.md');await page.getByRole('button',{name:'Salva',exact:true}).click();
 await page.getByRole('button',{name:'Strumenti sorgente',exact:true}).click();await page.getByRole('button',{name:'Grassetto',exact:true}).click();await expect(page.locator('.view-lines')).toContainText('**testo**');
 await page.getByRole('button',{name:'Salva nel DB',exact:true}).click();await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});await expect(page.locator('.view-lines')).toContainText('**testo**');
 await page.reload();await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});await expect(page.locator('.view-lines')).toContainText('**testo**');
 await page.getByRole('button',{name:'UltraPad',exact:true}).click();await expect(page.getByRole('heading',{name:'da-conservare.md',exact:true})).toBeVisible();
});
test('JSON tools validate errors and formatter uses real Monaco without corrupting source',async({page})=>{
 await signedIn(page);await page.goto('/');await page.getByRole('button',{name:'✎ File temporaneo',exact:true}).click();await page.getByRole('button',{name:'Nome e formato',exact:true}).click();await page.getByLabel('Nome',{exact:true}).fill('dati.json');await page.getByRole('button',{name:'Salva',exact:true}).click();
 await page.getByRole('button',{name:'Strumenti sorgente',exact:false}).click();await page.getByRole('button',{name:'Oggetto',exact:true}).click();await page.getByRole('button',{name:'Verifica JSON',exact:true}).click();await expect(page.locator('.editor-region .notice[role=alert]')).toContainText('JSON valido.');
 await page.getByRole('button',{name:'Formatta documento',exact:true}).click();await expect(page.locator('.view-lines')).toContainText('"chiave"');
 await page.locator('.view-lines').click({position:{x:30,y:10}});await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('{bad');await page.getByRole('button',{name:'Strumenti sorgente',exact:false}).click();await page.getByRole('button',{name:'Verifica JSON',exact:true}).click();await expect(page.locator('.editor-region .notice[role=alert]')).toBeVisible();await expect(page.locator('.editor-region .notice[role=alert]')).not.toContainText('JSON valido.');
});
test('missing temporary route has a recovery screen and mobile home does not overflow',async({page})=>{
 await signedIn(page);await page.goto('/scratch/missing');await expect(page.getByRole('heading',{name:'Temporaneo non disponibile',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Torna alla home',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'+ File singolo',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'test-results/v11-mobile.png',fullPage:true});
});

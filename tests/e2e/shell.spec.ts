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
 await expect(page.getByRole('status')).toHaveText('salvato sul server');
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
 await expect(page.getByRole('alert')).toContainText('Accesso GitHub non completato');
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
 await expect(page.getByRole('heading',{name:'Test workspace'})).toBeVisible();
});

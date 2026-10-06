import { test,expect,type Page } from '@playwright/test';
async function signedIn(page: Page) {
 await page.addInitScript(()=>{
   const uid='00000000-0000-4000-8000-000000000001';const expires=Math.floor(Date.now()/1000)+3600;
   const jwt=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:expires,iat:expires-3600,aud:'authenticated',role:'authenticated'}))+'.test-signature';
   localStorage.setItem('sb-localhost-auth-token',JSON.stringify({access_token:jwt,refresh_token:'test-only-refresh',expires_at:expires,expires_in:3600,token_type:'bearer',user:{id:uid,aud:'authenticated',role:'authenticated',email:'test@example.invalid',app_metadata:{},user_metadata:{user_name:'Test user'},created_at:new Date().toISOString()}}));
 });
}

const project='20000000-0000-4000-8000-000000000001';
test('v1.3 closing a tab keeps durable text and last close returns to project',async({page})=>{
 await signedIn(page);const id=crypto.randomUUID();await page.route('**/api/v1/projects/*/files',route=>route.fulfill({json:[{id,project_id:project,workspace_id:'10000000-0000-4000-8000-000000000001',name:'idee.md',kind:'text',parent_id:null,generation:1,language:'markdown',metadata_version:1,status:'ready'}]}));await page.goto(`/projects/${project}/files/${id}`);await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.locator('.view-lines').click({position:{x:30,y:10}});await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Test chiusura v1.3');
 await page.getByRole('button',{name:'Chiudi idee.md',exact:true}).click();await expect(page).toHaveURL(`/projects/${project}`);await expect(page.locator('.editor-region')).toHaveCount(0);
 await page.locator('.tree-name').filter({hasText:'idee.md'}).click();await expect(page.locator('.view-lines')).toContainText('Test chiusura v1.3');
});
test('v1.3 dedicated temporary workspace closes without deleting the draft',async({page})=>{
 await signedIn(page);await page.goto('/');await page.getByRole('button',{name:'Workspace temporanei'}).click();await expect(page.getByRole('heading',{name:'Workspace temporanei'})).toBeVisible();
 await page.getByRole('button',{name:'+ File temporaneo',exact:true}).click();await page.getByRole('button',{name:'Nome e formato',exact:true}).click();await page.getByLabel('Nome',{exact:true}).fill('memo.txt');await page.getByRole('button',{name:'Salva',exact:true}).click();await page.getByRole('textbox',{name:'Contenuto memo.txt'}).fill('Da conservare');
 await page.getByRole('button',{name:'Chiudi memo.txt'}).click();await expect(page).toHaveURL('/temporary');await page.getByRole('button',{name:'memo.txt',exact:true}).click();await expect(page.getByRole('textbox',{name:'Contenuto memo.txt'})).toHaveText('Da conservare');
});
test('v1.3 rail expands workspace names and home preview never opens an editor',async({page})=>{
 await signedIn(page);await page.goto('/');await page.getByRole('button',{name:'Espandi sidebar workspace'}).click();await expect(page.getByRole('button',{name:'Test workspace',exact:true}).locator('.rail-label')).toHaveText('Test workspace');
 await page.getByRole('button',{name:'Anteprima di idee.md'}).first().click();await expect(page.getByRole('dialog')).toHaveText(/Anteprima · idee.md/);await expect(page.locator('.preview')).toBeVisible();await expect(page.locator('.editor-region')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('v1.3 account infers name, uploads raster avatar and sends profile to Auth',async({page})=>{
 await signedIn(page);let saved:Record<string,unknown>={};await page.route('**/auth/v1/user',async route=>{if(route.request().method()==='PUT'){const body=route.request().postDataJSON();saved=body.data;await route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid',user_metadata:body.data}});}else await route.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Account',exact:true}).click();await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Test');await page.getByLabel('Nome',{exact:true}).fill('Simone');await page.getByLabel('Cognome',{exact:true}).fill('Rega');
 await page.getByLabel('Immagine di profilo').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.getContext('2d')!.fillRect(0,0,16,16);return canvas.toDataURL('image/png').split(',')[1];}),'base64')});
 await expect(page.getByRole('dialog').locator('.avatar img')).toBeVisible();await page.getByRole('button',{name:'Salva profilo'}).click();await expect(page.getByText('Profilo salvato.',{exact:true})).toBeVisible();expect(saved).toMatchObject({first_name:'Simone',last_name:'Rega'});expect(saved.profile_avatar).toMatch(/^data:image\/jpeg;base64,/);expect(String(saved.profile_avatar).length).toBeLessThanOrEqual(1800);
});
test('v1.3 real room presence appears in home and editor and leaves on close',async({page,browser})=>{
 const context=await browser.newContext();const other=await context.newPage();try{
 await signedIn(page);await signedIn(other);const id=crypto.randomUUID();const record={id,project_id:project,workspace_id:'10000000-0000-4000-8000-000000000001',name:'idee.md',kind:'text',parent_id:null,generation:1,language:'markdown',metadata_version:1,status:'ready'};for(const client of [page,other]){await client.route('**/api/v1/projects/*/files',route=>route.fulfill({json:[record]}));await client.route('**/api/v1/dashboard',route=>route.fulfill({json:[record]}));}await page.goto(`/projects/${project}/files/${id}`);await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});await expect(page.locator('.editor-presence .avatar')).toHaveAttribute('aria-label','Editor Test · file aperto',{timeout:15000});
 await other.goto('/');await other.locator('.work-card .file-presence').first().scrollIntoViewIfNeeded();await expect(other.locator('.work-card .avatar').first()).toHaveAttribute('aria-label','Editor Test · file aperto',{timeout:15000});await page.getByRole('button',{name:'Chiudi idee.md'}).click();await expect(other.locator('.work-card .avatar')).toHaveCount(0,{timeout:20000});
 }finally{await context.close();}
});

test('v1.3 closing preserves pending offline edits for replay on reopening',async({page,context})=>{
 await signedIn(page);const id=crypto.randomUUID();const record={id,project_id:project,workspace_id:'10000000-0000-4000-8000-000000000001',name:'offline.txt',kind:'text',parent_id:null,generation:1,language:'plaintext',metadata_version:1,status:'ready'};
 await page.route('**/api/v1/projects/*/files',route=>route.fulfill({json:[record]}));await page.goto(`/projects/${project}/files/${id}`);await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await context.setOffline(true);await page.getByRole('textbox',{name:'Contenuto offline.txt'}).fill('Modifica offline conservata');await page.getByRole('button',{name:'Chiudi offline.txt'}).click();await expect(page).toHaveURL(`/projects/${project}`);await context.setOffline(false);
 await page.locator('.tree-name').filter({hasText:'offline.txt'}).click();await expect(page.getByRole('textbox',{name:'Contenuto offline.txt'})).toHaveText('Modifica offline conservata');await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});await page.reload();await expect(page.getByRole('textbox',{name:'Contenuto offline.txt'})).toHaveText('Modifica offline conservata');
});
test('v1.3 a failed local write blocks closing until the work is exported',async({page})=>{
 await signedIn(page);const id=crypto.randomUUID();await page.route('**/api/v1/projects/*/files',route=>route.fulfill({json:[{id,project_id:project,workspace_id:'10000000-0000-4000-8000-000000000001',name:'salvataggio.txt',kind:'text',parent_id:null,generation:1,language:'plaintext',metadata_version:1,status:'ready'}]}));await page.goto(`/projects/${project}/files/${id}`);await expect(page.getByRole('status')).toHaveText('salvato sul server',{timeout:20000});
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){if(this.name==='documents')throw new Error('test storage failure');return original.apply(this,args);};});
 await page.getByRole('textbox',{name:'Contenuto salvataggio.txt'}).fill('Lavoro da proteggere');await expect(page.getByRole('status')).toContainText('errore salvataggio');await page.getByRole('button',{name:'Chiudi salvataggio.txt'}).click();await expect(page.getByRole('alert').first()).toContainText('Impossibile chiudere in sicurezza');await expect(page.getByRole('textbox',{name:'Contenuto salvataggio.txt'})).toHaveText('Lavoro da proteggere');
});

test('v1.3 closing inactive and active tabs keeps the remaining editor selected',async({page})=>{
 await signedIn(page);const ids=[crypto.randomUUID(),crypto.randomUUID()];const records=ids.map((id,index)=>({id,project_id:project,workspace_id:'10000000-0000-4000-8000-000000000001',name:`tab-${index}.txt`,kind:'text',parent_id:null,generation:1,language:'plaintext',metadata_version:1,status:'ready'}));
 await page.route('**/api/v1/projects/*/files',route=>route.fulfill({json:records}));await page.goto(`/projects/${project}/files/${ids[0]}`);await expect(page.getByRole('textbox',{name:'Contenuto tab-0.txt'})).toBeVisible();await page.locator('.tree-name').filter({hasText:'tab-1.txt'}).click();await expect(page.getByRole('textbox',{name:'Contenuto tab-1.txt'})).toBeVisible();
 await page.getByRole('button',{name:'Chiudi tab-0.txt'}).click();await expect(page).toHaveURL(`/projects/${project}/files/${ids[1]}`);await expect(page.getByRole('button',{name:'Chiudi tab-0.txt'})).toHaveCount(0);
 await page.locator('.tree-name').filter({hasText:'tab-0.txt'}).click();await expect(page.getByRole('textbox',{name:'Contenuto tab-0.txt'})).toBeVisible();await page.getByRole('button',{name:'Chiudi tab-0.txt'}).click();await expect(page).toHaveURL(`/projects/${project}/files/${ids[1]}`);await expect(page.getByRole('textbox',{name:'Contenuto tab-1.txt'})).toBeVisible();
});

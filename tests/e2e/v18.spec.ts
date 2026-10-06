import {test,expect,type Page} from '@playwright/test';
async function guest(page:Page){await page.goto('/');await page.getByRole('button',{name:'Continua senza account',exact:true}).click();}
async function create(page:Page){await page.getByRole('button',{name:'+ Nuovo file',exact:true}).click();await page.getByRole('button',{name:'Crea',exact:true}).click();}
test('v1.8 formatting popover preserves selection, closes outside/Escape and leaves writing space',async({page})=>{
 await guest(page);await create(page);const content=page.getByRole('textbox',{name:'Contenuto senza-titolo.txt'});await content.fill('Testo compatto');await content.click();await page.keyboard.press('ControlOrMeta+A');
 const formatting=page.getByRole('button',{name:'Formattazione',exact:false});await formatting.click();await page.getByRole('button',{name:'Paragrafo',exact:true}).click();await page.getByRole('button',{name:'Al centro',exact:true}).click();await expect(content.locator('p')).toHaveCSS('text-align','center');const paper=page.locator('.document-scroll');const area=await paper.boundingBox();await paper.click({position:{x:area!.width-20,y:20}});await expect(formatting).toHaveAttribute('aria-expanded','false');
 await formatting.click();await page.keyboard.press('Escape');await expect(formatting).toBeFocused();await expect(page.getByRole('region',{name:'Formattazione'})).toHaveCount(0);
 const tabs=page.getByRole('navigation',{name:'File aperti'});await expect(tabs.locator('.file-tab.active .file-type-icon')).toHaveAttribute('data-file-type','text');await expect(tabs.getByRole('button',{name:'Apri senza-titolo.txt',exact:true})).toHaveAttribute('aria-current','page');
 const command=await page.locator('.editor-commandbar').boundingBox();const format=await page.locator('.rich-format-bar').boundingBox();expect(command!.height+format!.height).toBeLessThan(100);await page.screenshot({path:'test-results/v18-desktop.png'});
 await page.setViewportSize({width:360,height:780});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const exporting=await page.getByRole('button',{name:'Esporta…'}).boundingBox();expect(exporting!.x+exporting!.width).toBeLessThanOrEqual(360);await formatting.click();await expect(page.getByRole('button',{name:'Stili',exact:true})).toBeVisible();await page.keyboard.press('Escape');await page.screenshot({path:'test-results/v18-mobile.png'});
 await page.getByRole('button',{name:'Chiudi senza-titolo.txt',exact:true}).click();await expect(page.getByRole('heading',{name:'Il tuo spazio ospite'})).toBeVisible();
});
test('v1.8 format icons follow names and source actions remain reachable',async({page})=>{
 await guest(page);
 for(const [name,type] of [['readme.md','markdown'],['index.html','code'],['Test.java','java'],['dati.json','data'],['style.css','css'],['esempio.cs','cs']]){
  await page.getByLabel('Importa file ospite').setInputFiles({name,mimeType:'text/plain',buffer:Buffer.from(name==='dati.json'?'{}':'esempio')});
  await expect(page.locator('.tabs .file-type-icon')).toHaveAttribute('data-file-type',type);
 }
 await page.getByRole('button',{name:'dati.json',exact:true}).first().click();await page.getByRole('button',{name:'Strumenti sorgente',exact:false}).click();await page.getByRole('button',{name:'Verifica JSON',exact:true}).click();await expect(page.locator('.editor-region .notice')).toContainText('JSON valido');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Strumenti sorgente',exact:false})).toHaveAttribute('aria-expanded','false');
});

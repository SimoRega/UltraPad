import { test, expect } from '@playwright/test';
import type { CollaborationClient } from '../../packages/collaboration-client/src/index';
declare global { interface Window { testClient: CollaborationClient } }
test('three real browser contexts converge, keep offline work, survive reload and reject viewer edits',async({browser})=>{
 const fileId=crypto.randomUUID();const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 try {
  await Promise.all(pages.map((p,i)=>p.goto(`http://localhost:5174/?fileId=${fileId}&token=${i===2?'viewer':'editor'+i}`)));
  await Promise.all(pages.map(p=>expect(p.locator('#status')).toHaveText('salvato sul server')));
  await Promise.all(pages.slice(0,2).map((p,i)=>p.evaluate(i=>window.testClient.doc.getText('content').insert(0,`client${i}😀 `),i)));
  await Promise.all(pages.map(p=>expect(p.locator('#content')).toHaveValue(/client0😀.*client1😀|client1😀.*client0😀/)));
  const expected=await pages[0].locator('#content').inputValue();expect(await pages[1].locator('#content').inputValue()).toBe(expected);expect(await pages[2].locator('#content').inputValue()).toBe(expected);
  await contexts[1].setOffline(true);
  await expect(pages[1].locator('#status')).toHaveText('offline');
  await pages[1].evaluate(async()=>{window.testClient.doc.getText('content').insert(0,'offline ');await window.testClient.settled();});
  await expect(pages[1].locator('#status')).toHaveText('offline');
  expect(await pages[1].evaluate(()=>window.testClient.pending)).toBeGreaterThan(0);
  expect(await pages[0].locator('#content').inputValue()).not.toContain('offline ');
  await pages[0].evaluate(()=>window.testClient.doc.getText('content').insert(0,'online '));
  await contexts[1].setOffline(false);
  await Promise.all(pages.map(p=>expect(p.locator('#content')).toHaveValue(/offline/)));
  await Promise.all(pages.map(p=>expect(p.locator('#content')).toHaveValue(/online/)));
  await expect(pages[1].locator('#status')).toHaveText('salvato sul server');
  const converged=await pages[0].locator('#content').inputValue();expect(await pages[1].locator('#content').inputValue()).toBe(converged);
  await pages[1].reload();await expect(pages[1].locator('#content')).toHaveValue(converged);
  await expect(pages[2].locator('#content')).toBeDisabled();
 } finally {await Promise.all(contexts.map(c=>c.close()));}
});

import {expect,it} from 'vitest';
import {profileFor,safeAvatar} from './index';
it('infers editable names from email and preserves explicitly empty surnames',()=>{expect(profileFor('id','simone.rega@example.invalid')).toMatchObject({firstName:'Simone',lastName:'Rega'});expect(profileFor('id','simone.rega@example.invalid',{first_name:'Simo',last_name:''})).toMatchObject({firstName:'Simo',lastName:''});});
it('allows bounded raster avatars and rejects executable or oversized inputs',()=>{expect(safeAvatar('data:image/jpeg;base64,YWJj')).toBeTruthy();for(const value of ['javascript:alert(1)','data:image/svg+xml;base64,YWJj','http://example.invalid/a','https://user:pass@example.invalid/a','a'.repeat(1801)])expect(safeAvatar(value)).toBe('');});
it('bounds untrusted account fields',()=>{expect(profileFor('id',undefined,{first_name:'a'.repeat(500)}).firstName).toHaveLength(80);});

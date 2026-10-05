import { expect, it } from 'vitest';
import { apiEndpoint, developmentTarget, websocketEndpoint } from './api-endpoint';
it('keeps local HTTP and WebSocket calls on the frontend origin with IPv4 upstream',()=>{
 for(const host of ['localhost','127.0.0.1','[::1]']) {
  const base=`http://${host}:8787`;
  expect(apiEndpoint(base,'http://localhost:5173',true)).toBe('http://localhost:5173/api');
  expect(developmentTarget(base)).toBe('http://127.0.0.1:8787');
 }
 expect(websocketEndpoint('http://localhost:5173/api','file',2).href).toBe('ws://localhost:5173/api/ws/file/2');
});
it('preserves the configured production API and any deployment path prefix',()=>{
 expect(apiEndpoint('https://api.example.invalid/backend/','https://web.example.invalid',false)).toBe('https://api.example.invalid/backend');
 expect(developmentTarget('https://api.example.invalid')).toBeNull();
 expect(websocketEndpoint('https://api.example.invalid/backend','file',3).href).toBe('wss://api.example.invalid/backend/ws/file/3');
});
it('does not embed credentials or allow non-HTTP API schemes',()=>{
 expect(()=>apiEndpoint('https://user:password@example.invalid','http://localhost:5173',true)).toThrow();
 expect(()=>apiEndpoint('file:///tmp/api','http://localhost:5173',true)).toThrow();
});

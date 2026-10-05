import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({root:resolve(import.meta.dirname,'harness'),server:{host:'127.0.0.1',port:5174,fs:{allow:[resolve(import.meta.dirname,'../..')]}}});

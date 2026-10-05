declare module 'latex.js' {
 export class HtmlGenerator {constructor(options:{hyphenate:boolean});domFragment():DocumentFragment;}
 export function parse(text:string,options:{generator:HtmlGenerator}):HtmlGenerator;
}

import os, json, shutil, subprocess, base64
manifest=json.load(open('/input/manifest.json'))
for name in os.listdir('/input'):
 if name.endswith(('.tex','.bib')): shutil.copyfile('/input/'+name,'/tmp/'+name)
main=manifest['main'];base=main[:-4];logs=[]
env=dict(os.environ,openin_any='p',openout_any='p',TEXMFOUTPUT='/tmp',SOURCE_DATE_EPOCH='0')
def run(args):
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,timeout=45)
 logs.append(p.stdout.decode('utf-8','replace')[-20000:]);return p.returncode
try:
 code=run(['pdflatex','-no-shell-escape','-interaction=nonstopmode','-halt-on-error','-file-line-error',main])
 if not code:
  if os.path.exists(base+'.aux') and '\\bibdata' in open(base+'.aux').read(): code=run(['bibtex',base])
  if not code: code=run(['pdflatex','-no-shell-escape','-interaction=nonstopmode','-halt-on-error','-file-line-error',main])
  if not code: code=run(['pdflatex','-no-shell-escape','-interaction=nonstopmode','-halt-on-error','-file-line-error',main])
 pdf=None
 if not code and os.path.exists(base+'.pdf'):
  data=open(base+'.pdf','rb').read()
  if len(data)>4194304: raise ValueError('PDF_LIMIT')
  pdf=base64.b64encode(data).decode()
 print(json.dumps(dict(exitCode=code,stdout='\n'.join(logs)[-60000:],stderr='',pdf=pdf)))
except Exception as e: print(json.dumps(dict(exitCode=1,error=str(e),stdout='\n'.join(logs)[-60000:])))

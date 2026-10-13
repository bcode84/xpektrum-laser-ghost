# Usage: python3 -I tools/outline.py <pages.json> <outdir>  -> text outline per page
import sys,re,html,json,os
pages=json.load(open(sys.argv[1])); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
def outline(s):
  s=re.sub(r'<(script|style|svg)[\s\S]*?</\1>','',s)
  s=re.sub(r'<form\b([^>]*)>',lambda m:'\n[FORM '+m.group(1)+']',s)
  s=re.sub(r'<(input|textarea|select)\b([^>]*)>',lambda m:'\n[FIELD '+m.group(1)+' '+' '.join(re.findall(r'(?:name|type|placeholder|required)(?:="[^"]*")?',m.group(2)))+']',s)
  s=re.sub(r'<iframe\b[^>]*src="([^"]+)"[^>]*>',r'\n[IFRAME \1]',s)
  s=re.sub(r'<img[^>]*?src="([^"]+)"[^>]*?alt="([^"]*)"[^>]*>',r'\n[IMG \1 alt="\2"]',s)
  s=re.sub(r'<a\b[^>]*href="([^"]+)"[^>]*>',r'\n[A \1] ',s)
  s=re.sub(r'<(section|h1|h2|h3|h4|p|li|button|label)\b[^>]*>',lambda m:'\n<'+m.group(1)+'> ',s)
  s=re.sub(r'<[^>]+>','',s); s=html.unescape(s)
  lines=[' '.join(l.split()) for l in s.split('\n')]
  res=[];seen=set()
  for l in lines:
    if not l or l in('<p>','<button>','<li>','<section>'): continue
    if len(l)>300 and l[:80] in seen: continue
    seen.add(l[:80]); res.append(l)
  return '\n'.join(res)
for p in pages:
  open(f"{out}/{p['slug']}.txt",'w').write(f"# {p['title']['rendered']}\n{p['link']}\n\n"+outline(p['content']['rendered']))
  print(p['slug'])

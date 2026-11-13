from pathlib import Path
import shutil,hashlib,json,datetime
root=Path(r'C:\Users\user\Forge\release-staging\portfolio-searchsignal-safe-redirect-20261112')
public=root/'public'
bundle=public/'assets'/'searchsignal-CvgLuBaC.js'
original=Path(r'C:\Users\user\Forge\forgehost\deployments\fh_20261108061045_3db41484_20e751\site\assets\searchsignal-CvgLuBaC.js')
assert bundle.read_bytes()==original.read_bytes()
backup=root/'searchsignal-live-bundle-before-redirect-bridge.js'
if not backup.exists():
 shutil.copy2(bundle,backup)
text=bundle.read_text(encoding='utf8')
def patch(old,new,label):
 global text
 n=text.count(old)
 assert n==1,(label,n)
 text=text.replace(old,new)
patch('''[he,be]=d.useState(`/old-program,/program
/legacy,/new-home`),[Le,Ge]=''',
      '[he,be]=d.useState("/,https://github.com/"),[redirectAuditBase,setRedirectAuditBase]=d.useState("https://www.github.com"),[Le,Ge]=',
      'demo and controlled base-url state')
patch('Ge(await Tm({baseUrl:j||h,mappings:_}))',
      'Ge(await Tm({baseUrl:redirectAuditBase||j||h,mappings:_}))',
      'API base URL wired to controlled field')
patch('o.jsxs("p",{className:p.muted,children:["Enter comma-separated old,new paths. Base URL: ",o.jsx("code",{children:j}),". SearchSignal can validate the observed chain and destination canonical, but it never applies server configuration."]})',
      'o.jsx("p",{className:p.muted,children:"Observe real redirect chains for approved public HTTPS hosts. The live demo starts with a safe GitHub redirect; no server rules are applied."})',
      'workbench intro')
patch('o.jsx("textarea",{"aria-label":"Redirect mappings: old path, new path",className:p.textarea,value:he,onChange:_=>be(_.target.value)})',
      'o.jsxs("label",{className:p.muted,style:{display:"grid",gap:"8px",marginBlock:"12px"},children:[o.jsx("span",{children:"Public HTTPS base URL (approved hosts only)"}),o.jsx(on,{id:"searchsignal-redirect-base-url",type:"url",value:redirectAuditBase,onChange:_=>setRedirectAuditBase(_.target.value),placeholder:"https://www.github.com","aria-label":"Redirect check public HTTPS base URL"})]}),o.jsx("p",{className:p.muted,children:"Sample: www.github.com to github.com. Approved hosts include example.com, github.com, developers.cloudflare.com and developer.mozilla.org. Wider URL, site and document crawls remain unavailable."}),o.jsx("textarea",{"aria-label":"Redirect mappings: old path, new path",className:p.textarea,value:he,onChange:_=>be(_.target.value)})',
      'controlled accessible field before mappings')
strings={
 'Independent portfolio demo · Remote audit APIs migrating':'Independent portfolio demo · Redirect checks live (approved hosts)',
 'Explore the local review and planning tools. Remote URL fetching is temporarily unavailable on ForgeEdge.':'Explore local tools. In Pro mode, approved-host redirect checks work; other remote audits remain pending.',
 'All local tools, drafts, imports, and learning labs; remote audit APIs are marked pending.':'Local tools and imports work. Approved-host redirect checks are live; broader remote audit APIs remain pending.',
 'Live URL/site/document/redirect fetching returns when the ForgeEdge API migration is complete.':'URL, site and document crawls are pending. Pro Redirect Workbench now checks approved HTTPS domains live.',
 'The current public build keeps remote-fetch workflows disabled until the ForgeEdge API migration is complete.':'Most remote crawls remain disabled during migration; Pro Redirect Workbench checks approved public HTTPS hosts live.',
 'Remote URL/site/document/redirect APIs — migration pending':'URL/site/document APIs pending; approved-host redirect checks live'
}
for old,new in strings.items():patch(old,new,'outdated banner: '+old[:26])
# Do not update the hardlinked source snapshot. Store a distinct built candidate.
bundle.unlink()
bundle.write_text(text,encoding='utf8')
assert original.read_bytes()==backup.read_bytes()
meta=json.loads((root/'candidate.json').read_text(encoding='utf8'))
meta.update(status='CANARY_UI_PATCH_STAGED',changed_assets=['assets/searchsignal-CvgLuBaC.js'],source_bundle_sha256=hashlib.sha256(original.read_bytes()).hexdigest(),candidate_bundle_sha256=hashlib.sha256(bundle.read_bytes()).hexdigest(),original_bundle_preserved=True,updated_utc=datetime.datetime.now(datetime.timezone.utc).isoformat())
(root/'candidate.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf8')
print(json.dumps({'status':meta['status'],'old_hash':meta['source_bundle_sha256'],'new_hash':meta['candidate_bundle_sha256'],'bytes':len(text),'source_preserved':True},indent=2))

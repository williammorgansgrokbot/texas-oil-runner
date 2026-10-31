import sys
from playwright.sync_api import sync_playwright
url=sys.argv[1] if len(sys.argv)>1 else 'file:///workspace/texas-oil-runner-standalone.html'
O='/workspace/texas-oil-runner/shots/'
errs=[];logs=[]
CLR="__game.obstacles.slice().forEach(o=>{o.z=60}); __game.items.forEach(i=>{i.z=60});"
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
  ctx=b.new_context(viewport={'width':1280,'height':720}); pg=ctx.new_page(); pg.set_default_timeout(30000)
  if url.startswith('file:'): ctx.set_offline(True)
  pg.on('console',lambda m:(logs.append(m.type+': '+m.text), m.type=='error' and errs.append(m.text)))
  pg.on('pageerror',lambda e:errs.append('PAGEERROR '+str(e)))
  pg.goto(url); pg.wait_for_function("window.__game && document.getElementById('loading').classList.contains('hidden')",timeout=90000)
  pg.wait_for_timeout(2500); pg.screenshot(path=O+'title.png')
  pg.evaluate("document.getElementById('playBtn').click(); __game.setTime(0.12); __game.S.god=true")
  pg.wait_for_timeout(2500)
  pg.evaluate(CLR+"__game.spawnOb('barrel',0,-22); __game.spawnOb('pumpjack',2,-30); __game.spawnOb('dryer',0,-46); __game.spawnOb('hoses',1,-40); __game.spawnItem('star',0,1,-12); __game.spawnItem('hardhat',2,1.1,-15); for(let k=0;k<6;k++)__game.spawnItem('drop',1,0.9,-14+k*2.2)")
  pg.wait_for_timeout(300); pg.screenshot(path=O+'run.png')
  pg.evaluate(CLR+"__game.spawnOb('barrel',1,-5); __game.spawnOb('barricade',0,-9); __game.spawnOb('derrick',2,-20); __game.act('up')"); pg.wait_for_timeout(220); pg.screenshot(path=O+'jump.png')
  pg.wait_for_timeout(900)
  pg.evaluate(CLR+"__game.spawnOb('piperack',1,-7); __game.act('down')"); pg.wait_for_timeout(150); pg.screenshot(path=O+'slide.png')
  pg.wait_for_timeout(900)
  pg.evaluate(CLR+"__game.S.sliding=0; __game.collect({kind:'hardhat',x:0,y:1,z:0}); for(let i=0;i<5;i++)__game.collect({kind:'star',x:0,y:1,z:-2}); __game.gusherRow(-30); __game.spawnOb('rollbarrel',2,-40)")
  pg.wait_for_timeout(700); pg.screenshot(path=O+'powerup.png')
  pg.evaluate("__game.setTime(0.68);"+CLR+"__game.startTex(-40); __game.TEX.x=-2; __game.spawnOb('pumpjack',0,-25)"); pg.wait_for_timeout(400); pg.screenshot(path=O+'night.png')
  pg.evaluate("__game.setTime(0.12)"); pg.wait_for_timeout(1500); fr=[]
  for k in range(16): fr.append(pg.evaluate("[__game.player.children[0].children[0].material.map.image.width, __game.S.y.toFixed(2)]")); pg.wait_for_timeout(120)
  print('frame widths',fr)
  print('state',pg.evaluate("[__game.S.state,__game.S.dist|0,__game.S.coins,__game.S.stars,__game.S.mult]"))
  pg.evaluate(CLR+"Object.assign(__game.S,{god:false,invuln:0,sliding:0,fever:0}); __game.S.power={hardhat:0,shield:0,magnet:0,boots:0}; __game.spawnOb('barrel',__game.S.lane,-5)")
  pg.wait_for_function("__game.S.dead", timeout=8000); pg.wait_for_timeout(250); pg.screenshot(path=O+'crash.png')
  pg.wait_for_timeout(2500); pg.screenshot(path=O+'gameover.png')
  best=pg.evaluate("localStorage.getItem('tor_best')"); pg.reload(); pg.wait_for_function("window.__game && document.getElementById('loading').classList.contains('hidden')",timeout=90000)
  print('best persisted', best, pg.evaluate("document.getElementById('bestMenu').textContent"))
  ctx.close()
  # phone
  ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,device_scale_factor=2); pg=ctx.new_page()
  if url.startswith('file:'): ctx.set_offline(True)
  pg.on('pageerror',lambda e:errs.append('PAGEERROR phone '+str(e)))
  pg.goto(url); pg.wait_for_function("window.__game && document.getElementById('loading').classList.contains('hidden')",timeout=90000)
  pg.wait_for_timeout(2000); pg.screenshot(path=O+'phone_title.png')
  pg.evaluate("document.getElementById('playBtn').click(); __game.S.god=true"); pg.wait_for_timeout(1500)
  # swipe left via touch events
  pg.evaluate("""(()=>{const mk=(t,x,y)=>{const tt=new Touch({identifier:1,target:document.body,clientX:x,clientY:y});document.body.dispatchEvent(new TouchEvent(t,{touches:t==='touchend'?[]:[tt],changedTouches:[tt],bubbles:true}));};mk('touchstart',200,400);mk('touchmove',120,405);mk('touchend',120,405);})()""")
  pg.wait_for_timeout(200); print('lane after swipe left', pg.evaluate("__game.S.lane"))
  pg.evaluate(CLR+"__game.spawnOb('barrel',1,-20); __game.spawnOb('pumpjack',2,-28); for(let k=0;k<6;k++)__game.spawnItem('drop',0,0.9,-12+k*2.2)"); pg.wait_for_timeout(300); pg.screenshot(path=O+'phone_play.png')
  b.close()
print('\n'.join(l for l in logs if 'jumpcheck' in l or 'quality' in l))
print('ERRORS:',errs)

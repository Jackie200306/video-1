// ================================================================ frame
function drawChartFrame(i, t) {
  const c = camAt(i); CAM = c.tr; DS = CAM.ds;
  const daily = DS === DSD;
  const hp = projDay(c, c.D);
  drawBackground(c, t, hp);
  drawFloor(c, t);
  drawBokeh(c, t);
  drawRails(c, t);
  drawMonths(c, t);
  const pts = collectPoints(c);
  drawFill(c, pts);
  drawLine(c, t, pts);
  drawTwinkles(c, t);
  drawPulses(c, t);
  if (hp) drawHead(c, t, hp);
  drawBubble(c, t, hp);
  drawParticles(c, t, i);
  drawGlass(t);
  zoomBlur(c, hp);
  let br = null;
  if (daily) {
    br = drawBracket(c, t);
    drawEffects(c, t);
    if (TL.full) { drawTimelineFx(c, t); drawCards(c, t); drawTimelineSlams(c, t); }
    drawPeakCard(c, t, hp);
  } else { drawHistFx(c, t); drawHistMarks(c, t); }
  drawHeadChip(c, t, hp);
  if (daily) drawMilestones(c, t, hp);
  drawHUD(c, t);
  if (daily) {
    drawHeadline(t);
    drawSlam(c, t, br);
    drawTitle(t);
    if (TL.full) drawChapters(t);
    drawQuestion(t);
    drawRewind(t);
    draw2023(t);
    if (TL.full) { drawConvert(t); drawQuestion2(t); drawRewind2(t); }
  } else { drawHistHeadline(t); drawRecCards(t); drawTable(t); }
}
function renderFrame(i) {
  const t = i / FPS;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (TL.full && t >= LV.t0) draw2D(t); else drawChartFrame(i, t);
  // warm vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, 520, W / 2, H * 0.45, 1250);
  vg.addColorStop(0, 'rgba(150,118,64,0)'); vg.addColorStop(1, 'rgba(150,118,64,0.16)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  drawFrameRule();
  if (!(TL.full && t >= OUT.cta)) text('历史不代表未来 · 不构成投资建议', W - 70, H - 52, F.cnB(20), rgba(FAINT, 1), 'right', 2);
  // cuts between sections: a short ivory flash on the bar line
  if (TL.full) {
    let f = 0;
    for (const tc of [NS.cut, LV.t0, INF.t0, OUT.t0]) f = Math.max(f, bump(t, tc, 0.12, 0.04, 0.4));
    if (f > 0.003) { ctx.fillStyle = `rgba(252,250,245,${0.92 * f})`; ctx.fillRect(0, 0, W, H); }
    if (t > OUT.fade) { ctx.fillStyle = `rgba(252,250,245,${smooth(OUT.fade, TL.T - 0.2, t)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (t < 0.15) { ctx.fillStyle = `rgba(252,250,245,${1 - t / 0.15})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = renderFrame;

(async () => {
  TL = await (await fetch('/build/timeline.json')).json();
  FPS = TL.fps; S = TL.series; N = S.date.length; HK = TL.hook; PEAK = TL.peak; NOW = TL.now; NF = TL.nF;
  DATE0 = Date.parse(S.date[0]);
  S.cny[PEAK.i] = PEAK.cny; S.usd[PEAK.i] = PEAK.usd;
  BAR = 4 * HK.beat; SONG_BAR0 = TL.bgm.song_drop - 8 * BAR;
  if (TL.full) { TLN = TL.timeline; NS = TL.nowsec; HS = TL.history; LV = TL.lev; INF = TL.infl; OUT = TL.outro; }
  const sample = '黄金暴跌现在还能买吗？，抄底还是接飞刀让我们把时间倒回这一轮大涨要从这年说起国际金价折合人民币克历史最高较点回落不到个月跌到年月日盎司泡沫史上最贵一路狂飙新高不代表未来构成投资建议·0123456789$¥%,.−'
    + '美联储继续加息利率升至承压硅谷银行倒闭业危机资金涌入避险最后一次年来巴以冲突爆发情绪温约突破高点各国央行持续买金主升浪开启中东局势级伊朗色列互相袭击冲上首降基周期特朗普胜选元走强调关税阴云下解放日全球市场恐慌三后重启涨势越陡单12随又了回担忧独立性疯狂提名沃什任主席押注更鹰派油价破百不反就职通胀走希望落空短暂弹数据降温8月首次全球股大投资者卖补保证通超预期升最低多消息突发里程碑风暴抢顶点泡沫破裂现在'
    + '可以入场先别急看历史每次之后多久才回本再时间倒回REWIND第次见放开私人地缘冲到把泡破裂机构欧债退出QE两天暴跌疫情放水暴力这一次要深用重回问号历次大幅前快慢的等几十为什么会关键词杠杆用倍借来钱本金亏损全部光券商强制掉你只群跟着推手死亡螺旋账户追加换越踩踏如果按今天购买力相当于比还贵扣除直到才所以能吗暴跌之后快的慢别加它是放大器真想闲分批拿得住会车评论区聊聊视频';
  await Promise.all(['SerifBlack', 'SerifBold', 'Cormorant'].map(f => document.fonts.load(`40px ${f}`, sample)));
  await document.fonts.load('italic 40px DMSerif', '0123456789%.−'); await document.fonts.load('40px DMSerif', '0123456789$¥,.×≈÷');
  await document.fonts.load('600 40px Cormorant', 'GOLDXAUREWINDCHAPTERONE');
  prepStatic();
  DSD = makeDaily(); DS = DSD;
  climbDay = monotone(HK.climb, 'i');
  prepTfx();
  if (TL.full) {
    DSH = makeHist();
    tlDay = monotone(TLN.keys, 'i');
    histX = monotone(HS.keys, 'x');
    TL_REWIND_A = NS.rewind; TL_REWIND_B = NS.cut;
    const fCut = Math.round(NS.cut * FPS), fLev = Math.round(LV.t0 * FPS);
    TRACKS = [buildTrack(0, fCut, DSD, headDay, parDaily, shakesDaily(), [HK.drop]),
              buildTrack(fCut, fLev, DSH, t => clamp(histX(t), DSH.x0, DSH.x1), parHist, shakesHist(), [HS.drop])];
  } else TRACKS = [buildTrack(0, NF, DSD, headDay, parDaily, shakesDaily(), [HK.drop])];
  // bubbles and their burst points (screen position just before each burst)
  BUBS = [{ t0: 0.2, tb: HK.drop, ds: DSD, rad: c => 40 + 120 * clamp((vAt(DSD, c.D) - 760) / (1250 - 760), 0, 1) }];
  if (TL.full) BUBS.push({ t0: HS.bubble, tb: HS.drop, ds: DSH, rad: c => 40 + 110 * clamp((vAt(DSH, c.D) - Math.log10(200)) / (Math.log10(850) - Math.log10(200)), 0, 1) });
  for (const b of BUBS) {
    const ib = Math.round(b.tb * FPS) - 1, cb = camAt(ib); DS = cb.tr.ds; CAM = cb.tr;
    const hb = projDay(cb, cb.D);
    b.origin = hb ? { x: hb.x, y: hb.y, r: bubbleR(cb, ib / FPS, b) } : null;
  }
  BURST = BUBS[0].origin;
  BURSTS = [[HK.peakTag, PEAK.i, 'gold', 1.0, DSD], [HK.drop, PEAK.i, 'shard', 1.0, DSD, BURST], [HK.crashEnd, NOW.i, 'jade', 0.7, DSD]];
  if (TL.full) {
    for (const e of TLN.events) {
      if (e.kind === 'peak') BURSTS.push([e.t, e.i, 'gold', 1.0, DSD]);
      else if (e.kind === 'crash') BURSTS.push([e.t, e.i, 'jade', 0.6, DSD]);
    }
    for (const cr of HS.crashes) {
      BURSTS.push([cr.t_peak, cr.peak_x, 'gold', cr.n === 2 ? 1.0 : 0.7, DSH]);
      BURSTS.push([cr.t_low, cr.low_x, 'jade', 0.6, DSH]);
      if (cr.t_rec) BURSTS.push([cr.t_rec, cr.rec_x, 'gold', 0.5, DSH]);
    }
    BURSTS.push([HS.drop, HS.crashes[1].peak_x, 'shard', 1.0, DSH, BUBS[1].origin]);
    prepTimeline();
    prepInfl();
  }
  DS = DSD; CAM = TRACKS[0];
  window.READY = true;
})();

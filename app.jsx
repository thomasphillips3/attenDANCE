// LSODance — Main app: lays out all screens on the design canvas.

// Wraps an iPad-sized screen in a subtle bezel so the form-factor is obvious.
function IPadFrame({ children, label }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#111',
      borderRadius: 32,
      padding: 14,
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.18)',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      <div style={{
        width:'100%', height:'100%',
        background:'var(--white)',
        borderRadius: 20,
        overflow: 'hidden',
        position:'relative',
      }}>
        {children}
      </div>
      {/* home indicator */}
      <div style={{
        position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)',
        width:140, height:5, background:'rgba(255,255,255,0.45)', borderRadius:4,
      }}/>
    </div>
  );
}

// Interactive end-to-end flow artboard. Drives the full Mrs. Goodman journey
// in a single iPad without leaving the canvas.
function InteractiveFlow() {
  const [screen, setScreen] = React.useState('home');
  const [pickedClass, setPickedClass] = React.useState(CLASSES[3]); // Hip Hop Intermediate
  const [doneSet, setDoneSet] = React.useState(new Set(['praise', 'ballet1']));
  const [statuses, setStatuses] = React.useState(null);

  const onPick = (cls) => {
    if (doneSet.has(cls.id)) return; // already submitted
    setPickedClass(cls);
    setScreen('roster');
  };

  // Inject "done" state into the class list for the home screen.
  const classesWithDone = React.useMemo(() => CLASSES.map((c) => ({
    ...c,
    done: doneSet.has(c.id) || c.done,
  })), [doneSet]);

  // Re-compute counts when entering confirm
  const counts = React.useMemo(() => {
    if (!statuses) return { present: 14, absent: 2 };
    const ns = HIP_HOP_ROSTER;
    let p = 0, a = 0;
    ns.forEach((n) => {
      if (statuses[n] === 'absent') a++; else p++;
    });
    return { present: p, absent: a };
  }, [statuses]);

  let body;
  if (screen === 'home') {
    body = <HomeWithDone classes={classesWithDone} onPick={onPick} />;
  } else if (screen === 'roster') {
    body = <Roster
      classData={pickedClass}
      onBack={() => setScreen('home')}
      onSubmit={() => setScreen('confirm')}
      onStateChange={setStatuses}
    />;
  } else if (screen === 'confirm') {
    body = <ConfirmModal
      classData={pickedClass}
      present={counts.present}
      absent={counts.absent}
      onCancel={() => setScreen('roster')}
      onConfirm={() => setScreen('success')}
      baseScreen={<Roster classData={pickedClass} initialStatuses={statuses}/>}
    />;
  } else if (screen === 'success') {
    body = <Success
      classData={pickedClass}
      onDone={() => {
        setDoneSet((d) => { const n = new Set(d); n.add(pickedClass.id); return n; });
        setScreen('home');
      }}
    />;
  }

  return <IPadFrame>{body}</IPadFrame>;
}

// Home screen that respects the `done` flag from props
function HomeWithDone({ classes, onPick }) {
  return (
    <div className="lso-screen">
      <StatusBar time="10:54 AM" />
      <div style={{padding:'24px 40px 0'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:24}}>
          <div>
            <div style={{fontSize:16, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase'}}>Today</div>
            <div style={{fontFamily:'var(--display)', fontSize:42, color:'var(--ink)', lineHeight:1.05, marginTop:4}}>
              {TODAY_LONG}
            </div>
          </div>
          <Logo size={24} />
        </div>
        <div style={{fontFamily:'var(--display)', fontSize:34, color:'var(--purple)', marginBottom:6, fontStyle:'italic'}}>
          Good morning, Mrs. Goodman.
        </div>
        <div style={{fontSize:19, color:'var(--ink-2)', marginBottom:22}}>
          Tap a class to take attendance.
        </div>
      </div>
      <div style={{padding:'0 40px 28px', display:'flex', flexDirection:'column', gap:14, overflow:'auto'}}>
        {classes.map((c) => <ClassCardWrap key={c.id} cls={c} onPick={onPick} />)}
      </div>
      <div style={{
        position:'absolute', bottom:18, left:40, right:40,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        fontSize:14, color:'var(--ink-3)',
      }}>
        <div>Signed in as <strong style={{color:'var(--ink-2)'}}>Mrs. Goodman</strong> · Front desk iPad</div>
        <div>{TODAY_LABEL} · 10:54 AM</div>
      </div>
    </div>
  );
}

// Re-render of ClassCard that uses the dynamic `done` flag instead of the static
function ClassCardWrap({ cls, onPick }) {
  const done = cls.done;
  return (
    <button
      onClick={() => onPick && onPick(cls)}
      style={{
        all:'unset',
        cursor: done ? 'default' : 'pointer',
        background: done ? 'var(--paper)' : 'var(--white)',
        border: done ? '1.5px solid var(--line)' : '1.5px solid var(--line-strong)',
        borderRadius:'var(--r-lg)',
        padding:'22px 26px',
        display:'flex', alignItems:'center', gap:24,
        boxShadow: done ? 'none' : 'var(--shadow-card)',
        minHeight: 96,
        opacity: done ? 0.75 : 1,
        position:'relative',
      }}
    >
      <div style={{
        width:84, height:84, borderRadius:18,
        background: done ? 'var(--purple-tint)' : 'var(--purple)',
        color: done ? 'var(--purple)' : 'var(--white)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--display)', flexShrink:0,
        flexDirection:'column',
      }}>
        <div style={{fontSize:22, fontWeight:400, lineHeight:1}}>{cls.time.split(' ')[0]}</div>
        <div style={{fontSize:13, fontFamily:'var(--body)', fontWeight:700, letterSpacing:'0.08em', opacity:0.85, marginTop:2}}>{cls.time.split(' ')[1]}</div>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontFamily:'var(--display)', fontSize:30, color: done ? 'var(--ink-2)' : 'var(--ink)', lineHeight:1.1}}>
          {cls.name}
        </div>
        <div style={{fontSize:18, color:'var(--ink-2)', marginTop:6}}>
          {cls.instructor} · {cls.count} students
        </div>
        {done && (
          <div style={{fontSize:15, color:'var(--purple)', marginTop:6, fontWeight:700}}>
            ✓ Submitted
          </div>
        )}
      </div>
      <div style={{flexShrink:0}}>
        {done ? (
          <div style={{
            width:48, height:48, borderRadius:'50%',
            background:'var(--purple)', color:'var(--white)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:24, fontWeight:700,
          }}>✓</div>
        ) : (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M12 8 L20 16 L12 24" stroke="var(--purple)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Root canvas ──────────────────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="intro"
        title="LSODance Attendance · iPad PWA"
        subtitle="Designed for Mrs. Goodman at the front desk · iPad portrait · 820 × 1180"
      >
        <DCArtboard id="spec" label="Design system · palette · type · rationale" width={1280} height={1500}>
          <SpecCard />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="ipad-flow"
        title="Mrs. Goodman's flow"
        subtitle="Each artboard is a self-contained iPad screen. The last one is fully interactive — tap through it."
      >
        <DCArtboard id="s1" label="01 · Class selection (home)" width={820} height={1180}>
          <IPadFrame><ScreenClassSelection /></IPadFrame>
        </DCArtboard>
        <DCArtboard id="s2" label="02 · Roster · attendance" width={820} height={1180}>
          <IPadFrame><ScreenRoster /></IPadFrame>
        </DCArtboard>
        <DCArtboard id="s3" label="03 · Submit confirmation" width={820} height={1180}>
          <IPadFrame><ScreenConfirm /></IPadFrame>
        </DCArtboard>
        <DCArtboard id="s4" label="04 · Saved · success" width={820} height={1180}>
          <IPadFrame><ScreenSuccess /></IPadFrame>
        </DCArtboard>
        <DCArtboard id="s5" label="05 · Offline banner" width={820} height={1180}>
          <IPadFrame><ScreenOffline /></IPadFrame>
        </DCArtboard>
        <DCArtboard id="s-flow" label="◆ Interactive · tap to walk through" width={820} height={1180}>
          <InteractiveFlow />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="admin"
        title="Carollette's studio admin"
        subtitle="Desktop · 1280 × 900 · same palette, same type system"
      >
        <DCArtboard id="admin" label="06 · Admin dashboard" width={1280} height={900}>
          <AdminDashboard />
        </DCArtboard>
      </DCSection>

      <DCPostIt top={-90} left={20} rotate={-3} width={260}>
        Brief: design a dance studio attendance PWA. Anchor on brand purple #8F2DB5, lean into prestige (Opera House, Thanksgiving Parade), and design for an older user at the front desk.
      </DCPostIt>

      <DCPostIt top={2800} left={900} rotate={2} width={240}>
        Try the last iPad → tap a class → toggle students → submit. The "done" classes update on the home screen when you return.
      </DCPostIt>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

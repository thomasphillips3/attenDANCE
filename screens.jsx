// LSODance — Mrs. Goodman's iPad screens (820×1180 portrait)

const TODAY_LABEL = 'Saturday, May 23';
const TODAY_LONG = 'Saturday, May 23, 2026';

const CLASSES = [
  { id: 'praise',   name: 'Praise Dance',          time: '9:00 AM',  instructor: 'Ms. LaShelle Johnson', count: 12, done: true,  badge: 'Submitted at 9:48 AM' },
  { id: 'ballet1',  name: 'Ballet I',              time: '10:00 AM', instructor: 'Ms. Whitney Carter',    count: 14, done: true,  badge: 'Submitted at 10:51 AM' },
  { id: 'tap',      name: 'Tap Foundations',       time: '11:00 AM', instructor: 'Mr. Marcus Davis',      count: 9,  done: false, current: true },
  { id: 'hiphop',   name: 'Hip Hop Intermediate',  time: '12:30 PM', instructor: 'Ms. Janelle Brooks',    count: 16, done: false },
  { id: 'jazz',     name: 'Jazz Beginners',        time: '2:00 PM',  instructor: 'Ms. Whitney Carter',    count: 11, done: false },
  { id: 'acro',     name: 'Acro',                  time: '3:30 PM',  instructor: 'Ms. Tiffany Hayes',     count: 8,  done: false },
  { id: 'contemp',  name: 'Contemporary',          time: '5:00 PM',  instructor: 'Ms. Janelle Brooks',    count: 10, done: false },
];

const HIP_HOP_ROSTER = [
  'Amara Johnson', 'Zaria Thompson', 'Imani Williams', 'Kennedi Brooks',
  'Nyla Patterson', 'Jasmine Carter', "Aaliyah Davis", 'Sanaa Mitchell',
  'Layla Harris', 'Aniyah Robinson', 'Sydney Powell', 'Mariah Jefferson',
  'Zoe Crawford', 'Brielle Washington', 'Camille Hayes', 'Trinity Anderson',
];

// ─── StatusBar ─────────────────────────────────────────────────────────────
function StatusBar({ time = '10:54 AM' }) {
  return (
    <div className="lso-statusbar">
      <div>{time}</div>
      <div className="right">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 11.5c.83 0 1.5-.67 1.5-1.5S8.83 8.5 8 8.5 6.5 9.17 6.5 10 7.17 11.5 8 11.5z" fill="#1a1a1a"/>
          <path d="M3.2 6.6a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0L3.2 6.6z" fill="#1a1a1a"/>
          <path d="M.4 3.8a10.8 10.8 0 0 1 15.2 0l-1.4 1.4a8.8 8.8 0 0 0-12.4 0L.4 3.8z" fill="#1a1a1a"/>
        </svg>
        <div style={{fontWeight:700, fontSize:13, letterSpacing:'0.02em'}}>LSODance</div>
        <div className="battery" />
      </div>
    </div>
  );
}

// ─── Logotype ──────────────────────────────────────────────────────────────
function Logo({ size = 22, color = 'var(--purple)' }) {
  return (
    <div style={{
      fontFamily: 'var(--body)',
      fontWeight: 700,
      fontSize: size,
      letterSpacing: '-0.01em',
      color,
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 0,
    }}>
      <span>LSO</span>
      <span style={{fontFamily:'var(--display)', fontWeight:400, fontStyle:'italic', marginLeft:1}}>Dance</span>
    </div>
  );
}

// ─── Screen 1 — Class Selection ────────────────────────────────────────────
function ClassSelection({ onPick }) {
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
        {CLASSES.map((c) => (
          <ClassCard key={c.id} cls={c} onPick={onPick} />
        ))}
      </div>

      <div style={{
        position:'absolute', bottom:18, left:40, right:40,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        fontSize:14, color:'var(--ink-3)'
      }}>
        <div>Signed in as <strong style={{color:'var(--ink-2)'}}>Mrs. Goodman</strong> · Front desk iPad</div>
        <div>{TODAY_LABEL} · 10:54 AM</div>
      </div>
    </div>
  );
}

function ClassCard({ cls, onPick }) {
  const done = cls.done;
  return (
    <button
      onClick={() => onPick && onPick(cls)}
      style={{
        all:'unset',
        cursor:'pointer',
        background: done ? 'var(--paper)' : 'var(--white)',
        border: done ? '1.5px solid var(--line)' : '1.5px solid var(--line-strong)',
        borderRadius:'var(--r-lg)',
        padding:'22px 26px',
        display:'flex',
        alignItems:'center',
        gap:24,
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
        <div style={{display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap'}}>
          <div style={{fontFamily:'var(--display)', fontSize:30, color: done ? 'var(--ink-2)' : 'var(--ink)', lineHeight:1.1}}>
            {cls.name}
          </div>
          {cls.current && <span style={{
            fontSize:12, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
            background:'var(--gold-soft)', color:'var(--gold-ink)', padding:'4px 10px', borderRadius:999,
          }}>Up next</span>}
        </div>
        <div style={{fontSize:18, color:'var(--ink-2)', marginTop:6}}>
          {cls.instructor} · {cls.count} students
        </div>
        {done && (
          <div style={{fontSize:15, color:'var(--purple)', marginTop:6, fontWeight:700}}>
            ✓ {cls.badge}
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

// ─── Screen 2 — Roster / attendance ────────────────────────────────────────
// status: 'present' | 'absent' | 'late' | 'excused'
function Roster({ classData = CLASSES[3], offline = false, onBack, onSubmit, initialStatuses, onStateChange }) {
  const [statuses, setStatuses] = React.useState(() => {
    if (initialStatuses) return initialStatuses;
    const out = {};
    HIP_HOP_ROSTER.forEach((n) => (out[n] = 'present'));
    // realistic mix for the static mockup
    out['Layla Harris'] = 'absent';
    out['Mariah Jefferson'] = 'absent';
    out['Camille Hayes'] = 'late';
    return out;
  });
  const [openMenu, setOpenMenu] = React.useState(null);

  React.useEffect(() => {
    onStateChange && onStateChange(statuses);
  }, [statuses]);

  const counts = HIP_HOP_ROSTER.reduce(
    (acc, n) => {
      const s = statuses[n];
      if (s === 'absent') acc.absent++;
      else acc.present++; // late/excused still count as present in the bottom bar
      return acc;
    },
    { present: 0, absent: 0 }
  );

  const toggle = (name) => {
    setStatuses((s) => ({ ...s, [name]: s[name] === 'absent' ? 'present' : 'absent' }));
  };
  const setStatus = (name, val) => {
    setStatuses((s) => ({ ...s, [name]: val }));
    setOpenMenu(null);
  };

  return (
    <div className="lso-screen">
      <StatusBar time="12:31 PM" />

      {/* Header */}
      <div style={{padding:'18px 32px 14px', borderBottom:'1px solid var(--line)', background:'var(--white)'}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <button onClick={onBack} style={{
            all:'unset', cursor:'pointer',
            width:56, height:56, borderRadius:'var(--r-md)',
            background:'var(--paper)', display:'flex', alignItems:'center', justifyContent:'center',
            border:'1.5px solid var(--line)',
            flexShrink:0,
          }} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 6 L9 12 L15 18" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:14, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase'}}>
              Taking attendance
            </div>
            <div style={{fontFamily:'var(--display)', fontSize:32, color:'var(--ink)', lineHeight:1.1, marginTop:2}}>
              {classData.name}
            </div>
            <div style={{fontSize:17, color:'var(--ink-2)', marginTop:2}}>
              {classData.time} · {classData.instructor}
            </div>
          </div>
          <div style={{
            background:'var(--purple)', color:'var(--white)',
            padding:'10px 18px', borderRadius:999,
            fontWeight:700, fontSize:18, flexShrink:0,
          }}>
            {HIP_HOP_ROSTER.length} students
          </div>
        </div>
      </div>

      {/* Offline banner */}
      {offline && (
        <div style={{
          padding:'14px 32px',
          background:'var(--gold-soft)',
          borderBottom:'1px solid #e8d49a',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <div style={{
            width:36, height:36, borderRadius:'50%',
            background:'var(--gold)', color:'var(--white)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            fontWeight:900, fontSize:20,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 7c4-4 10-4 14 0M6 10c2.5-2.5 5.5-2.5 8 0M10 13.5v.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 3 L17 17" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700, fontSize:17, color:'var(--gold-ink)'}}>You're offline — that's okay.</div>
            <div style={{fontSize:15, color:'var(--gold-ink)', opacity:0.85, marginTop:2}}>
              Keep taking attendance. We'll sync everything when you reconnect.
            </div>
          </div>
        </div>
      )}

      {/* Roster list */}
      <div style={{
        flex:1, overflow:'auto',
        padding:'18px 32px 180px',
        display:'flex', flexDirection:'column', gap:12,
        height: offline ? 'calc(100% - 230px - 88px)' : 'calc(100% - 158px - 88px)',
      }}>
        {HIP_HOP_ROSTER.map((name) => (
          <StudentRow
            key={name}
            name={name}
            status={statuses[name]}
            onToggle={() => toggle(name)}
            onOpenMenu={() => setOpenMenu(openMenu === name ? null : name)}
            menuOpen={openMenu === name}
            onSetStatus={(v) => setStatus(name, v)}
          />
        ))}
      </div>

      {/* Sticky submit bar */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        background:'var(--white)',
        borderTop:'1px solid var(--line-strong)',
        padding:'12px 24px 18px',
        display:'flex', flexDirection:'column', gap:10,
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 4px'}}>
          <div style={{display:'flex', gap:18}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{width:12, height:12, borderRadius:'50%', background:'var(--green)'}} />
              <span style={{fontSize:18, fontWeight:700, color:'var(--ink)'}}>{counts.present} present</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <div style={{width:12, height:12, borderRadius:'50%', background:'var(--red)'}} />
              <span style={{fontSize:18, fontWeight:700, color:'var(--ink)'}}>{counts.absent} absent</span>
            </div>
          </div>
          <div style={{fontSize:15, color:'var(--ink-3)'}}>
            Auto-saved · {classData.time}
          </div>
        </div>
        <button
          onClick={onSubmit}
          style={{
            all:'unset', cursor:'pointer',
            background:'var(--purple)', color:'var(--white)',
            height:64, borderRadius:'var(--r-md)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:700, fontSize:22,
            letterSpacing:'0.01em',
            textAlign:'center',
            boxShadow:'0 2px 0 var(--purple-deep)',
          }}
        >
          Submit attendance
        </button>
      </div>
    </div>
  );
}

function StudentRow({ name, status, onToggle, onOpenMenu, menuOpen, onSetStatus }) {
  const isAbsent = status === 'absent';
  const isLate = status === 'late';
  const isExcused = status === 'excused';
  const isPresent = status === 'present';

  let bg, fg, icon, label;
  if (isAbsent) {
    bg = 'var(--red)'; fg = 'var(--white)';
    icon = '✕'; label = 'Absent';
  } else if (isLate) {
    bg = 'var(--gold-soft)'; fg = 'var(--gold-ink)';
    icon = '◔'; label = 'Late';
  } else if (isExcused) {
    bg = 'var(--purple-tint)'; fg = 'var(--purple-ink)';
    icon = '◑'; label = 'Excused';
  } else {
    bg = 'var(--green)'; fg = 'var(--white)';
    icon = '✓'; label = 'Present';
  }

  return (
    <div style={{position:'relative', display:'flex', gap:10}}>
      <button
        onClick={onToggle}
        style={{
          all:'unset', cursor:'pointer',
          flex:1,
          background: bg, color: fg,
          borderRadius:'var(--r-md)',
          padding:'18px 22px',
          minHeight:72,
          display:'flex', alignItems:'center', gap:18,
          border: isLate ? '1.5px solid #d4a84b' : isExcused ? '1.5px solid var(--purple-tint-strong)' : 'none',
        }}
      >
        <div style={{
          width:44, height:44, borderRadius:'50%',
          background:'rgba(255,255,255,0.22)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:24, fontWeight:900, flexShrink:0,
          color: fg,
          ...(isLate || isExcused ? { background: 'rgba(0,0,0,0.08)' } : {}),
        }}>{icon}</div>
        <div style={{flex:1, fontSize:22, fontWeight:700, textAlign:'left', lineHeight:1.2}}>{name}</div>
        <div style={{
          fontSize:14, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase',
          opacity: 0.85,
        }}>{label}</div>
      </button>
      <button
        onClick={onOpenMenu}
        aria-label="More options"
        style={{
          all:'unset', cursor:'pointer',
          width:64, minHeight:72,
          background:'var(--paper)',
          border:'1.5px solid var(--line)',
          borderRadius:'var(--r-md)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:28, color:'var(--ink-2)', fontWeight:900,
          letterSpacing:'-0.05em',
        }}
      >···</button>
      {menuOpen && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0,
          background:'var(--white)',
          border:'1.5px solid var(--line-strong)',
          borderRadius:'var(--r-md)',
          boxShadow:'var(--shadow-modal)',
          padding:6, zIndex:10, minWidth:200,
        }}>
          {[
            ['present', 'Present'],
            ['absent', 'Absent'],
            ['late', 'Late'],
            ['excused', 'Excused'],
          ].map(([v, l]) => (
            <button key={v}
              onClick={() => onSetStatus(v)}
              style={{
                all:'unset', cursor:'pointer', display:'block',
                width:'100%', padding:'14px 16px',
                fontSize:18, fontWeight:700, color:'var(--ink)',
                borderRadius:8,
                background: status === v ? 'var(--purple-tint)' : 'transparent',
                boxSizing:'border-box',
              }}
            >{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Screen 3 — Confirm modal ──────────────────────────────────────────────
function ConfirmModal({ classData = CLASSES[3], present = 14, absent = 2, onCancel, onConfirm, baseScreen }) {
  return (
    <div className="lso-screen" style={{background:'#f4f0eb'}}>
      {/* Dimmed roster behind */}
      <div style={{
        position:'absolute', inset:0,
        filter:'blur(2px) saturate(0.6)',
        opacity:0.45,
      }}>
        {baseScreen}
      </div>
      <div style={{position:'absolute', inset:0, background:'rgba(20,10,30,0.55)'}} />

      {/* Modal */}
      <div style={{
        position:'absolute', left:'50%', top:'50%',
        transform:'translate(-50%, -50%)',
        width: 640,
        background:'var(--white)',
        borderRadius:'var(--r-xl)',
        padding:'40px 44px 36px',
        boxShadow:'var(--shadow-modal)',
      }}>
        <div style={{
          width:64, height:64, borderRadius:'50%',
          background:'var(--purple-tint)',
          display:'flex', alignItems:'center', justifyContent:'center',
          marginBottom:18,
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 7v8M14 19v.5" stroke="var(--purple)" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{fontSize:15, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8}}>
          Ready to submit
        </div>
        <div style={{fontFamily:'var(--display)', fontSize:42, color:'var(--ink)', lineHeight:1.1}}>
          Submit attendance for {classData.name}?
        </div>
        <div style={{fontSize:18, color:'var(--ink-2)', marginTop:10, marginBottom:24}}>
          {TODAY_LONG} · {classData.time} · {classData.instructor}
        </div>

        <div style={{display:'flex', gap:14, marginBottom:32}}>
          <div style={{flex:1, background:'var(--green-soft)', borderRadius:'var(--r-md)', padding:'16px 20px', border:'1.5px solid #b6e3c2'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <div style={{width:10, height:10, borderRadius:'50%', background:'var(--green)'}} />
              <div style={{fontSize:14, fontWeight:700, color:'var(--green-deep)', textTransform:'uppercase', letterSpacing:'0.06em'}}>Present</div>
            </div>
            <div style={{fontFamily:'var(--display)', fontSize:44, color:'var(--green-deep)', lineHeight:1}}>{present}</div>
          </div>
          <div style={{flex:1, background:'var(--red-soft)', borderRadius:'var(--r-md)', padding:'16px 20px', border:'1.5px solid #f3b0b0'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
              <div style={{width:10, height:10, borderRadius:'50%', background:'var(--red)'}} />
              <div style={{fontSize:14, fontWeight:700, color:'var(--red-deep)', textTransform:'uppercase', letterSpacing:'0.06em'}}>Absent</div>
            </div>
            <div style={{fontFamily:'var(--display)', fontSize:44, color:'var(--red-deep)', lineHeight:1}}>{absent}</div>
          </div>
        </div>

        <div style={{display:'flex', gap:14}}>
          <button onClick={onCancel} style={{
            all:'unset', cursor:'pointer',
            flex:1, height:68, borderRadius:'var(--r-md)',
            background:'var(--white)', color:'var(--purple)',
            border:'2px solid var(--purple)',
            fontSize:21, fontWeight:700, textAlign:'center',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>Go back</button>
          <button onClick={onConfirm} style={{
            all:'unset', cursor:'pointer',
            flex:1.4, height:68, borderRadius:'var(--r-md)',
            background:'var(--purple)', color:'var(--white)',
            fontSize:21, fontWeight:700, textAlign:'center',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 2px 0 var(--purple-deep)',
          }}>Confirm and submit</button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen 4 — Success ─────────────────────────────────────────────────────
function Success({ classData = CLASSES[3], onDone }) {
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 3000);
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        onDone && onDone();
      }
    }, 30);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lso-screen" style={{background:'linear-gradient(180deg, #f7f0fa 0%, #ffffff 60%)'}}>
      <StatusBar time="12:43 PM" />
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'0 40px', textAlign:'center',
      }}>
        {/* Big check with concentric rings */}
        <div style={{position:'relative', width:280, height:280, marginBottom:32}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%', background:'var(--purple-tint)', opacity:0.45}} />
          <div style={{position:'absolute', inset:30, borderRadius:'50%', background:'var(--purple-tint)'}} />
          <div style={{
            position:'absolute', inset:62, borderRadius:'50%',
            background:'var(--purple)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 12px 40px rgba(143,45,181,0.35)',
          }}>
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
              <path d="M28 52 L44 68 L74 36" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {/* gold sparkle */}
          <svg width="20" height="20" viewBox="0 0 20 20" style={{position:'absolute', top:18, right:34}}>
            <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="var(--gold)"/>
          </svg>
          <svg width="14" height="14" viewBox="0 0 20 20" style={{position:'absolute', bottom:30, left:14}}>
            <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="var(--gold)"/>
          </svg>
        </div>

        <div style={{fontFamily:'var(--display)', fontSize:64, color:'var(--ink)', lineHeight:1.05, marginBottom:14}}>
          Attendance saved.
        </div>
        <div style={{fontSize:24, color:'var(--ink-2)', marginBottom:8}}>
          {classData.name} · {classData.time}
        </div>
        <div style={{fontSize:18, color:'var(--ink-3)', marginBottom:30}}>
          14 present · 2 absent · marked by Mrs. Goodman
        </div>
        <div style={{
          fontSize:17, color:'var(--purple)', fontWeight:700,
          fontStyle:'italic', fontFamily:'var(--display)',
        }}>
          Thank you. Returning home in a moment…
        </div>
      </div>

      {/* drain progress bar */}
      <div style={{position:'absolute', left:0, right:0, bottom:0, height:4, background:'var(--purple-tint)'}}>
        <div style={{
          height:'100%',
          width: `${(1 - progress) * 100}%`,
          background:'var(--purple)',
          marginLeft:'auto',
          transition:'width 30ms linear',
        }} />
      </div>
    </div>
  );
}

// ─── Static wrappers used as design-canvas screens (non-interactive entry) ─

function ScreenClassSelection() {
  return <ClassSelection />;
}

function ScreenRoster() {
  return <Roster />;
}

function ScreenConfirm() {
  return (
    <ConfirmModal
      baseScreen={<Roster />}
    />
  );
}

function ScreenSuccess() {
  // freeze progress at ~30% for the static mockup
  return <FrozenSuccess />;
}

function FrozenSuccess() {
  const classData = CLASSES[3];
  return (
    <div className="lso-screen" style={{background:'linear-gradient(180deg, #f7f0fa 0%, #ffffff 60%)'}}>
      <StatusBar time="12:43 PM" />
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'0 40px', textAlign:'center',
      }}>
        <div style={{position:'relative', width:280, height:280, marginBottom:32}}>
          <div style={{position:'absolute', inset:0, borderRadius:'50%', background:'var(--purple-tint)', opacity:0.45}} />
          <div style={{position:'absolute', inset:30, borderRadius:'50%', background:'var(--purple-tint)'}} />
          <div style={{
            position:'absolute', inset:62, borderRadius:'50%',
            background:'var(--purple)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 12px 40px rgba(143,45,181,0.35)',
          }}>
            <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
              <path d="M28 52 L44 68 L74 36" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" style={{position:'absolute', top:18, right:34}}>
            <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="var(--gold)"/>
          </svg>
          <svg width="14" height="14" viewBox="0 0 20 20" style={{position:'absolute', bottom:30, left:14}}>
            <path d="M10 0 L11.5 8.5 L20 10 L11.5 11.5 L10 20 L8.5 11.5 L0 10 L8.5 8.5 Z" fill="var(--gold)"/>
          </svg>
        </div>
        <div style={{fontFamily:'var(--display)', fontSize:64, color:'var(--ink)', lineHeight:1.05, marginBottom:14}}>
          Attendance saved.
        </div>
        <div style={{fontSize:24, color:'var(--ink-2)', marginBottom:8}}>
          {classData.name} · {classData.time}
        </div>
        <div style={{fontSize:18, color:'var(--ink-3)', marginBottom:30}}>
          14 present · 2 absent · marked by Mrs. Goodman
        </div>
        <div style={{
          fontSize:17, color:'var(--purple)', fontWeight:700,
          fontStyle:'italic', fontFamily:'var(--display)',
        }}>
          Thank you. Returning home in a moment…
        </div>
      </div>
      <div style={{position:'absolute', left:0, right:0, bottom:0, height:4, background:'var(--purple-tint)'}}>
        <div style={{ height:'100%', width:'62%', background:'var(--purple)', marginLeft:'auto' }} />
      </div>
    </div>
  );
}

function ScreenOffline() {
  return <Roster offline={true} />;
}

// Export to window so other Babel files can find them
Object.assign(window, {
  ClassSelection, Roster, ConfirmModal, Success,
  ScreenClassSelection, ScreenRoster, ScreenConfirm, ScreenSuccess, ScreenOffline,
  Logo, StatusBar, CLASSES, HIP_HOP_ROSTER, TODAY_LABEL, TODAY_LONG,
});

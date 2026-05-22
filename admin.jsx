// LSODance — Admin dashboard (Carollette's view, 1280×900)

const ADMIN_CLASSES_TODAY = [
  { name: 'Praise Dance',         time: '9:00 AM',  instructor: 'LaShelle J.',  present: 11, absent: 1, total: 12, status: 'done',     markedBy: 'Mrs. Goodman' },
  { name: 'Ballet I',             time: '10:00 AM', instructor: 'Whitney C.',   present: 13, absent: 1, total: 14, status: 'done',     markedBy: 'Mrs. Goodman' },
  { name: 'Tap Foundations',      time: '11:00 AM', instructor: 'Marcus D.',    present: 8,  absent: 1, total: 9,  status: 'done',     markedBy: 'Mrs. Goodman' },
  { name: 'Hip Hop Intermediate', time: '12:30 PM', instructor: 'Janelle B.',   present: 14, absent: 2, total: 16, status: 'progress', markedBy: 'Mrs. Goodman' },
  { name: 'Jazz Beginners',       time: '2:00 PM',  instructor: 'Whitney C.',   present: 0,  absent: 0, total: 11, status: 'pending',  markedBy: '—' },
  { name: 'Acro',                 time: '3:30 PM',  instructor: 'Tiffany H.',   present: 0,  absent: 0, total: 8,  status: 'pending',  markedBy: '—' },
  { name: 'Contemporary',         time: '5:00 PM',  instructor: 'Janelle B.',   present: 0,  absent: 0, total: 10, status: 'pending',  markedBy: '—' },
];

const RECENT_ATTENDANCE = [
  { student: 'Amara Johnson',     cls: 'Hip Hop Intermediate', date: 'May 23, 12:31 PM', status: 'present', markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Layla Harris',      cls: 'Hip Hop Intermediate', date: 'May 23, 12:31 PM', status: 'absent',  markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Camille Hayes',     cls: 'Hip Hop Intermediate', date: 'May 23, 12:31 PM', status: 'late',    markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Trinity Anderson',  cls: 'Hip Hop Intermediate', date: 'May 23, 12:30 PM', status: 'present', markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Bryce Coleman',     cls: 'Tap Foundations',      date: 'May 23, 11:04 AM', status: 'present', markedBy: 'RFID Reader',   method: 'rfid'   },
  { student: 'Eden Whitfield',    cls: 'Tap Foundations',      date: 'May 23, 11:03 AM', status: 'present', markedBy: 'RFID Reader',   method: 'rfid'   },
  { student: 'Solomon Pierre',    cls: 'Tap Foundations',      date: 'May 23, 11:02 AM', status: 'absent',  markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Naomi Sutton',      cls: 'Ballet I',             date: 'May 23, 10:51 AM', status: 'present', markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Faith Okonkwo',     cls: 'Ballet I',             date: 'May 23, 10:51 AM', status: 'excused', markedBy: 'Mrs. Goodman', method: 'manual' },
  { student: 'Iyana Beauchamp',   cls: 'Praise Dance',         date: 'May 23,  9:48 AM', status: 'present', markedBy: 'Mrs. Goodman', method: 'manual' },
];

function StatusPill({ status }) {
  const map = {
    present:  { bg:'var(--green-soft)',  fg:'var(--green-deep)', dot:'var(--green)', label:'Present' },
    absent:   { bg:'var(--red-soft)',    fg:'var(--red-deep)',   dot:'var(--red)',   label:'Absent'  },
    late:     { bg:'var(--gold-soft)',   fg:'var(--gold-ink)',   dot:'var(--gold)',  label:'Late'    },
    excused:  { bg:'var(--purple-tint)', fg:'var(--purple-ink)', dot:'var(--purple)',label:'Excused' },
  }[status];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      background: map.bg, color: map.fg,
      fontSize:13, fontWeight:700, padding:'4px 10px', borderRadius:999,
      letterSpacing:'0.02em',
    }}>
      <span style={{width:7, height:7, borderRadius:'50%', background:map.dot}}/>
      {map.label}
    </span>
  );
}

function RfidBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:'#eef2ff', color:'#3a3aa8',
      fontSize:11, fontWeight:700, padding:'3px 7px 3px 6px', borderRadius:6,
      letterSpacing:'0.06em', textTransform:'uppercase',
      border:'1px solid #d4d8f5',
    }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 4c2-2 6-2 8 0M3.5 6c1.4-1.4 3.6-1.4 5 0M6 8.5v.5" stroke="#3a3aa8" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
      RFID
    </span>
  );
}

function ManualBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      background:'#f4f0eb', color:'var(--ink-2)',
      fontSize:11, fontWeight:700, padding:'3px 7px', borderRadius:6,
      letterSpacing:'0.06em', textTransform:'uppercase',
      border:'1px solid var(--line)',
    }}>
      iPad
    </span>
  );
}

function AdminSidebar({ active = 'Dashboard' }) {
  const items = [
    ['Dashboard', 'home'],
    ['Students', 'users'],
    ['Classes', 'calendar'],
    ['Attendance', 'check'],
    ['Reports', 'chart'],
  ];
  const icons = {
    home: <path d="M3 10 L10 4 L17 10 V16 H12 V12 H8 V16 H3 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>,
    users: <g stroke="currentColor" strokeWidth="1.6" fill="none"><circle cx="7" cy="7" r="2.5"/><circle cx="13" cy="8" r="2"/><path d="M2.5 16c.5-3 3-4 4.5-4s4 1 4.5 4M11 16c0-2 1.5-3.2 3-3.2s3 1 3.2 3"/></g>,
    calendar: <g stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 3v3M13 3v3"/></g>,
    check: <g stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M6 10 L9 13 L14 7"/></g>,
    chart: <g stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M3 16 L3 4M3 16 L17 16M6 13 L6 9 M10 13 L10 7 M14 13 L14 5"/></g>,
  };
  return (
    <div style={{
      width:240, height:'100%',
      background:'var(--white)',
      borderRight:'1px solid var(--line)',
      padding:'24px 18px',
      display:'flex', flexDirection:'column', flexShrink:0,
    }}>
      <div style={{padding:'4px 10px 22px', borderBottom:'1px solid var(--line)', marginBottom:18}}>
        <Logo size={26} />
        <div style={{fontSize:12, color:'var(--ink-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginTop:6, fontWeight:700}}>
          Studio Admin
        </div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:2}}>
        {items.map(([name, key]) => {
          const isActive = name === active;
          return (
            <button key={name} style={{
              all:'unset', cursor:'pointer',
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 14px', borderRadius:10,
              background: isActive ? 'var(--purple-tint)' : 'transparent',
              color: isActive ? 'var(--purple)' : 'var(--ink-2)',
              fontWeight: isActive ? 700 : 500,
              fontSize:15,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20">{icons[key]}</svg>
              {name}
              {name === 'Attendance' && !isActive && (
                <span style={{
                  marginLeft:'auto',
                  background:'var(--gold-soft)', color:'var(--gold-ink)',
                  fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:999,
                  letterSpacing:'0.06em',
                }}>4 new</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{marginTop:'auto', padding:'14px 12px', borderTop:'1px solid var(--line)'}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{
            width:36, height:36, borderRadius:'50%',
            background:'var(--purple)', color:'white',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:700, fontSize:14,
          }}>CW</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14, fontWeight:700, color:'var(--ink)'}}>Carollette Williams</div>
            <div style={{fontSize:12, color:'var(--ink-3)'}}>Director · Owner</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ cls }) {
  const pct = cls.total ? Math.round((cls.present / cls.total) * 100) : 0;
  let statusEl;
  if (cls.status === 'done') {
    statusEl = <span style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'var(--green-deep)'}}>
      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke="var(--green)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      Complete
    </span>;
  } else if (cls.status === 'progress') {
    statusEl = <span style={{display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'var(--purple)'}}>
      <span style={{width:8, height:8, borderRadius:'50%', background:'var(--purple)', boxShadow:'0 0 0 4px var(--purple-tint)'}}/>
      In progress
    </span>;
  } else {
    statusEl = <span style={{fontSize:12, fontWeight:700, color:'var(--ink-3)', letterSpacing:'0.06em', textTransform:'uppercase'}}>Pending</span>;
  }
  return (
    <div style={{
      background:'var(--white)',
      borderRadius:'var(--r-md)',
      border:'1px solid var(--line)',
      padding:'14px 16px',
      display:'flex', flexDirection:'column', gap:6,
      minWidth:0,
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:11, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase'}}>{cls.time}</div>
        {statusEl}
      </div>
      <div style={{fontFamily:'var(--display)', fontSize:18, color:'var(--ink)', lineHeight:1.15}}>{cls.name}</div>
      <div style={{fontSize:12, color:'var(--ink-3)'}}>{cls.instructor}</div>
      <div style={{
        display:'flex', alignItems:'baseline', gap:6, marginTop:4,
      }}>
        <span style={{fontFamily:'var(--display)', fontSize:26, color: cls.status==='pending' ? 'var(--ink-3)' : 'var(--ink)'}}>
          {cls.status==='pending' ? '—' : `${cls.present}/${cls.total}`}
        </span>
        {cls.status !== 'pending' && (
          <span style={{fontSize:12, color: cls.absent>0 ? 'var(--red-deep)' : 'var(--ink-3)', fontWeight:700}}>
            {cls.absent} absent
          </span>
        )}
      </div>
      {/* progress sliver */}
      <div style={{height:4, background:'var(--paper)', borderRadius:99, overflow:'hidden', marginTop:2}}>
        <div style={{
          height:'100%',
          width: cls.status === 'pending' ? '0%' : `${pct}%`,
          background: cls.status==='done' ? 'var(--green)' : 'var(--purple)',
        }}/>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div style={{
      width:'100%', height:'100%',
      display:'flex',
      background:'var(--cream)',
      fontFamily:'var(--body)', color:'var(--ink)',
      fontSize:14, lineHeight:1.4,
      overflow:'hidden',
    }}>
      <AdminSidebar />
      <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
        {/* Top bar */}
        <div style={{
          padding:'18px 32px', display:'flex', justifyContent:'space-between', alignItems:'center',
          borderBottom:'1px solid var(--line)', background:'var(--white)',
        }}>
          <div>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase'}}>Saturday · May 23, 2026</div>
            <div style={{fontFamily:'var(--display)', fontSize:30, color:'var(--ink)', lineHeight:1.1, marginTop:2}}>
              Today at the studio
            </div>
          </div>
          <div style={{display:'flex', gap:10, alignItems:'center'}}>
            <button style={{
              all:'unset', cursor:'pointer',
              border:'1.5px solid var(--line-strong)', borderRadius:10,
              padding:'8px 14px', fontSize:13, fontWeight:700, color:'var(--ink-2)',
              display:'inline-flex', alignItems:'center', gap:8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="3" width="10" height="9" rx="1" stroke="var(--ink-2)" strokeWidth="1.4" fill="none"/><path d="M2 6h10M5 2v3M9 2v3" stroke="var(--ink-2)" strokeWidth="1.4"/></svg>
              This week
            </button>
            <button style={{
              all:'unset', cursor:'pointer',
              background:'var(--purple)', color:'white',
              borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:700,
              display:'inline-flex', alignItems:'center', gap:8,
              boxShadow:'0 2px 0 var(--purple-deep)',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v8M3 6l4 4 4-4M2 12h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        <div style={{flex:1, overflow:'auto', padding:'24px 32px'}}>
          {/* KPIs */}
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:22}}>
            {[
              { l:'Classes today', v:'7', sub:'3 complete · 1 in progress', accent:'var(--purple)' },
              { l:'Students checked in', v:'46', sub:'of 80 enrolled today', accent:'var(--green-deep)' },
              { l:'Absences today', v:'4', sub:'2 excused · 2 unexcused', accent:'var(--red-deep)' },
              { l:'RFID check-ins', v:'12', sub:'Last 7 days · pilot', accent:'#3a3aa8', isRfid:true },
            ].map((k, i) => (
              <div key={i} style={{
                background:'var(--white)', border:'1px solid var(--line)',
                borderRadius:'var(--r-md)', padding:'14px 18px',
              }}>
                <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', display:'flex', alignItems:'center', gap:6}}>
                  {k.l}{k.isRfid && <RfidBadge/>}
                </div>
                <div style={{fontFamily:'var(--display)', fontSize:38, color:k.accent, lineHeight:1.05, marginTop:6}}>{k.v}</div>
                <div style={{fontSize:12, color:'var(--ink-3)', marginTop:2}}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Class summary cards */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
            <div style={{fontFamily:'var(--display)', fontSize:20, color:'var(--ink)'}}>Today's classes</div>
            <div style={{fontSize:12, color:'var(--ink-3)'}}>Tap a card to view roster</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:10, marginBottom:28}}>
            {ADMIN_CLASSES_TODAY.map((c) => <SummaryCard key={c.name} cls={c} />)}
          </div>

          {/* Recent attendance table */}
          <div style={{
            background:'var(--white)', border:'1px solid var(--line)', borderRadius:'var(--r-md)',
            overflow:'hidden',
          }}>
            <div style={{
              padding:'14px 18px', borderBottom:'1px solid var(--line)',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{fontFamily:'var(--display)', fontSize:20, color:'var(--ink)'}}>Recent attendance</div>
                <div style={{fontSize:12, color:'var(--ink-3)', marginTop:2}}>Last 24 hours · all classes</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <div style={{
                  display:'flex', alignItems:'center', gap:6,
                  border:'1px solid var(--line-strong)', borderRadius:8,
                  padding:'6px 10px', fontSize:13, color:'var(--ink-2)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="5" cy="5" r="3.2" stroke="var(--ink-2)" strokeWidth="1.4" fill="none"/><path d="M7.5 7.5 L10 10" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  Search students…
                </div>
                <button style={{
                  all:'unset', cursor:'pointer',
                  border:'1px solid var(--line-strong)', borderRadius:8,
                  padding:'6px 10px', fontSize:13, color:'var(--ink-2)', fontWeight:700,
                }}>Filter</button>
              </div>
            </div>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'var(--paper)'}}>
                  {['Student', 'Class', 'Date & time', 'Status', 'Marked by'].map((h) => (
                    <th key={h} style={{
                      textAlign:'left', padding:'10px 18px', fontSize:11,
                      color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em',
                      textTransform:'uppercase', borderBottom:'1px solid var(--line)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_ATTENDANCE.map((row, i) => (
                  <tr key={i} style={{borderBottom:'1px solid var(--line)'}}>
                    <td style={{padding:'12px 18px', fontSize:14, fontWeight:700, color:'var(--ink)'}}>{row.student}</td>
                    <td style={{padding:'12px 18px', fontSize:14, color:'var(--ink-2)'}}>{row.cls}</td>
                    <td style={{padding:'12px 18px', fontSize:13, color:'var(--ink-3)', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>{row.date}</td>
                    <td style={{padding:'12px 18px'}}><StatusPill status={row.status}/></td>
                    <td style={{padding:'12px 18px'}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontSize:14, color:'var(--ink-2)'}}>{row.markedBy}</span>
                        {row.method === 'rfid' ? <RfidBadge/> : <ManualBadge/>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{
              padding:'12px 18px', display:'flex', justifyContent:'space-between',
              alignItems:'center', fontSize:13, color:'var(--ink-3)',
              borderTop:'1px solid var(--line)', background:'var(--paper)',
            }}>
              <div>Showing 10 of 248 entries today</div>
              <div style={{display:'flex', gap:6}}>
                <button style={{all:'unset', cursor:'pointer', padding:'4px 10px', border:'1px solid var(--line-strong)', borderRadius:6, fontWeight:700}}>‹</button>
                <button style={{all:'unset', cursor:'pointer', padding:'4px 10px', border:'1px solid var(--line-strong)', borderRadius:6, fontWeight:700}}>›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminDashboard });

// LSODance — Spec card: palette, type, design rationale

function SpecCard() {
  const swatches = [
    { name: 'Primary purple',  hex: '#8F2DB5', sub: 'Brand anchor · CTAs · headings', fg:'#fff' },
    { name: 'Deep purple',     hex: '#6B228A', sub: 'Pressed / active states',        fg:'#fff' },
    { name: 'Purple tint',     hex: '#F0E1F6', sub: 'Card bg · soft surfaces',        fg:'#3D1252' },
    { name: 'Champagne gold',  hex: '#D4A84B', sub: 'Prestige · celebrate · offline', fg:'#fff' },
    { name: 'Gold soft',       hex: '#F3E3B8', sub: 'Late badge · gentle banners',    fg:'#6E521A' },
    { name: 'Studio white',    hex: '#FFFFFF', sub: 'Primary surface',                fg:'#1a1a1a', border:true },
    { name: 'Warm paper',      hex: '#F7F3EE', sub: 'Secondary surface · admin bg',   fg:'#1a1a1a' },
    { name: 'Near black',      hex: '#1A1A1A', sub: 'Body type',                      fg:'#fff' },
    { name: 'Present green',   hex: '#16A34A', sub: 'Status only · do not mix',       fg:'#fff', tag:'SEMANTIC' },
    { name: 'Absent red',      hex: '#DC2626', sub: 'Status only · do not mix',       fg:'#fff', tag:'SEMANTIC' },
  ];

  return (
    <div style={{
      width:'100%', height:'100%',
      background:'var(--white)',
      fontFamily:'var(--body)', color:'var(--ink)',
      padding:'40px 48px',
      overflow:'auto',
      boxSizing:'border-box',
    }}>
      <div style={{maxWidth:1100, margin:'0 auto'}}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:30, borderBottom:'1px solid var(--line)', paddingBottom:18}}>
          <div>
            <div style={{fontSize:13, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase'}}>Design system · v0.1</div>
            <div style={{fontFamily:'var(--display)', fontSize:42, color:'var(--ink)', lineHeight:1.1, marginTop:4}}>
              LSODance Attendance — visual language
            </div>
          </div>
          <Logo size={32} />
        </div>

        {/* Palette */}
        <div style={{fontFamily:'var(--display)', fontSize:24, color:'var(--ink)', marginBottom:14}}>Palette</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12, marginBottom:38}}>
          {swatches.map((s) => (
            <div key={s.hex} style={{
              borderRadius:'var(--r-md)', overflow:'hidden',
              border: s.border ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{
                background: s.hex, color: s.fg,
                padding:'18px 16px', height:120,
                display:'flex', flexDirection:'column', justifyContent:'space-between',
                position:'relative',
              }}>
                {s.tag && (
                  <div style={{
                    position:'absolute', top:10, right:10,
                    fontSize:9, fontWeight:700, letterSpacing:'0.1em',
                    padding:'2px 6px', borderRadius:4,
                    background:'rgba(255,255,255,0.22)',
                    color: s.fg,
                  }}>{s.tag}</div>
                )}
                <div style={{fontFamily:'var(--display)', fontSize:22, lineHeight:1}}>{s.name}</div>
                <div style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:13, opacity:0.9}}>{s.hex}</div>
              </div>
              <div style={{padding:'10px 14px', background:'var(--white)', borderTop: s.border ? 'none' : '1px solid var(--line)'}}>
                <div style={{fontSize:12, color:'var(--ink-2)'}}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <div style={{fontFamily:'var(--display)', fontSize:24, color:'var(--ink)', marginBottom:14}}>Typography — Google Fonts</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:38}}>
          <div style={{border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:24, background:'var(--paper)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
              <div style={{fontSize:12, color:'var(--purple)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase'}}>Display</div>
              <div style={{fontSize:13, color:'var(--ink-3)'}}>Weight 400 · regular + italic</div>
            </div>
            <div style={{fontFamily:'var(--display)', fontSize:56, color:'var(--ink)', lineHeight:1.05}}>
              DM Serif Display
            </div>
            <div style={{fontFamily:'var(--display)', fontSize:22, color:'var(--ink-2)', marginTop:8, fontStyle:'italic'}}>
              Good morning, Mrs. Goodman.
            </div>
            <div style={{fontSize:13, color:'var(--ink-2)', marginTop:14, lineHeight:1.5}}>
              Used for greetings, screen titles, success moments, and class names. High-contrast serif that feels editorial and theatrical — appropriate for a studio that performs at the Detroit Opera House.
            </div>
          </div>
          <div style={{border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:24, background:'var(--white)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6}}>
              <div style={{fontSize:12, color:'var(--purple)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase'}}>Body</div>
              <div style={{fontSize:13, color:'var(--ink-3)'}}>Weights 400 / 700</div>
            </div>
            <div style={{fontFamily:'var(--body)', fontSize:48, color:'var(--ink)', lineHeight:1.05, fontWeight:700}}>
              Atkinson Hyperlegible
            </div>
            <div style={{fontFamily:'var(--body)', fontSize:22, color:'var(--ink-2)', marginTop:8}}>
              Tap a class to take attendance.
            </div>
            <div style={{fontSize:13, color:'var(--ink-2)', marginTop:14, lineHeight:1.5}}>
              Designed by the Braille Institute for maximum character disambiguation. Every screen Mrs. Goodman touches uses this at 18 px or larger.
            </div>
          </div>
        </div>

        {/* Type scale */}
        <div style={{
          border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'18px 24px',
          marginBottom:38, background:'var(--white)',
        }}>
          <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14}}>
            Type scale — iPad screens
          </div>
          <div style={{display:'grid', gridTemplateColumns:'140px 1fr 140px', rowGap:14, alignItems:'baseline'}}>
            {[
              ['Display XL', 'Attendance saved.', '64 / DM Serif'],
              ['Display L',  'Today\'s classes', '42 / DM Serif'],
              ['Title M',    'Hip Hop Intermediate', '30 / DM Serif'],
              ['Body L',     'Tap to confirm', '22 / Atkinson 700'],
              ['Body',       'Ms. Janelle Brooks · 16 students', '18 / Atkinson 400'],
              ['Caption',    'SUBMITTED AT 9:48 AM', '14 / Atkinson 700, +6% tracking'],
            ].map(([lbl, ex, spec], i) => (
              <React.Fragment key={i}>
                <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase'}}>{lbl}</div>
                <div style={{
                  fontSize: spec.includes('64')?38: spec.includes('42')?28: spec.includes('30')?22: spec.includes('22')?18: spec.includes('18')?16: 13,
                  fontFamily: spec.includes('DM Serif') ? 'var(--display)' : 'var(--body)',
                  fontWeight: spec.includes('700') ? 700 : 400,
                  color:'var(--ink)',
                  letterSpacing: spec.includes('tracking') ? '0.06em' : 'normal',
                  textTransform: spec.includes('tracking') ? 'uppercase' : 'none',
                }}>{ex}</div>
                <div style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, color:'var(--ink-3)', textAlign:'right'}}>{spec}</div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Component samples */}
        <div style={{fontFamily:'var(--display)', fontSize:24, color:'var(--ink)', marginBottom:14}}>Components</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18, marginBottom:38}}>
          <div style={{border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:22, background:'var(--paper)'}}>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14}}>Buttons</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              <button style={{all:'unset', cursor:'pointer', background:'var(--purple)', color:'white', padding:'14px 22px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:16, textAlign:'center', boxShadow:'0 2px 0 var(--purple-deep)'}}>Submit attendance</button>
              <button style={{all:'unset', cursor:'pointer', background:'white', color:'var(--purple)', border:'2px solid var(--purple)', padding:'12px 22px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:16, textAlign:'center'}}>Go back</button>
              <button style={{all:'unset', cursor:'pointer', background:'var(--purple-tint)', color:'var(--purple)', padding:'14px 22px', borderRadius:'var(--r-md)', fontWeight:700, fontSize:16, textAlign:'center'}}>Tertiary action</button>
            </div>
          </div>
          <div style={{border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:22, background:'var(--paper)'}}>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14}}>Status pills</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
              <StatusPill status="present"/>
              <StatusPill status="absent"/>
              <StatusPill status="late"/>
              <StatusPill status="excused"/>
            </div>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginTop:18, marginBottom:10}}>Source badges</div>
            <div style={{display:'flex', gap:8}}>
              <RfidBadge/>
              <ManualBadge/>
            </div>
          </div>
          <div style={{border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:22, background:'var(--paper)'}}>
            <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:14}}>Toggle states</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <div style={{background:'var(--green)', color:'white', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, fontWeight:700}}>
                <span style={{width:24, height:24, borderRadius:'50%', background:'rgba(255,255,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900}}>✓</span>
                Present
              </div>
              <div style={{background:'var(--red)', color:'white', borderRadius:10, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, fontWeight:700}}>
                <span style={{width:24, height:24, borderRadius:'50%', background:'rgba(255,255,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900}}>✕</span>
                Absent
              </div>
            </div>
          </div>
        </div>

        {/* Rationale */}
        <div style={{fontFamily:'var(--display)', fontSize:24, color:'var(--ink)', marginBottom:14}}>Design rationale</div>
        <div style={{
          border:'1.5px solid var(--purple)', borderRadius:'var(--r-md)',
          padding:'24px 28px', background:'var(--purple-tint)',
          color:'var(--purple-ink)', fontSize:17, lineHeight:1.55,
        }}>
          LaShelle's has been performing on Detroit's biggest stages for 22 years — at the Opera House, in the Thanksgiving Day Parade — so the system leans into that prestige instead of hiding it. The deep purple anchor is the brand; champagne gold appears sparingly, only at celebratory or reassuring moments (a saved-attendance sparkle, the "we'll sync later" offline banner) so it stays meaningful when it does. <strong>DM Serif Display</strong> brings the editorial confidence of a printed program; <strong>Atkinson Hyperlegible</strong> — designed by the Braille Institute — guarantees Mrs. Goodman can read every name and every count at arm's length without squinting, and the 56 px minimum tap target plus default-present roster means a full class can be marked correct with two taps and a submit. Present-green and absent-red stay vivid and unstyled because they're the only colors in the system carrying a status meaning, and they need to read across the room.
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { SpecCard });

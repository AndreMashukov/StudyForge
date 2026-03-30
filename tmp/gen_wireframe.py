import os

os.makedirs('/a0/usr/workdir/code-insights-ai/tmp', exist_ok=True)

# Use HTML entities for special chars to avoid encoding issues
html = []
h = html.append

h('<!DOCTYPE html>')
h('<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">')
h('<title>Rule Editor Page - Wireframes</title>')
h('<style>')
h('''  :root {
    --bg-primary: #0a0a0f; --bg-secondary: #12121a; --bg-tertiary: #1a1a2e;
    --bg-card: #16162a; --bg-input: #1e1e35; --border: #2a2a4a;
    --text-primary: #e2e8f0; --text-secondary: #94a3b8; --text-muted: #64748b;
    --accent: #6366f1; --accent-hover: #818cf8; --accent-bg: rgba(99,102,241,0.1);
    --success: #22c55e; --success-bg: rgba(34,197,94,0.1);
    --warning: #f59e0b; --warning-bg: rgba(245,158,11,0.1);
    --danger: #ef4444; --danger-bg: rgba(239,68,68,0.1);
    --purple: #a855f7; --purple-bg: rgba(168,85,247,0.1);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg-primary); color: var(--text-primary); font-family: Inter, -apple-system, sans-serif; }
  .wc { max-width: 1440px; margin: 0 auto; padding: 32px; }
  .wt { font-size: 14px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
  .ws { font-size: 24px; font-weight: 700; margin-bottom: 32px; }
  .tabs { display: flex; gap: 4px; margin-bottom: 32px; background: var(--bg-secondary); border-radius: 12px; padding: 4px; width: fit-content; }
  .tab { padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-secondary); border: none; background: transparent; }
  .tab.active { background: var(--accent); color: white; }
  .tab:hover:not(.active) { color: var(--text-primary); background: var(--bg-tertiary); }
  .view { display: none; } .view.active { display: block; }
  .pf { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  .tb { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--border); }
  .tbl { display: flex; align-items: center; gap: 16px; }
  .bb { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 14px; cursor: pointer; background: none; border: none; padding: 6px 10px; border-radius: 6px; }
  .bb:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .bbsvg { width: 16px; height: 16px; }
  .tbt { font-size: 16px; font-weight: 600; }
  .tbadge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; }
  .tbc { background: var(--accent-bg); color: var(--accent); }
  .tbe { background: var(--warning-bg); color: var(--warning); }
  .tba { display: flex; gap: 8px; }
  .btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; gap: 6px; }
  .bp { background: var(--accent); color: white; border-color: var(--accent); }
  .bp:hover { background: var(--accent-hover); }
  .bp:disabled, .bo:disabled { opacity: 0.4; cursor: not-allowed; }
  .bo { background: transparent; color: var(--text-secondary); border-color: var(--border); }
  .bo:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .bd { background: transparent; color: var(--danger); border-color: var(--danger); }
  .bd:hover { background: var(--danger-bg); }
  .btn svg, .bbsvg { width: 15px; height: 15px; }
  .blg { padding: 12px 24px; font-size: 14px; border-radius: 10px; }
  .sl { display: grid; grid-template-columns: 1fr 420px; min-height: 600px; }
  .lp { padding: 28px; overflow-y: auto; border-right: 1px solid var(--border); }
  .ph { margin-bottom: 24px; }
  .pl { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 4px; }
  .pt { font-size: 18px; font-weight: 700; }
  .fg { margin-bottom: 20px; }
  .fl { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
  .fr { color: var(--danger); margin-left: 2px; }
  .fh { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
  .fi { width: 100%; padding: 10px 14px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 0.15s; font-family: inherit; }
  .fi:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
  .fi::placeholder { color: var(--text-muted); }
  .fta { min-height: 220px; resize: vertical; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; }
  .frow { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cg { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text-secondary); }
  .chip:hover { border-color: var(--text-muted); color: var(--text-primary); }
  .chip.sel { background: var(--accent); color: white; border-color: var(--accent); }
  .colg { display: flex; flex-wrap: wrap; gap: 8px; }
  .colo { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; border: 2px solid var(--border); cursor: pointer; background: transparent; }
  .colo:hover { border-color: var(--text-muted); }
  .colo.sel { border-color: var(--accent); background: var(--accent-bg); }
  .cold { width: 14px; height: 14px; border-radius: 50%; }
  .coll { font-size: 12px; color: var(--text-secondary); }
  .colo.sel .coll { color: var(--text-primary); }
  .tc { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text-secondary); }
  .trx { cursor: pointer; color: var(--text-muted); font-size: 14px; }
  .trx:hover { color: var(--danger); }
  .cbr { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--bg-tertiary); border-radius: 8px; border: 1px solid var(--border); }
  .cbx { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
  .cbl { font-size: 13px; color: var(--text-secondary); cursor: pointer; }
  .cc { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
  .cct { font-size: 12px; color: var(--text-muted); }
  .pv { font-size: 12px; color: var(--accent); cursor: pointer; background: none; border: none; }
  .pv:hover { text-decoration: underline; }
  .rp { display: flex; flex-direction: column; background: var(--bg-tertiary); }
  .rph { padding: 20px 24px; border-bottom: 1px solid var(--border); }
  .rpb { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 20px; }
  .aib { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .aibi { background: var(--purple-bg); color: var(--purple); }
  .aibw { background: var(--accent-bg); color: var(--accent); }
  .aibd { background: var(--success-bg); color: var(--success); }
  .aid { width: 6px; height: 6px; border-radius: 50%; }
  .aidi { background: var(--purple); }
  .aidw { background: var(--accent); animation: pulse 1.5s infinite; }
  .aidd { background: var(--success); }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
  .rs { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
  .rsh { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rsd { width: 10px; height: 10px; border-radius: 50%; }
  .rsn { font-size: 15px; font-weight: 600; }
  .rsdesc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px; }
  .rsm { display: flex; flex-wrap: wrap; gap: 8px; }
  .rsmc { font-size: 11px; padding: 3px 10px; border-radius: 12px; background: var(--bg-tertiary); color: var(--text-muted); border: 1px solid var(--border); }
  .rsdv { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
  .rssl { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 8px; }
  .rscp { font-size: 12px; color: var(--text-secondary); line-height: 1.6; background: var(--bg-input); border-radius: 8px; padding: 12px; max-height: 120px; overflow-y: auto; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; }
  .aps { flex: 1; display: flex; flex-direction: column; }
  .aplb { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
  .aplb svg { width: 14px; height: 14px; color: var(--purple); }
  .apta { flex: 1; min-height: 140px; padding: 14px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); font-size: 13px; line-height: 1.6; resize: none; outline: none; font-family: inherit; }
  .apta:focus { border-color: var(--purple); box-shadow: 0 0 0 3px var(--purple-bg); }
  .apta::placeholder { color: var(--text-muted); }
  .apac { display: flex; gap: 8px; margin-top: 12px; }
  .bai { background: linear-gradient(135deg, var(--purple), var(--accent)); color: white; border: none; }
  .bai:hover { opacity: 0.9; }
  .bais { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger); }
  .aisug { margin-top: 8px; }
  .aisl { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 8px; }
  .aisi { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; margin-bottom: 6px; }
  .aisi:hover { border-color: var(--accent); background: var(--accent-bg); }
  .aisic { color: var(--accent); font-size: 14px; margin-top: 1px; flex-shrink: 0; }
  .aisit { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
  .aisit strong { color: var(--text-primary); font-weight: 500; }
  .air { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  .airh { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .airl { font-size: 12px; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
  .airc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }
  .airc .hl { color: var(--accent); font-weight: 500; }
  .shimmer { background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-input) 50%, var(--bg-tertiary) 75%); background-size: 200% 100%; animation: shim 1.5s infinite; border-radius: 6px; }
  @keyframes shim { 0%{background-position:200% 0}100%{background-position:-200% 0} }
  .shl { height: 12px; margin-bottom: 8px; }
  .es { display: flex; flex-direction: column; align-items: center; padding: 40px 24px; text-align: center; }
  .esi { width: 48px; height: 48px; border-radius: 12px; background: var(--accent-bg); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 22px; }
  .est { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
  .esd { font-size: 12px; color: var(--text-muted); line-height: 1.5; max-width: 280px; }
  .di { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
  .dia { background: var(--success-bg); color: var(--success); }
  .dim { background: var(--warning-bg); color: var(--warning); }
  .fb { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg-secondary); }
  .fbl { display: flex; align-items: center; gap: 12px; }
  .fbh { font-size: 12px; color: var(--text-muted); }
  .fbr { display: flex; gap: 8px; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  .arrow-left { display: inline-block; width: 16px; height: 16px; }
''')
h('</style></head><body>')
h('<div class="wc">')
h('  <div class="wt">Wireframes</div>')
h('  <div class="ws">Rule Editor Page &mdash; AI-Assisted Create &amp; Edit</div>')
h('  <div class="tabs">')
h('    <button class="tab active" onclick="showView(&#39;create&#39;,this)">Create Mode</button>')
h('    <button class="tab" onclick="showView(&#39;edit&#39;,this)">Edit Mode</button>')
h('    <button class="tab" onclick="showView(&#39;loading&#39;,this)">Edit &mdash; AI Working</button>')
h('    <button class="tab" onclick="showView(&#39;done&#39;,this)">Edit &mdash; AI Done</button>')
h('  </div>')

# SVG arrow left
ARROW = '<svg class="bbsvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>'
STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>'
INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>'
TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'
CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>'
STOP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'

# ============ CREATE MODE ============
h('  <div id="view-create" class="view active">')
h('    <div class="pf">')
h('      <div class="tb"><div class="tbl">')
h(f'        <button class="bb">{ARROW}Rules</button>')
h('        <div class="tbt">Create New Rule</div>')
h('        <span class="tbadge tbc">New</span>')
h('      </div><div class="tba">')
h('        <button class="btn bo">Discard</button>')
h(f'        <button class="btn bp" disabled>{ARROW.replace("bbsvg","bbsvg")}Save Rule</button>')
h('      </div></div>')

h('      <div class="sl"><div class="lp">')
h('        <div class="ph"><div class="pl">Configuration</div><div class="pt">Rule Details</div></div>')
h('        <div class="fg"><label class="fl">Rule Name <span class="fr">*</span></label><input class="fi" placeholder="e.g. DSA Code Examples" /></div>')
h('        <div class="fg"><label class="fl">Description</label><input class="fi" placeholder="Brief description of what this rule does" /><div class="fh">Optional &mdash; helps identify the rule in lists</div></div>')
h('        <div class="fg"><label class="fl">Applies To <span class="fr">*</span></label><div class="fh" style="margin-top:0;margin-bottom:8px;">Select at least one operation type</div><div class="cg">')
for op in ['Scraping','Upload','Prompt','Quiz','Flashcard','Slide Deck','Follow-up']:
    sel = ' sel' if op in ['Quiz','Flashcard','Slide Deck'] else ''
    check = '\u2713 ' if sel else ''
    h(f'          <span class="chip{sel}">{check}{op}</span>')
h('        </div></div>')

h('        <div class="frow"><div class="fg"><label class="fl">Color</label><div class="colg">')
colors = [('Red','#ef4444'),('Orange','#f97316'),('Yellow','#eab308'),('Green','#22c55e'),('Blue','#3b82f6'),('Indigo','#6366f1')]
for i,(name,c) in enumerate(colors):
    sel = ' sel' if name=='Blue' else ''
    h(f'          <div class="colo{sel}"><div class="cold" style="background:{c}"></div><span class="coll">{name}</span></div>')
h('        </div></div>')
h('        <div class="fg"><label class="fl">Tags <span style="font-weight:400;color:var(--text-muted)">(Enter to add)</span></label>')
h('          <div class="tc"><span class="tag">dsa <span class="trx">&times;</span></span><span class="tag">code <span class="trx">&times;</span></span></div>')
h('          <input class="fi" placeholder="Add a tag..." style="font-size:12px;" />')
h('        </div></div>')

h('        <div class="fg"><div style="display:flex;align-items:center;justify-content:space-between;"><label class="fl" style="margin-bottom:0;">Rule Content <span class="fr">*</span></label><button class="pv">Preview</button></div>')
h('          <div class="fh" style="margin-top:4px;margin-bottom:8px;">Markdown supported &mdash; this is what gets sent to the AI</div>')
h('          <textarea class="fi fta" placeholder="When generating quiz, flashcard, or slide deck content:\n\n- Include Python and Java code implementations\n- Add time/space complexity analysis\n- Provide step-by-step walkthroughs\n- Focus on edge cases and common pitfalls"></textarea>')
h('          <div class="cc"><span class="cct">0 / 15,000 characters</span></div>')
h('        </div>')
h('        <div class="cbr"><input type="checkbox" class="cbx" /><label class="cbl">Set as default rule (auto-select for applicable operations)</label></div>')
h('      </div>')

# Right panel - Create
h('      <div class="rp"><div class="rph"><div style="display:flex;align-items:center;justify-content:space-between;"><div>')
h('          <div class="pl" style="margin-bottom:2px;">AI Assistant</div>')
h('          <div style="font-size:15px;font-weight:600;">Generate with AI</div>')
h('        </div><span class="aib aibi"><span class="aid aidi"></span>Ready</span></div></div>')
h('      <div class="rpb">')
h('        <div class="es"><div class="esi">&#10024;</div><div class="est">Describe your rule</div><div class="esd">Tell the AI what kind of rule you need. It will generate the name, description, content, and suggest applicable operations.</div></div>')
h('        <div class="aps">')
h(f'          <div class="aplb">{INFO} Your Prompt</div>')
h('          <textarea class="apta" placeholder="Create a rule for generating DSA quiz questions that include code snippets in Python and Java, with complexity analysis and edge cases..."></textarea>')
h('          <div class="apac">')
h(f'            <button class="btn bai blg" style="flex:1;justify-content:center;">{STAR} Generate Rule</button>')
h('          </div></div>')
h('        <div class="aisug"><div class="aisl">Quick Suggestions</div>')
suggestions = [
    ('Quiz-focused rule', 'Generate multiple-choice questions with 4 options, explanations, and difficulty levels'),
    ('Flashcard rule', 'Create concise front/back cards with mnemonics for memorization'),
    ('Slide deck rule', 'Structure content into slides with titles, bullet points, and speaker notes'),
    ('Code examples rule', 'Include implementations in multiple languages with comments'),
]
for title, desc in suggestions:
    h(f'          <div class="aisi"><span class="aisic">&#128161;</span><span class="aisit"><strong>{title}</strong> &mdash; {desc}</span></div>')
h('        </div></div></div></div>')

h('      <div class="fb"><div class="fbl"><span class="fbh">&#128161; Tip: Use the AI assistant to generate a rule, then fine-tune it on the left</span></div><div class="fbr">')
h('        <button class="btn bo">Cancel</button><button class="btn bp" disabled>Save Rule</button>')
h('      </div></div></div></div>')

# ============ EDIT MODE ============
h('  <div id="view-edit" class="view"><div class="pf">')
h('      <div class="tb"><div class="tbl">')
h(f'        <button class="bb">{ARROW}Rules</button>')
h('        <div class="tbt">Edit Rule</div><span class="tbadge tbe">Editing</span>')
h('      </div><div class="tba">')
h(f'        <button class="btn bd">{TRASH}Delete</button>')
h('        <button class="btn bo">Discard</button>')
h(f'        <button class="btn bp">{SAVE}Save Changes</button>')
h('      </div></div>')

h('      <div class="sl"><div class="lp">')
h('        <div class="ph"><div class="pl">Configuration</div><div class="pt">Rule Details</div></div>')
h('        <div class="fg"><label class="fl">Rule Name <span class="fr">*</span></label><input class="fi" value="DSA Code Examples" /></div>')
h('        <div class="fg"><label class="fl">Description</label><input class="fi" value="Adds comprehensive code examples for DSA problems" /></div>')
h('        <div class="fg"><label class="fl">Applies To <span class="fr">*</span></label><div class="cg">')
for op in ['Scraping','Upload','Prompt','Quiz','Flashcard','Slide Deck','Follow-up']:
    sel = ' sel' if op in ['Quiz','Flashcard','Slide Deck'] else ''
    check = '\u2713 ' if sel else ''
    h(f'          <span class="chip{sel}">{check}{op}</span>')
h('        </div></div>')
h('        <div class="frow"><div class="fg"><label class="fl">Color</label><div class="colg">')
for name,c in colors:
    sel = ' sel' if name=='Blue' else ''
    h(f'          <div class="colo{sel}"><div class="cold" style="background:{c}"></div><span class="coll">{name}</span></div>')
h('        </div></div>')
h('        <div class="fg"><label class="fl">Tags</label><div class="tc">')
for t in ['dsa','code','algorithms']:
    h(f'          <span class="tag">{t} <span class="trx">&times;</span></span>')
h('        </div><input class="fi" placeholder="Add a tag..." style="font-size:12px;" /></div></div>')

h('        <div class="fg"><div style="display:flex;align-items:center;justify-content:space-between;"><label class="fl" style="margin-bottom:0;">Rule Content <span class="fr">*</span></label><button class="pv">Preview</button></div>')
content = 'When generating quiz, flashcard, or slide deck content about DSA topics:\n\n- Include Python and Java code implementations\n- Add time/space complexity analysis (Big-O notation)\n- Provide step-by-step walkthroughs of the algorithm\n- Focus on edge cases and common pitfalls\n- Use clear variable names with explanatory comments\n- Include at least one example with sample input/output'
h(f'          <textarea class="fi fta" style="margin-top:8px;">{content}</textarea>')
h('          <div class="cc"><span class="cct">312 / 15,000 characters</span></div></div>')
h('        <div class="cbr"><input type="checkbox" class="cbx" checked /><label class="cbl">Set as default rule (auto-select for applicable operations)</label></div>')
h('      </div>')

# Right panel - Edit
h('      <div class="rp"><div class="rph"><div style="display:flex;align-items:center;justify-content:space-between;"><div>')
h('          <div class="pl" style="margin-bottom:2px;">AI Assistant</div>')
h('          <div style="font-size:15px;font-weight:600;">Modify with AI</div>')
h('        </div><span class="aib aibi"><span class="aid aidi"></span>Ready</span></div></div>')
h('      <div class="rpb">')

# Rule summary
h('        <div class="rs"><div class="rsh"><div class="rsd" style="background:#3b82f6;"></div><div class="rsn">DSA Code Examples</div></div>')
h('          <div class="rsdesc">Adds comprehensive code examples for DSA problems. Currently applies to Quiz, Flashcard, and Slide Deck operations.</div>')
h('          <div class="rsm"><span class="rsmc">Quiz</span><span class="rsmc">Flashcard</span><span class="rsmc">Slide Deck</span><span class="rsmc">Default</span></div>')
h('          <hr class="rsdv" /><div class="rssl">Current Content Preview</div>')
h(f'          <div class="rscp">{content[:80]}...</div>')
h('        </div>')

h('        <div class="aps">')
h(f'          <div class="aplb">{EDIT} Describe Changes</div>')
h('          <textarea class="apta" placeholder="e.g. Also add TypeScript examples, and include a section on common interview variations..."></textarea>')
h('          <div class="apac">')
h(f'            <button class="btn bai blg" style="flex:1;justify-content:center;">{STAR} Apply Changes</button>')
h('          </div></div>')

h('        <div class="aisug"><div class="aisl">Suggested Modifications</div>')
edit_suggestions = [
    ('Add TypeScript', 'Include TypeScript alongside Python and Java implementations'),
    ('Expand scope', 'Also apply this rule to Follow-up questions'),
    ('Simplify', 'Remove complexity analysis, focus only on code examples'),
]
icons = ['&#128260;','&#10133;','&#9986;']
for (title, desc), icon in zip(edit_suggestions, icons):
    h(f'          <div class="aisi"><span class="aisic">{icon}</span><span class="aisit"><strong>{title}</strong> &mdash; {desc}</span></div>')
h('        </div></div></div></div>')

h('      <div class="fb"><div class="fbl"><span class="fbh">Last edited 2 hours ago &middot; Created Mar 15, 2026</span></div><div class="fbr">')
h('        <button class="btn bo">Cancel</button><button class="btn bp">Save Changes</button>')
h('      </div></div></div></div>')

# ============ LOADING MODE ============
h('  <div id="view-loading" class="view"><div class="pf">')
h('      <div class="tb"><div class="tbl">')
h(f'        <button class="bb">{ARROW}Rules</button>')
h('        <div class="tbt">Edit Rule</div><span class="tbadge tbe">Editing</span>')
h('      </div><div class="tba">')
h('        <button class="btn bo" disabled>Discard</button>')
h(f'        <button class="btn bp" disabled>{SAVE}Save Changes</button>')
h('      </div></div>')

h('      <div class="sl"><div class="lp" style="opacity:0.5;pointer-events:none;">')
h('        <div class="ph"><div class="pl">Configuration</div><div class="pt">Rule Details</div></div>')
h('        <div class="fg"><label class="fl">Rule Name <span class="fr">*</span></label><input class="fi" value="DSA Code Examples" /></div>')
h('        <div class="fg"><label class="fl">Description</label><input class="fi" value="Adds comprehensive code examples for DSA problems" /></div>')
h('        <div class="fg"><label class="fl">Applies To <span class="fr">*</span></label><div class="cg">')
for op in ['Scraping','Upload','Prompt','Quiz','Flashcard','Slide Deck','Follow-up']:
    sel = ' sel' if op in ['Quiz','Flashcard','Slide Deck'] else ''
    check = '\u2713 ' if sel else ''
    h(f'          <span class="chip{sel}">{check}{op}</span>')
h('        </div></div>')
h(f'        <div class="fg"><div style="display:flex;align-items:center;justify-content:space-between;"><label class="fl" style="margin-bottom:0;">Rule Content <span class="fr">*</span></label><button class="pv">Preview</button></div>')
h(f'          <textarea class="fi fta" style="margin-top:8px;">{content}</textarea>')
h('          <div class="cc"><span class="cct">312 / 15,000 characters</span></div></div>')
h('      </div>')

# Right panel - Loading
h('      <div class="rp"><div class="rph"><div style="display:flex;align-items:center;justify-content:space-between;"><div>')
h('          <div class="pl" style="margin-bottom:2px;">AI Assistant</div>')
h('          <div style="font-size:15px;font-weight:600;">Modifying Rule...</div>')
h('        </div><span class="aib aibw"><span class="aid aidw"></span>Working</span></div></div>')
h('      <div class="rpb">')
h('        <div class="rs"><div class="rsh"><div class="rsd" style="background:#3b82f6;"></div><div class="rsn">DSA Code Examples</div></div>')
h('          <div class="rsdesc">Adds comprehensive code examples for DSA problems.</div>')
h('          <div class="rsm"><span class="rsmc">Quiz</span><span class="rsmc">Flashcard</span><span class="rsmc">Slide Deck</span></div>')
h('        </div>')

h('        <div class="aps">')
h(f'          <div class="aplb">{EDIT} Your Request</div>')
h('          <div style="padding:14px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;font-size:13px;color:var(--text-secondary);line-height:1.6;">Also add TypeScript examples alongside Python and Java, and include a section on common interview variations for each algorithm</div>')
h('          <div class="apac">')
h(f'            <button class="btn bais blg" style="flex:1;justify-content:center;">{STOP} Stop Generation</button>')
h('          </div></div>')

h('        <div class="air"><div class="airh"><span class="airl">{STAR} AI Response</span></div>')
h('          <div class="airc">')
for w in [100,90,95,70,85,60]:
    h(f'            <div class="shimmer shl" style="width:{w}%"></div>')
h('          </div></div>')
h('      </div></div></div>')

h('      <div class="fb"><div class="fbl"><span class="fbh" style="color:var(--accent);">&#9203; AI is modifying the rule &mdash; form will update automatically</span></div><div class="fbr">')
h('        <button class="btn bo" disabled>Cancel</button><button class="btn bp" disabled>Save Changes</button>')
h('      </div></div></div></div>')

# ============ DONE MODE ============
h('  <div id="view-done" class="view"><div class="pf">')
h('      <div class="tb"><div class="tbl">')
h(f'        <button class="bb">{ARROW}Rules</button>')
h('        <div class="tbt">Edit Rule</div><span class="tbadge tbe">Editing</span>')
h('      </div><div class="tba">')
h(f'        <button class="btn bd">{TRASH}Delete</button>')
h('        <button class="btn bo">Discard</button>')
h(f'        <button class="btn bp">{SAVE}Save Changes</button>')
h('      </div></div>')

h('      <div class="sl"><div class="lp">')
h('        <div class="ph" style="display:flex;align-items:center;justify-content:space-between;"><div>')
h('          <div class="pl">Configuration</div><div class="pt">Rule Details</div>')
h('        </div><div style="display:flex;gap:6px;">')
h('          <span class="di dia">+ 2 fields added</span>')
h('          <span class="di dim">~ 1 field modified</span>')
h('        </div></div>')

h('        <div class="fg"><label class="fl">Rule Name <span class="fr">*</span></label><input class="fi" value="DSA Code Examples" style="border-color:transparent;" /></div>')
h('        <div class="fg"><label class="fl">Description</label><input class="fi" value="Comprehensive DSA code examples with multi-language support and interview variations" style="border-color:var(--success);background:var(--success-bg);" />')
h('          <span class="di dim" style="margin-top:4px;">~ Modified</span></div>')

h('        <div class="fg"><label class="fl">Applies To <span class="fr">*</span></label><div class="cg">')
for op in ['Scraping','Upload','Prompt','Quiz','Flashcard','Slide Deck','Follow-up']:
    sel = ' sel' if op in ['Quiz','Flashcard','Slide Deck','Follow-up'] else ''
    check = '\u2713 ' if sel else ''
    extra = ' style="box-shadow:0 0 0 2px var(--success);"' if op=='Follow-up' else ''
    added = ' <span class="di dia" style="margin-left:4px;">+ Added</span>' if op=='Follow-up' else ''
    h(f'          <span class="chip{sel}"{extra}>{check}{op}{added}</span>')
h('        </div></div>')

h('        <div class="frow"><div class="fg"><label class="fl">Color</label><div class="colg">')
for name,c in colors:
    sel = ' sel' if name=='Blue' else ''
    h(f'          <div class="colo{sel}"><div class="cold" style="background:{c}"></div><span class="coll">{name}</span></div>')
h('        </div></div>')
h('        <div class="fg"><label class="fl">Tags</label><div class="tc">')
for t in ['dsa','code','algorithms']:
    h(f'          <span class="tag">{t} <span class="trx">&times;</span></span>')
h(f'          <span class="tag" style="border-color:var(--success);background:var(--success-bg);">typescript <span class="trx">&times;</span> <span class="di dia" style="font-size:9px;padding:1px 5px;">+</span></span>')
h(f'          <span class="tag" style="border-color:var(--success);background:var(--success-bg);">interview <span class="trx">&times;</span> <span class="di dia" style="font-size:9px;padding:1px 5px;">+</span></span>')
h('        </div><input class="fi" placeholder="Add a tag..." style="font-size:12px;" /></div></div>')

new_content = 'When generating quiz, flashcard, slide deck, or follow-up content about DSA topics:\n\n- Include Python, Java, and TypeScript code implementations\n- Add time/space complexity analysis (Big-O notation)\n- Provide step-by-step walkthroughs of the algorithm\n- Focus on edge cases and common pitfalls\n- Use clear variable names with explanatory comments\n- Include at least one example with sample input/output\n\n## Interview Variations\n- For each algorithm, include common interview variants\n- Add follow-up questions that interviewers commonly ask\n- Note optimal vs. brute-force approaches for comparison'
h(f'        <div class="fg"><div style="display:flex;align-items:center;justify-content:space-between;"><label class="fl" style="margin-bottom:0;">Rule Content <span class="fr">*</span></label><button class="pv">Preview</button></div>')
h(f'          <textarea class="fi fta" style="margin-top:8px;border-color:var(--success);background:var(--success-bg);">{new_content}</textarea>')
h('          <div class="cc"><span class="cct" style="color:var(--success);">524 / 15,000 characters (+212)</span></div></div>')
h('        <div class="cbr"><input type="checkbox" class="cbx" checked /><label class="cbl">Set as default rule (auto-select for applicable operations)</label></div>')
h('      </div>')

# Right panel - Done
h('      <div class="rp"><div class="rph"><div style="display:flex;align-items:center;justify-content:space-between;"><div>')
h('          <div class="pl" style="margin-bottom:2px;">AI Assistant</div>')
h('          <div style="font-size:15px;font-weight:600;">Changes Applied</div>')
h('        </div><span class="aib aibd"><span class="aid aidd"></span>Complete</span></div></div>')
h('      <div class="rpb">')

h('        <div class="rs"><div class="rsh"><div class="rsd" style="background:#3b82f6;"></div><div class="rsn">DSA Code Examples</div></div>')
h('          <div class="rsdesc">Comprehensive DSA code examples with multi-language support and interview variations</div>')
h('          <div class="rsm"><span class="rsmc">Quiz</span><span class="rsmc">Flashcard</span><span class="rsmc">Slide Deck</span>')
h('          <span class="rsmc" style="border-color:var(--success);color:var(--success);background:var(--success-bg);">+ Follow-up</span><span class="rsmc">Default</span></div>')
h('        </div>')

h('        <div class="air"><div class="airh"><span class="airl">{CHECK} Summary of Changes</span></div>')
h('          <div class="airc">')
h('            <div style="margin-bottom:10px;">I\'ve updated the rule with the following changes:</div>')
changes = [
    ('dim', '~', 'Updated <span class="hl">description</span> to reflect multi-language support'),
    ('dia', '+', 'Added <span class="hl">TypeScript</span> to code implementation requirements'),
    ('dia', '+', 'Added new <span class="hl">Interview Variations</span> section to rule content'),
    ('dia', '+', 'Added <span class="hl">Follow-up</span> to applicable operations'),
    ('dia', '+', 'Added tags: <span class="hl">typescript, interview</span>'),
]
for cls, sym, text in changes:
    h(f'            <div style="margin-bottom:6px;"><span class="di {cls}" style="margin-right:6px;">{sym}</span>{text}</div>')
h('          </div></div>')

h('        <div style="display:flex;flex-direction:column;gap:8px;margin-top:auto;">')
h(f'          <button class="btn bai blg" style="width:100%;justify-content:center;">{EDIT} Make More Changes</button>')
h(f'          <button class="btn bo blg" style="width:100%;justify-content:center;">{UNDO} Undo AI Changes</button>')
h('        </div>')
h('      </div></div></div>')

h('      <div class="fb"><div class="fbl"><span class="fbh" style="color:var(--success);">&#9989; AI changes applied &mdash; review the highlighted fields and save</span></div><div class="fbr">')
h('        <button class="btn bo">Cancel</button><button class="btn bp">Save Changes</button>')
h('      </div></div></div></div>')

h('</div>')
h('<script>function showView(id,el){document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));document.getElementById("view-"+id).classList.add("active");el.classList.add("active");}</script>')
h('</body></html>')

with open('/a0/usr/workdir/code-insights-ai/tmp/rule-editor-wireframe.html', 'w', encoding='utf-8') as f:
    f.write('\n'.join(html))

print('Wireframe HTML generated successfully!')
print(f'File size: {os.path.getsize("/a0/usr/workdir/code-insights-ai/tmp/rule-editor-wireframe.html")} bytes')

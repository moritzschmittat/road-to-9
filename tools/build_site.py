"""Build the public website around the app: home, subjects, one page per subject, parents, 404,
robots.txt and sitemap.xml. Run by tools/build.py (or on its own: python3 tools/build_site.py).

Spec points are the exam boards' wording, so the public pages list topic names and counts only,
never the spec text itself (that stays inside the app).
"""
import datetime
import html
import json
import pathlib

root = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://roadto9.com'
cur = json.loads((root / 'data' / 'curriculum.json').read_text(encoding='utf-8'))
TODAY = datetime.date.today().isoformat()
e = lambda s: html.escape(str(s), quote=True)

MARK = ('<svg viewBox="50 -55 730 730" aria-hidden="true"><g stroke-linejoin="round" stroke-width="14">'
        '<path d="M333,270 L410,163 L655,163 Q765,163 765,255 Q765,285 742,313 L527,525 Q497,555 460,555 L232,555 L310,470 L460,470 L640,270 Z" fill="#1f5a96" stroke="#1f5a96" transform="rotate(180 413 305)"/>'
        '<path d="M333,270 L410,163 L655,163 Q765,163 765,255 Q765,285 742,313 L527,525 Q497,555 460,555 L232,555 L310,470 L460,470 L640,270 Z" fill="#a8ea2c" stroke="#a8ea2c"/></g></svg>')

# Full qualification names, URL slugs and the official past-paper pages (same as the app).
QUAL = {
    'bio':     ('Edexcel International GCSE Biology', '4BI1', 'edexcel-igcse-biology', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-biology-2017.coursematerials.html'),
    'chem':    ('Edexcel International GCSE Chemistry', '4CH1', 'edexcel-igcse-chemistry', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-chemistry-2017.coursematerials.html'),
    'phys':    ('OCR GCSE Physics B (Twenty First Century Science)', 'J259', 'ocr-gcse-physics-b', 'https://www.ocr.org.uk/qualifications/past-paper-finder/'),
    'maths':   ('Edexcel International GCSE Mathematics A', '4MA1', 'edexcel-igcse-maths', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-mathematics-a-2016.coursematerials.html'),
    'fm':      ('AQA Level 2 Certificate in Further Mathematics', '8365', 'aqa-level-2-further-maths', 'https://www.aqa.org.uk/subjects/mathematics/level-2/further-mathematics-8365/assessment-resources'),
    'cs':      ('Edexcel GCSE Computer Science', '1CP2', 'edexcel-gcse-computer-science', 'https://qualifications.pearson.com/en/qualifications/edexcel-gcses/computer-science-2020.coursematerials.html'),
    'geog':    ('AQA GCSE Geography', '8035', 'aqa-gcse-geography', 'https://www.aqa.org.uk/subjects/geography/gcse/geography-8035/assessment-resources'),
    'hist':    ('AQA GCSE History', '8145', 'aqa-gcse-history', 'https://www.aqa.org.uk/subjects/history/gcse/history-8145/assessment-resources'),
    'rs':      ('AQA GCSE Religious Studies A', '8062', 'aqa-gcse-religious-studies-a', 'https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-a-8062/assessment-resources'),
    'englit':  ('Edexcel International GCSE English Literature', '4ET1', 'edexcel-igcse-english-literature', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-english-literature-2016.coursematerials.html'),
    'englang': ('Edexcel International GCSE English Language B', '4EB1', 'edexcel-igcse-english-language-b', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-english-language-b-2016.coursematerials.html'),
    'fre':     ('Edexcel International GCSE French', '4FR1', 'edexcel-igcse-french', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-french-2017.coursematerials.html'),
    'ger':     ('Edexcel International GCSE German', '4GN1', 'edexcel-igcse-german', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-german-2017.coursematerials.html'),
    'spa':     ('Edexcel International GCSE Spanish', '4SP1', 'edexcel-igcse-spanish', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/international-gcse-spanish-2017.coursematerials.html'),
    'lat':     ('OCR GCSE Latin', 'J282', 'ocr-gcse-latin', 'https://www.ocr.org.uk/qualifications/past-paper-finder/'),
    'grk':     ('OCR GCSE Classical Greek', 'J292', 'ocr-gcse-classical-greek', 'https://www.ocr.org.uk/qualifications/past-paper-finder/'),
}
GROUPS = [('Sciences and maths', ['bio', 'chem', 'phys', 'maths', 'fm', 'cs']),
          ('Humanities', ['geog', 'hist', 'rs']),
          ('English', ['englit', 'englang']),
          ('Languages', ['fre', 'ger', 'spa', 'lat', 'grk'])]
KIND_TAG = {'skill': 'Skill', 'words': 'Vocabulary', 'settext': 'Set text'}
SUBJ = {s['id']: s for s in cur}
assert set(QUAL) == set(SUBJ), set(QUAL) ^ set(SUBJ)
assert sorted(sum((g[1] for g in GROUPS), [])) == sorted(SUBJ)

# Old addresses of the app (it used to live at /): sign-in links, invite links, home-screen icons.
FORWARD = ("<script>(function(){var q=location.search,h=location.hash;"
           "if(/[?&](join|delete|code|error|token_hash)=/.test(q)||/access_token|refresh_token|error_description|type=/.test(h)"
           "||/^#(study|stats|settings|groups|subjects|topics|next|home|plan)\\b/.test(h))location.replace('/app/'+q+h);})();</script>")
THEME = "<script>try{if(localStorage.getItem('r9-theme')==='day')document.documentElement.dataset.mode='day'}catch(e){}</script>"
# Signed in on this device? Then the button opens the planner instead of asking to sign in.
SIGNED = ("<script>try{if(Object.keys(localStorage).some(function(k){return /^sb-.*-auth-token$/.test(k)}))"
          "document.querySelectorAll('[data-signin]').forEach(function(a){a.textContent='Open my planner'})}catch(e){}</script>")
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;600;700;800&display=swap">')
NAV = [('/how.html', 'How it works'), ('/subjects/', 'Subjects'), ('/parents.html', 'For parents')]


def page(path, title, desc, body, *, active=None, jsonld=None, forward=False, index=True):
    url = SITE + path
    nav = ''.join(f'<a href="{h}"{" aria-current=page" if h == active else ""}>{t}</a>' for h, t in NAV)
    ld = ''.join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in (jsonld or []))
    out = f'''<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{FORWARD if forward else ''}{THEME}
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{'' if index else '<meta name="robots" content="noindex">'}
<link rel="canonical" href="{url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Road to 9">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{SITE}/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#050c14">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
{FONTS}
<link rel="stylesheet" href="/site.css">
{ld}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">{MARK}<span>Road to <b>9</b></span></a>
  <nav aria-label="Main">{nav}</nav>
  <a class="btn small primary signin" href="/app/" data-signin>Sign in</a>
</div></header>
<main>
{body}
</main>
<footer><div class="wrap">
  <span class="grow">© Schmittat Ltd · company no. 09452378</span>
  <a href="/how.html">How it works</a><a href="/subjects/">Subjects</a><a href="/parents.html">For parents</a>
  <a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="mailto:hello@roadto9.com">hello@roadto9.com</a>
</div></footer>
{SIGNED}
</body>
</html>
'''
    assert '—' not in out, f'em dash in {path}'
    target = root / (path.lstrip('/') + ('index.html' if path.endswith('/') else ''))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out, encoding='utf-8')
    return path


def topics(sid):
    """The app splits long topics into chunks ("Nutrition (1/4)"); the public pages show each topic once."""
    out = []
    for c in SUBJ[sid]['cards']:
        g = c.get('g') or c['n']
        if out and out[-1]['g'] == g and out[-1]['sec'] == c['sec']:
            out[-1]['pts'] += len(c['p'])
        else:
            out.append({'g': g, 'sec': c['sec'], 'k': c.get('k'), 'pts': len(c['p'])})
    return out


def counts(sid):
    ts = topics(sid)
    return len(ts), sum(t['pts'] for t in ts)


def subj_link(sid):
    name, code, slug, _ = QUAL[sid]
    n, p = counts(sid)
    return f'<a class="subj" href="/subjects/{slug}.html"><b>{e(SUBJ[sid]["name"])}</b><span>{e(SUBJ[sid]["board"])} · {n} topics</span></a>'


def subjects_grid():
    return ''.join(f'<div class="group"><p class="eyebrow">{g}</p><div class="subjects">{"".join(subj_link(s) for s in ids)}</div></div>' for g, ids in GROUPS)


ORG = {'@context': 'https://schema.org', '@type': 'Organization', 'name': 'Road to 9', 'url': SITE + '/',
       'logo': SITE + '/icon-512.png', 'email': 'hello@roadto9.com',
       'parentOrganization': {'@type': 'Organization', 'name': 'Schmittat Ltd'}}

FAQ = [
    ('Is Road to 9 free?', 'Yes. It is free for students taking their GCSEs in summer 2027.'),
    ('How do I join?', 'Road to 9 is invite only for now. Every student has three invite links to pass on, so ask a friend who uses it. Or email hello@roadto9.com and tell us which school year and exam boards you are in.'),
    ('Which subjects and exam boards does it cover?', f'{len(SUBJ)} subjects so far, including Edexcel International GCSE sciences, maths and languages, AQA humanities and OCR Latin and Classical Greek. The subjects page lists every board and course code. If yours is missing, tell us.'),
    ('Does it replace my notes, textbooks or lessons?', 'No. Road to 9 plans what to revise and when. You still revise from your own notes, textbooks, revision guides and past papers.'),
    ('Does it work on my phone?', 'Yes. It runs in the browser on phones, tablets and laptops, so there is nothing to install. Your plan follows you between devices.'),
    ('What happens to my data?', 'We keep your email, an optional first name and your planner. Nobody else can see your planner. No ads, no tracking, and you can download or delete everything in Settings.'),
    ('Why "Road to 9"?', 'Grade 9 is the top GCSE grade. The plan is built to get every topic as strong as it can be before the exam.'),
]


def home():
    faq_html = ''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in FAQ)
    faq_ld = {'@context': 'https://schema.org', '@type': 'FAQPage',
              'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ]}
    site_ld = {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'Road to 9', 'url': SITE + '/'}
    body = f'''
<section class="hero"><div class="wrap grid">
  <div>
    <p class="eyebrow">GCSE revision planner</p>
    <h1>We do the planning.<br><span class="hl">You do the learning.</span></h1>
    <p class="lead">Road to 9 tells you what to revise each day, weakest topics first, and brings every topic back just before you would forget it.</p>
    <div class="btns"><a class="btn primary" href="/app/" data-signin>Sign in</a><a class="btn" href="/how.html">How it works</a></div>
    <p class="note">Free for GCSE 2027 · invite only for now · works on phone and laptop</p>
  </div>
  <div class="shot"><img src="/img/session.png" width="1200" height="676" alt="A Road to 9 revision session: the topic, its spec points, a 45 minute timer and the rest of today's sessions"></div>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">How it works</p>
  <h2>Three steps, then just follow the plan</h2>
  <div class="steps">
    <div class="card"><h3>Rate what you know</h3><p>Go through your subjects and rate every spec point, from very weak to very strong. Be honest: the weakest topics come first.</p></div>
    <div class="card"><h3>Revise each topic once</h3><p>Each day you get a short list of sessions, mostly 45 minutes. Start the timer, revise from your own notes, then rate the topic again.</p></div>
    <div class="card"><h3>Refresh it before you forget</h3><p>Topics come back as 5 to 10 minute refreshers at growing gaps, so they stick until the exam instead of fading after a week.</p></div>
  </div>
  <p class="muted" style="margin-top:20px">Spacing study out and testing yourself are the two revision methods with the strongest evidence behind them. <a href="/how.html">Read how Road to 9 uses them</a>.</p>
</div></section>

<section><div class="wrap split">
  <div class="shot"><img src="/img/week.png" width="1200" height="774" loading="lazy" alt="A week planned in Road to 9: each day lists its revise sessions and short refreshers, with how long the student has that day"></div>
  <div>
    <p class="eyebrow">Every day</p>
    <h2>Open it, and your week is already planned</h2>
    <ul class="ticks">
      <li>You set how long you can study each day, including holidays and days off.</li>
      <li>Short on time or full of energy? Add or drop a session for today.</li>
      <li>Mocks and exams pull refreshers forward, and the last four weeks before each exam put that subject first.</li>
      <li>Past papers join the plan in the spring, and the topics that cost you marks come back sooner.</li>
      <li>A journal and a to-do for each topic, waiting for you next time.</li>
    </ul>
  </div>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">Subjects</p>
  <h2>{len(SUBJ)} subjects, every topic of the spec</h2>
  <p class="muted" style="max-width:640px">Each subject follows its exam board's specification point by point. Pick the ones you take; topics your school doesn't teach can be switched off.</p>
  {subjects_grid()}
  <p class="muted small" style="margin-top:18px">Your board or subject missing? Email <a href="mailto:hello@roadto9.com">hello@roadto9.com</a>.</p>
</div></section>

<section><div class="wrap split">
  <div>
    <p class="eyebrow">Made for students</p>
    <h2>Calm, private, no tricks</h2>
    <p class="muted">Revision is stressful enough. Road to 9 is built to lower the pressure, not to keep you on your phone.</p>
    <div class="btns"><a class="btn" href="/parents.html">For parents and teachers</a></div>
  </div>
  <ul class="ticks no">
    <li>No ads, and your data is never sold or shared.</li>
    <li>No streaks, points or league tables to make you feel behind.</li>
    <li>No messaging and no public profiles.</li>
    <li>No tracking cookies or analytics.</li>
  </ul>
</div></section>

<section><div class="wrap narrow">
  <p class="eyebrow">Questions</p>
  <h2>Good to know</h2>
  <div class="faq">{faq_html}</div>
</div></section>
'''
    return page('/', 'Road to 9 · The GCSE revision planner',
                'Road to 9 plans your GCSE revision: what to revise each day, weakest topics first, with short refreshers before you forget. Free for GCSE 2027.',
                body, jsonld=[ORG, site_ld, faq_ld], forward=True)


def subjects_index():
    body = f'''
<div class="wrap">
  <p class="crumbs"><a href="/">Home</a> › Subjects</p>
  <h1>GCSE subjects and exam boards</h1>
  <p class="lead muted" style="max-width:680px;font-size:19px">Every subject in Road to 9 follows one exam board's specification. Open a subject to see all of its topics, with links to the official specification and past papers.</p>
  {subjects_grid()}
  <div class="cta"><h2>Your subject isn't here?</h2><p>We add boards that students ask for. Email <a href="mailto:hello@roadto9.com">hello@roadto9.com</a> with the board and course code.</p></div>
</div>
<div style="height:72px"></div>'''
    return page('/subjects/', 'GCSE and IGCSE subjects and exam boards · Road to 9',
                f'The {len(SUBJ)} GCSE and International GCSE subjects in Road to 9, from Edexcel, AQA and OCR, with every topic listed.',
                body, active='/subjects/')


def tag(c):
    return f'<span class="tag">{KIND_TAG[c["k"]]}</span>' if c.get('k') in KIND_TAG else ''


def subject_page(sid):
    s = SUBJ[sid]
    name, code, slug, pp = QUAL[sid]
    n, p = counts(sid)
    secs = []
    for t in topics(sid):
        if not secs or secs[-1][0] != t['sec']:
            secs.append((t['sec'], []))
        secs[-1][1].append(t)
    sec_html = ''.join(
        f'<div class="sec"><h2>{e(sec)}</h2><ol class="topics">' + ''.join(
            f'<li><span class="n">{e(t["g"])}{tag(t)}</span>'
            f'<span class="c">{t["pts"]} spec point{"s" if t["pts"] != 1 else ""}</span></li>' for t in cards) + '</ol></div>'
        for sec, cards in secs)
    title = f'{name} ({code}) revision checklist'
    crumbs_ld = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': 'Subjects', 'item': SITE + '/subjects/'},
        {'@type': 'ListItem', 'position': 3, 'name': s['name'], 'item': f'{SITE}/subjects/{slug}.html'}]}
    body = f'''
<div class="wrap narrow">
  <p class="crumbs"><a href="/">Home</a> › <a href="/subjects/">Subjects</a> › {e(s["name"])}</p>
  <p class="eyebrow">Revision checklist</p>
  <h1>{e(name)} ({code})</h1>
  <p class="lead muted" style="font-size:19px;margin:0">Every topic of the course, grouped the way the specification is. Use it as a checklist, or let Road to 9 turn it into a daily plan.</p>
  <ul class="facts"><li><b>{len(secs)}</b>sections</li><li><b>{n}</b>topics</li><li><b>{p}</b>spec points</li></ul>
  <div class="links"><a class="btn small" href="{e(s["spec"])}" rel="noopener">Official specification</a><a class="btn small" href="{e(pp)}" rel="noopener">Past papers and mark schemes</a></div>
  {sec_html}
  <div class="sec"><h2>How to revise {e(s["name"])} with this list</h2>
    <ol>
      <li>Rate every spec point honestly, from very weak to very strong.</li>
      <li>Revise the weakest topics first, one topic per session.</li>
      <li>Come back to each topic a day later, then a few days later, then a week or two later. Try to recall it before you look.</li>
      <li>From the spring, do full past papers and go back to the topics that cost you marks.</li>
    </ol>
    <p class="muted">Not studying some of these topics? Schools choose different options in some subjects. In Road to 9 you switch those topics off and they leave your plan.</p>
  </div>
  <div class="cta"><h2>Let Road to 9 plan it for you</h2><p>Rate the spec points once, and every day you get a short list of sessions for {e(s["name"])} and your other subjects, weakest first, with refreshers before you forget.</p>
    <div class="btns"><a class="btn primary" href="/app/" data-signin>Sign in</a><a class="btn" href="/how.html">How it works</a></div></div>
</div>
<div style="height:72px"></div>'''
    return page(f'/subjects/{slug}.html', f'{title} · Road to 9',
                f'All {n} topics and {p} spec points of {name} ({code}), as a revision checklist, with links to the official specification and past papers.',
                body, active='/subjects/', jsonld=[crumbs_ld])


def parents():
    body = '''
<div class="wrap narrow prose">
  <p class="crumbs"><a href="/">Home</a> › For parents and teachers</p>
  <h1>For parents and teachers</h1>
  <p class="lead">Road to 9 helps a student plan GCSE revision: what to revise each day, and when to come back to it. It is their space, built to be calm and private.</p>

  <h2>What it does</h2>
  <ul class="ticks">
    <li>The student rates every spec point of their subjects, from very weak to very strong.</li>
    <li>Each day it suggests a short list of revision sessions, weakest topics first, within the time the student says they have.</li>
    <li>Topics come back as short refreshers at growing gaps, the way memory research recommends, and past papers join in the spring.</li>
  </ul>

  <h2>What it doesn't do</h2>
  <ul class="ticks no">
    <li>No ads, and no selling or sharing of data.</li>
    <li>No messaging, comments or public profiles, so strangers can't make contact through it.</li>
    <li>No streaks, points or league tables, and no comparing students with each other.</li>
    <li>No tracking cookies or analytics.</li>
  </ul>

  <h2>What we keep</h2>
  <p>An email address for sign-in links, an optional first name, and the planner itself: subjects, ratings, sessions, notes and exam dates. Nobody else can read a student's planner. We can see account details, like when someone last signed in, but never what is in their planner. Students can download or delete everything in Settings at any time, and accounts unused for 12 months are deleted after a warning email. The <a href="/privacy.html">privacy note</a> has the details, including <a href="/privacy.html#safety">how we checked the risks</a>.</p>

  <h2>Age and consent</h2>
  <p>Road to 9 is for students aged 13 and over. When they join, students under 18 confirm that a parent or carer knows they are using it. There is no parent view: the plan belongs to the student, which helps them be honest about what they don't know yet.</p>

  <h2>Study groups</h2>
  <p>Students can make a small study group with friends using a code they share in person. Inside a group they can choose to show which topics they could help with, or that they are studying right now. All of this is off until they switch it on, and there is still no messaging.</p>

  <h2>Who we are</h2>
  <p>Road to 9 is run by Schmittat Ltd (company no. 09452378), registered with the Information Commissioner's Office. It is free for students taking GCSEs in 2027. Questions or worries: <a href="mailto:hello@roadto9.com">hello@roadto9.com</a>.</p>
</div>'''
    return page('/parents.html', 'For parents and teachers · Road to 9',
                'What Road to 9 does for GCSE students, what data it keeps, and how it keeps students safe: no ads, no messaging, no tracking.',
                body, active='/parents.html')


def not_found():
    body = '''
<div class="wrap narrow prose" style="padding-top:72px">
  <h1>That page isn't here</h1>
  <p class="lead">It may have moved. Your planner is at <a href="/app/">roadto9.com/app</a>.</p>
  <div class="btns"><a class="btn primary" href="/">Road to 9 home</a><a class="btn" href="/subjects/">Subjects</a></div>
</div>'''
    return page('/404.html', 'Page not found · Road to 9', 'This page could not be found.', body, index=False)


pages = [home(), subjects_index(), *[subject_page(s) for _, ids in GROUPS for s in ids], parents()]
not_found()
# Pages kept by hand that should also be found
pages += ['/how.html', '/privacy.html', '/terms.html']
urls = ''.join(f'<url><loc>{SITE}{p}</loc><lastmod>{TODAY}</lastmod></url>' for p in pages)
(root / 'sitemap.xml').write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n', encoding='utf-8')
(root / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {SITE}/sitemap.xml\n', encoding='utf-8')
print('site:', len(pages), 'pages in the sitemap')

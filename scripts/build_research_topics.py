#!/usr/bin/env python3
"""Build the static research topic directory and article navigation.

The curated research-topics.json file is the only topic-assignment source.
Existing article prose, citations, page chrome and behavior are preserved.
Use --article FILE to update a particular article after its source changes.
Use --check to verify every generated page without writing anything.
"""
from __future__ import annotations

import argparse
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
START = '<!-- MONDERMAN RESEARCH TOPICS: START -->'
END = '<!-- MONDERMAN RESEARCH TOPICS: END -->'
STYLE = '<link rel="stylesheet" href="research-topics.css?v=20261017.1">'
GENERATED = re.compile(r'\n' + re.escape(START) + r'[\s\S]*?' + re.escape(END) + r'\n')


class ArticleStructure(HTMLParser):
    """Record exact offsets without serializing or changing authored HTML."""
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0]
        for match in re.finditer('\n', text):
            self.lines.append(match.end())
        self.stack = []
        self.content_article_close = None
        self.main_close = None
        self.further_start = None
        self.is_article = False

    def source_offset(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        if tag == 'meta' and attrs.get('property') == 'og:type' and attrs.get('content') == 'article':
            self.is_article = True
        if tag == 'section' and 'article-further' in classes:
            self.further_start = self.source_offset()
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append((tag, classes))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            opened, classes = self.stack[index]
            if opened == tag:
                if tag == 'article' and 'content' in classes and self.content_article_close is None:
                    self.content_article_close = self.source_offset()
                if tag == 'main':
                    self.main_close = self.source_offset()
                self.stack = self.stack[:index]
                break


def read_manifest():
    data = json.loads((ROOT / 'research-topics.json').read_text())
    assert data['schemaVersion'] == 1
    topics = {topic['id']: topic for topic in data['topics']}
    articles = {article['path']: article for article in data['articles']}
    assert len(topics) == len(data['topics']), 'Duplicate topic ID'
    assert len(articles) == len(data['articles']), 'Duplicate article path'
    for key, topic in topics.items():
        assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key), key
        assert topic['label'] and topic['description']
        assert sum(key in article['topics'] for article in articles.values()) >= 2, f'No related article for {key}'
    for path, article in articles.items():
        assert re.fullmatch(r'[a-z0-9-]+\.html', path), path
        assert article['title'] and article['summary']
        assert 2 <= len(article['topics']) <= 5, path
        assert len(set(article['topics'])) == len(article['topics']), path
        assert all(topic in topics for topic in article['topics']), path
    return data, topics, articles


def related_articles(article, articles):
    selected = set(article['topics'])
    matches = [other for other in articles.values() if other['path'] != article['path'] and selected.intersection(other['topics'])]
    matches.sort(key=lambda other: (-len(selected.intersection(other['topics'])), other['title'].casefold(), other['path']))
    return matches[:3]


def article_navigation(article, topics, articles):
    chips = '\n'.join(
        f'      <li><a href="research-topics.html#{escape(topic)}">{escape(topics[topic]["label"])}</a></li>'
        for topic in article['topics']
    )
    related = '\n'.join(
        f'      <li><a href="{escape(other["path"])}">{escape(other["title"])}</a></li>'
        for other in related_articles(article, articles)
    )
    return f'''{START}
<nav class="research-topic-nav" aria-labelledby="research-topic-heading">
  <h2 id="research-topic-heading">Explore related research</h2>
  <p class="research-topic-label">Topics in this article</p>
  <ul class="research-topic-chips">
{chips}
  </ul>
  <h3>Related articles</h3>
  <ul class="research-related-list">
{related}
  </ul>
  <p class="research-topic-all"><a href="research-topics.html">Browse all research topics <span aria-hidden="true">→</span></a></p>
</nav>
{END}'''


def strip_generated(text):
    return GENERATED.sub('', text).replace(STYLE + '\n', '').replace(STYLE, '')


def apply_article(text, article, topics, articles):
    """Return updated HTML; imported by publication builders if desired."""
    clean = strip_generated(text)
    assert clean.count('</head>') == 1, article['path']
    parsed = ArticleStructure(clean)
    parsed.feed(clean)
    position = parsed.content_article_close
    if position is None:
        position = parsed.further_start if parsed.further_start is not None else parsed.main_close
    assert position is not None, f'No article body found: {article["path"]}'
    line_start = clean.rfind("\n", 0, position) + 1
    if not clean[line_start:position].strip():
        position = line_start
    result = clean[:position] + '\n' + article_navigation(article, topics, articles) + '\n' + clean[position:]
    # Keep the shared brand layer last when a publication declares it explicitly.
    brand = re.search(r'<link rel="stylesheet" href="brand-surfaces\.css(?:\?v=[0-9.]+)?">', result)
    if brand:
        result = result[:brand.start()] + STYLE + '\n' + result[brand.start():]
    else:
        result = result.replace('</head>', STYLE + '\n</head>', 1)
    # Exact authored bytes remain after removing the two finite generated additions.
    assert strip_generated(result) == clean
    return result


def directory_html(data, topics, articles):
    # Canonical authored shell fragments are shared with the existing site.
    header = (ROOT / 'site-shell/header.html').read_text().strip()
    footer = (ROOT / 'site-shell/footer.html').read_text().strip()
    jumps = '\n'.join(f'        <li><a href="#{escape(topic["id"])}">{escape(topic["label"])}</a></li>' for topic in data['topics'])
    sections = []
    for topic in data['topics']:
        cards = []
        matches = sorted((article for article in articles.values() if topic['id'] in article['topics']), key=lambda article: article['title'].casefold())
        for article in matches:
            cards.append(f'''          <li>
            <h3><a href="{escape(article['path'])}">{escape(article['title'])}</a></h3>
            <p>{escape(article['summary'])}</p>
          </li>''')
        sections.append(f'''      <section class="research-topic-section" id="{escape(topic['id'])}" aria-labelledby="topic-{escape(topic['id'])}">
        <h2 id="topic-{escape(topic['id'])}">{escape(topic['label'])}</h2>
        <p class="research-topic-intro">{escape(topic['description'])}</p>
        <ul class="research-topic-results">
{chr(10).join(cards)}
        </ul>
        <p class="research-topic-back"><a href="#topics">Back to topics <span aria-hidden="true">↑</span></a></p>
      </section>''')
    return f'''<!DOCTYPE html>
<!-- Generated by scripts/build_research_topics.py from research-topics.json. -->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Research by topic | Monderman</title>
  <meta name="description" content="Explore Monderman research by topic, including hiring, work design, organizational governance, administrative burden, decision velocity and AI.">
  <link rel="canonical" href="https://www.monderman.com/research-topics.html">
  <meta property="og:title" content="Research by topic | Monderman">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.monderman.com/research-topics.html">
  <meta property="og:description" content="Find related Monderman articles on the operating questions that matter to your organization.">
  <meta property="og:image" content="https://www.monderman.com/assets/brand/monderman-social-card.png?v=20260907-wordmark2">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Monderman">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Research by topic | Monderman">
  <meta name="twitter:description" content="Find related Monderman articles on the operating questions that matter to your organization.">
  <meta name="twitter:image" content="https://www.monderman.com/assets/brand/monderman-social-card.png?v=20260907-wordmark2">
  <meta name="twitter:image:alt" content="Monderman">
  <link rel="icon" type="image/svg+xml" href="favicon.svg?v=20260906-enterprise1">
  <link rel="icon" type="image/x-icon" sizes="any" href="favicon.ico?v=20260906-enterprise1">
  <link rel="icon" type="image/png" sizes="192x192" href="favicon-192.png?v=20260906-enterprise1">
  <link rel="apple-touch-icon" href="apple-touch-icon.png?v=20260906-enterprise1">
  <link rel="stylesheet" href="canonical-site-shell.css?v=20260906-accent1">
  <link rel="stylesheet" href="enterprise-site.css?v=20260915.consistency1">
  {STYLE}
</head>
<body class="canonical-green-shell research-topics-page">
  <a class="research-topics-skip" href="#main-content">Skip to research topics</a>
{header}
  <main id="main-content">
    <header class="hero research-topics-hero">
      <div class="hero-inner research-topics-wrap">
        <p class="hero-eyebrow research-topics-eyebrow">Monderman research</p>
        <h1>Follow the question.</h1>
        <p>Find articles that examine the same organizational topic from different perspectives.</p>
        <a href="research.html">Browse the research library <span aria-hidden="true">→</span></a>
      </div>
    </header>
    <div class="research-topics-wrap research-topics-content">
      <nav class="research-topics-jump" id="topics" aria-labelledby="topics-heading">
        <h2 id="topics-heading">Explore by topic</h2>
        <ul class="research-topic-chips">
{jumps}
        </ul>
      </nav>
{chr(10).join(sections)}
    </div>
  </main>
{footer}
  <script src="canonical-site-shell.js?v=20260915.consistency1"></script>
  <script src="assistant.js?v=20260828-footer-dock4" defer></script>
  <script src="contact-transport.js?v=20260903-contact1" defer></script>
  <script src="connect-widget.js?v=20260903-contact1" defer></script>
</body>
</html>
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify generated content without writing')
    parser.add_argument('--article', action='append', default=[], help='Generate only this article (repeatable)')
    parser.add_argument('--skip', action='append', default=[], help='Skip this article while another editor owns it (repeatable)')
    parser.add_argument('--no-directory', action='store_true', help='Do not generate/check the topic directory')
    args = parser.parse_args()
    data, topics, articles = read_manifest()
    chosen = args.article or list(articles)
    assert set(chosen).issubset(articles), 'Unknown article requested'
    changed = []
    checked = []
    errors = []
    for name in chosen:
        if name in args.skip:
            continue
        path = ROOT / name
        if not path.is_file():
            errors.append(f'Missing article: {name}')
            continue
        old = path.read_text()
        expected = apply_article(old, articles[name], topics, articles)
        checked.append(name)
        if expected != old:
            if args.check:
                errors.append(f'Stale article navigation: {name}')
            else:
                path.write_text(expected)
                changed.append(name)
    if not args.no_directory:
        path = ROOT / 'research-topics.html'
        expected = directory_html(data, topics, articles)
        checked.append(path.name)
        if not path.exists() or path.read_text() != expected:
            if args.check:
                errors.append('Stale research-topics.html')
            else:
                path.write_text(expected)
                changed.append(path.name)
    # Every current research article must have an explicit editorial assignment.
    for path in sorted(ROOT.glob('*.html')):
        if path.name in {'research-topics.html', *args.skip}:
            continue
        probe = ArticleStructure(path.read_text())
        probe.feed(path.read_text())
        if probe.is_article and path.name not in articles:
            errors.append(f'Article is absent from research-topics.json: {path.name}')
    result = {'status': 'FAIL' if errors else 'PASS', 'articleCount': len(articles), 'topicCount': len(topics), 'checked': checked, 'changed': changed, 'errors': errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return bool(errors)


if __name__ == '__main__':
    sys.exit(main())

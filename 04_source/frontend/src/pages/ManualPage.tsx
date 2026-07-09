import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { MANUAL, type Block } from '../manualContent';

// The manual renders per-language structured content (manualContent.ts). Inline
// markup in text: **bold**, `code`, [label](/route or #anchor), <i>…</i>, and
// <ok>/<bad>/<run> status colours.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|<(?:ok|bad|run|i)>[^<]+<\/(?:ok|bad|run|i)>)/g;

function renderInline(text: string): ReactNode {
  const parts = text.split(INLINE).filter(Boolean);
  return parts.map((part, i) => {
    let m: RegExpMatchArray | null;
    if ((m = part.match(/^\*\*([^*]+)\*\*$/))) return <b key={i}>{m[1]}</b>;
    if ((m = part.match(/^`([^`]+)`$/))) return <code key={i}>{m[1]}</code>;
    if ((m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/))) {
      const [, label, href] = m;
      if (href.startsWith('/')) return <Link key={i} to={href}>{label}</Link>;
      return <a key={i} href={href}>{label}</a>; // #anchors and external
    }
    if ((m = part.match(/^<(ok|bad|run|i)>([^<]+)<\/(?:ok|bad|run|i)>$/))) {
      const [, tag, inner] = m;
      if (tag === 'i') return <i key={i}>{inner}</i>;
      return <span key={i} className={`doc-${tag}`}>{inner}</span>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

// Copyable code block.
function Code({ code }: { code: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="doc-code">
      <button className="doc-copy" onClick={copy} aria-label={t('manual.copy')}>
        {copied ? t('manual.copied') : t('manual.copybtn')}
      </button>
      <pre className="run-output">{code}</pre>
    </div>
  );
}

function renderBlock(b: Block, i: number): ReactNode {
  switch (b.k) {
    case 'p': return <p key={i}>{renderInline(b.t)}</p>;
    case 'flow': return <p key={i} className="manual-flow">{renderInline(b.t)}</p>;
    case 'note': return <p key={i} className="doc-note">{renderInline(b.t)}</p>;
    case 'tip': return <p key={i} className="doc-tip">{renderInline(b.t)}</p>;
    case 'h4': return <h4 key={i}>{renderInline(b.t)}</h4>;
    case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
    case 'ol': return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
    case 'code': return <Code key={i} code={b.code} />;
    case 'faq': return (
      <dl key={i} className="doc-faq">
        {b.qa.map(([q, a], j) => (
          <Fragment key={j}>
            <dt>{renderInline(q)}</dt>
            <dd>{renderInline(a)}</dd>
          </Fragment>
        ))}
      </dl>
    );
  }
}

export default function ManualPage() {
  const { lang, t } = useT();
  const sections = MANUAL[lang];
  const [active, setActive] = useState(sections[0]?.id ?? 'overview');

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <main className="page-container manual-page">
      <div className="page-header">
        <h1>{t('nav.manual')}</h1>
        <span className="count-chip">{t('manual.subtitle')}</span>
      </div>

      <div className="manual-layout">
        <nav className="manual-toc" aria-label={t('manual.contents')}>
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'active' : ''}>{s.title}</a>
          ))}
        </nav>

        <article className="manual-body doc">
          {sections.map(s => (
            <section key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              {s.blocks.map(renderBlock)}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}

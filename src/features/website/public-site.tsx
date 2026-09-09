/* eslint-disable @next/next/no-img-element -- Images are validated inline data URLs; no remote optimizer is needed. */
import type { CSSProperties } from "react";
import { brandForeground, type Website } from "./schema";

export function PublicSite({ site, pageId, preview = false }: { site: Website; pageId: string; preview?: boolean }) {
  const page = site.pages.find(p => p.id === pageId) ?? site.pages[0];
  const style = { "--site-color": site.branding.color, "--site-on-color": brandForeground(site.branding.color), "--site-radius": site.branding.rounded ? "20px" : "6px" } as CSSProperties;
  return <div className={`public-site ${site.font === "classic" ? "site-classic" : ""} ${site.motion === "gentle" ? "site-gentle" : ""}`} style={style}>
    <header className="site-header">
      <div className="flex items-center gap-3">
        {site.branding.logo ?  <img alt="" src={site.branding.logo} className="h-12 w-12 object-contain" /> : null}
        <strong>{site.title}</strong>
      </div>
      <nav aria-label="Menu trang công khai" className="flex flex-wrap gap-4">
        {site.pages.filter(p => p.inMenu).map(p => <a key={p.id} aria-current={p.id === page.id ? "page" : undefined} href={preview ? `#preview-${p.id}` : `/site/${p.slug}`}>{p.title}</a>)}
        {site.links.filter(l => l.placement !== "footer").map((l, i) => <a key={i} href={l.url} rel="noreferrer">{l.label}</a>)}
      </nav>
    </header>
    <main className="site-main">
      {page.blocks.map((block, index) => <section className={`site-block site-${block.type}`} key={block.id}>
        {block.title ? index === 0 ? <h1>{block.title}</h1> : <h2>{block.title}</h2> : null}
        {block.body ? <p className="whitespace-pre-wrap">{block.body}</p> : null}
        {block.image ?  <img src={block.image} alt={block.title} className="mt-6 max-h-[480px] w-full rounded-xl object-contain" /> : null}
        {block.type === "contact" ? <address className="my-5 grid gap-2 not-italic"><span>{site.address}</span><span>{site.contactPhone}</span>{site.contactEmail ? <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> : null}</address> : null}
        {block.linkUrl && block.linkLabel ? <a className="site-cta" href={block.linkUrl} rel="noreferrer">{block.linkLabel}</a> : null}
      </section>)}
    </main>
    <footer className="site-footer"><strong>{site.title}</strong><p>{site.branding.description}</p><p>{site.address}</p><div className="flex flex-wrap gap-4">{site.links.filter(l => l.placement !== "header").map((l, i) => <a key={i} href={l.url} rel="noreferrer">{l.label}</a>)}</div></footer>
  </div>;
}

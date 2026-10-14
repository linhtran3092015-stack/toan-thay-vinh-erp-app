/* eslint-disable @next/next/no-img-element -- Images are validated inline data URLs; no remote optimizer is needed. */
"use client";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, Globe, ImageIcon, Plus, Trash2 } from "lucide-react";
import { StickySaveBar } from "@/components/patterns/sticky-save-bar";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button, getButtonClassName } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import { GuardedLink, useLeaveGuard, useSaveInFlightGuard } from "@/features/settings/components/leave-guard";
import { SettingsCard } from "@/features/settings/components/settings-card";
import type { SettingsActionOverrides } from "@/features/settings/settings-action-overrides";
import { cn } from "@/lib/utils";
import { saveWebsite } from "./actions";
import { createPage, palettePresets, websiteSchema, type Branding, type Website, type SiteBlock, type SitePage, type Palette } from "./schema";
import { choiceSelectedClassName, paletteLabels, PersonalAppearance } from "./appearance";
import { PublicSite } from "./public-site";

type Operation = "save" | "publish" | "unpublish";

/** Shown when the save/publish call itself fails (network, server crash) instead of answering. */
const CONNECTION_ERROR = "Không thể kết nối hệ thống. Nội dung vẫn được giữ trên màn hình.";

/** Save-bar labels, in on-screen order. Branding keys first, then the website parts. */
const BRANDING_LABELS: Record<keyof Branding, string> = {
  logo: "Logo",
  favicon: "Favicon",
  description: "Mô tả thương hiệu",
  appPalette: "Màu nhấn",
  rounded: "Bo góc",
  color: "Màu website",
};
const SITE_LABELS: Record<Exclude<keyof Website, "branding">, string> = {
  title: "Tên website",
  contactEmail: "Email liên hệ công khai",
  contactPhone: "Điện thoại công khai",
  address: "Địa chỉ công khai",
  font: "Kiểu chữ",
  motion: "Hiệu ứng",
  pages: "Các trang và khối nội dung",
  links: "Liên kết menu và mạng xã hội",
};

/** Labels of the parts that differ between the saved draft and the editor. */
function changedWebsiteLabels(saved: Website, current: Website): string[] {
  const labels: string[] = [];
  for (const key of Object.keys(BRANDING_LABELS) as (keyof Branding)[]) {
    if (saved.branding[key] !== current.branding[key]) labels.push(BRANDING_LABELS[key]);
  }
  for (const key of Object.keys(SITE_LABELS) as (keyof typeof SITE_LABELS)[]) {
    if (JSON.stringify(saved[key]) !== JSON.stringify(current[key])) labels.push(SITE_LABELS[key]);
  }
  return labels;
}

export function WebsiteEditor({
  actions,
  canManage,
  centerName,
  initialDraft,
  initialSite,
  initialVersion,
  initiallyPublished,
  mode,
}: {
  actions?: Pick<SettingsActionOverrides, "applyPersonalAppearance" | "saveWebsite">;
  canManage: boolean;
  /** Branding mode: the centre name, edited only at /settings/general. */
  centerName?: string;
  /** Dev previews only: start with these unsaved edits on top of `initialSite`. */
  initialDraft?: Website;
  initialSite: Website;
  initialVersion: number;
  initiallyPublished: boolean;
  mode: "branding" | "website";
}) {
  const save = actions?.saveWebsite ?? saveWebsite;
  const [site, setSite] = useState(initialDraft ?? initialSite);
  const [saved, setSaved] = useState(JSON.stringify(initialSite));
  const [version, setVersion] = useState(initialVersion);
  const [published, setPublished] = useState(initiallyPublished);
  const [selected, setSelected] = useState(initialSite.pages[0].id);
  const [preview, setPreview] = useState(false);
  const [confirmation, setConfirmation] = useState<"publish" | "unpublish" | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const current = JSON.stringify(site);
  const dirty = saved !== current;
  // Latest draft and version known on the server: from the props (refresh) or a successful save here.
  const [server, setServer] = useState({ site: initialSite, version: initialVersion });
  const [propsSource, setPropsSource] = useState({ published: initiallyPublished, site: initialSite, version: initialVersion });
  // Bumped by Hủy so image reads still in flight are dropped.
  const [resetSignal, setResetSignal] = useState(0);
  if (propsSource.site !== initialSite || propsSource.version !== initialVersion || propsSource.published !== initiallyPublished) {
    // A refresh (after saving here or elsewhere) brings new server values. A clean
    // editor adopts them; a dirty one keeps the edits (saving with the old version
    // then reports the conflict instead of overwriting silently) and Hủy adopts them.
    setPropsSource({ published: initiallyPublished, site: initialSite, version: initialVersion });
    setServer({ site: initialSite, version: initialVersion });
    setPublished(initiallyPublished);
    if (!dirty) {
      setSite(initialSite);
      setSaved(JSON.stringify(initialSite));
      setVersion(initialVersion);
    }
  }
  const savedSite = useMemo(() => JSON.parse(saved) as Website, [saved]);
  const changedLabels = useMemo(() => (dirty ? changedWebsiteLabels(savedSite, site) : []), [dirty, savedSite, site]);
  const page = site.pages.find(p => p.id === selected) ?? site.pages[0];
  const locked = !canManage || pending;

  // Functional updates: a late image read merges into the current draft instead of an old copy.
  const edit = (patch: Partial<Website> | ((current: Website) => Partial<Website>)) => { setSite(s => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) })); setConfirmation(null); setSaveMessage(""); };
  const editBrand = (patch: Partial<Website["branding"]>) => edit(s => ({ branding: { ...s.branding, ...patch } }));
  const pageId = page.id;
  const editPage = (patch: Partial<SitePage> | ((current: SitePage) => Partial<SitePage>)) => edit(s => ({ pages: s.pages.map(p => p.id === pageId ? { ...p, ...(typeof patch === "function" ? patch(p) : patch) } : p) }));
  const editBlock = (id: string, patch: Partial<SiteBlock>) => editPage(p => ({ blocks: p.blocks.map(b => b.id === id ? { ...b, ...patch } : b) }));
  const run = (operation: Operation) => {
    setConfirmation(null);
    setSaveMessage("");
    setSaveError(null);
    setPublishResult(null);
    const parsed = websiteSchema.safeParse(site);
    if (operation !== "unpublish" && !parsed.success) {
      const message = parsed.error.issues[0].message;
      if (operation === "save") setSaveError(message);
      else setPublishResult({ ok: false, message });
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof save>>;
      try {
        result = await save(site, version, operation);
      } catch {
        // A rejected call must not reach the error boundary.
        result = { message: CONNECTION_ERROR, ok: false };
      }
      if (!result.ok) {
        // The editor keeps every typed value; only the result changes.
        if (operation === "save") setSaveError(result.message);
        else setPublishResult({ ok: false, message: result.message });
        return;
      }
      setVersion(result.version);
      if (operation === "save") {
        setSaved(JSON.stringify(site));
        setServer({ site, version: result.version });
        setSaveMessage(result.message);
      } else {
        setServer(current => ({ ...current, version: result.version }));
        setPublished(operation === "publish");
        setPublishResult({ ok: true, message: result.message });
      }
      router.refresh();
    });
  };
  /** Hủy (and "Rời trang"): back to the latest server draft and version, even one that arrived while editing. */
  const cancel = () => {
    // Never while saving: the save's own result decides what is saved and clean.
    if (pending) return;
    setSite(server.site);
    setSaved(JSON.stringify(server.site));
    setVersion(server.version);
    setSelected(server.site.pages.some(p => p.id === selected) ? selected : server.site.pages[0].id);
    setResetSignal(signal => signal + 1);
    setConfirmation(null);
    setSaveError(null);
    setSaveMessage("");
  };
  // Not while saving: leaving then must not discard or cut short the save, so
  // links just navigate and the save finishes (its success leaves the editor clean).
  // A reload/close while saving still asks, so the request is not cut off.
  useLeaveGuard(canManage && dirty && !pending, cancel);
  useSaveInFlightGuard(pending);
  function moveBlock(index: number, direction: number) { const blocks = [...page.blocks]; const next = index + direction; if (next < 0 || next >= blocks.length) return; [blocks[index], blocks[next]] = [blocks[next], blocks[index]]; editPage({ blocks }); }
  const addPage = () => { if (site.pages.length >= 12) return; const id = crypto.randomUUID(); const p = createPage(id, `trang-${id.slice(0, 8)}`); p.title = "Trang mới"; edit({ pages: [...site.pages, p] }); setSelected(id); };

  return <div className="grid min-w-0 gap-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-section-title font-semibold text-text-strong">{mode === "branding" ? "Thương hiệu & giao diện" : "Trang web công khai"}</h2>
        <p className="mt-0.5 text-secondary text-text-muted">{mode === "branding" ? "Nhận diện trung tâm và giao diện ERP cho mọi nhân viên." : "Soạn nội dung, xem trước rồi đăng phiên bản đã lưu."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canManage ? null : <><Badge>Chỉ đọc</Badge><span className="text-secondary text-text-muted">Cần quyền settings.manage để sửa thương hiệu và website.</span></>}
        <Button onClick={() => setPreview(!preview)} variant="secondary"><Eye aria-hidden="true" size={16} />{preview ? "Đóng xem trước" : mode === "branding" ? "Xem trước website" : "Xem trước"}</Button>
      </div>
    </div>
    {preview ? <div className="brand-panel"><p className="mb-4 text-sm text-text-muted">Xem trước bản đang soạn, chưa công khai. Các liên kết menu ở đây chỉ minh họa; chọn trang trong trình dựng để xem từng trang.</p><PublicSite site={site} pageId={page.id} preview /></div> : null}
    {mode === "branding" ? <>
      {/* One fieldset per card (never nested), so the read-only line and its link stay outside the disabled controls. */}
      <div className="grid min-w-0 gap-5">
        <SettingsCard description="Logo hiện ở thanh bên ERP, favicon ở tab trình duyệt; cả hai cũng dùng cho website công khai." title="Nhận diện">
          <div className="grid gap-y-5">
            {centerName ? <div className="grid content-start gap-1.5">
              <span className="text-label font-medium text-text-strong">Tên trung tâm</span>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-text-strong">
                <span className="font-semibold">{centerName}</span>
                <GuardedLink className="text-secondary font-semibold text-action-link! underline-offset-2 hover:underline" href="/settings/general">{canManage ? "Sửa ở Cài đặt chung" : "Xem ở Cài đặt chung"}</GuardedLink>
              </div>
              <p className="text-caption text-text-muted">Tên, địa chỉ và liên hệ vận hành được quản lý ở Cài đặt chung, không lưu từ trang này.</p>
            </div> : null}
            <fieldset className="grid min-w-0 gap-x-6 gap-y-5 md:grid-cols-2" disabled={locked}>
              <ImageInput label="Logo" onChange={logo => editBrand({ logo })} resetSignal={resetSignal} value={site.branding.logo} />
              <ImageInput label="Favicon" onChange={favicon => editBrand({ favicon })} resetSignal={resetSignal} value={site.branding.favicon} />
              <TextAreaField className="md:col-span-2" hint="Hiện ở chân trang website công khai." label="Mô tả thương hiệu" onChange={description => editBrand({ description })} value={site.branding.description} />
            </fieldset>
          </div>
        </SettingsCard>
        <SettingsCard description="Áp dụng cho mọi nhân viên sau khi lưu. Mỗi người có thể chọn màu riêng trên trình duyệt của mình ở mục cuối trang; lựa chọn riêng được ưu tiên." title="Giao diện ERP">
          <fieldset className="grid min-w-0 gap-x-6 gap-y-5 lg:grid-cols-2" disabled={locked}>
            <AccentPicker onChange={appPalette => editBrand({ appPalette })} value={site.branding.appPalette} />
            <RadiusPicker onChange={rounded => editBrand({ rounded })} value={site.branding.rounded} />
            <ErpAppearancePreview className="lg:col-span-2" palette={site.branding.appPalette} rounded={site.branding.rounded} />
          </fieldset>
        </SettingsCard>
        <SettingsCard description="Chỉ dùng cho website công khai; áp dụng khi đăng phiên bản mới." title="Màu website">
          <fieldset className="grid min-w-0 gap-4" disabled={locked}>
            <TextInputField className="max-w-xs" hint="Dạng #RRGGBB." label="Mã màu HEX" onChange={color => editBrand({ color })} value={site.branding.color} />
            <div className="flex flex-wrap gap-2">{Object.entries(palettePresets).map(([key, color]) => <button aria-pressed={site.branding.color.toUpperCase() === color.toUpperCase()} className={cn("brand-choice", choiceSelectedClassName)} type="button" key={key} onClick={() => editBrand({ color })}><span aria-hidden="true" className="h-5 w-5 rounded-full" style={{ background: color }} />{paletteLabels[key as Palette]}</button>)}</div>
          </fieldset>
        </SettingsCard>
      </div>
      <PersonalAppearance apply={actions?.applyPersonalAppearance} />
    </> : <>
      <section className="brand-panel flex flex-wrap items-center justify-between gap-4"><div><h3>{published ? "Website đang công khai" : "Website chưa công khai"}</h3><p className="text-sm text-text-muted">Bản nháp được lưu riêng. Đăng sẽ thay toàn bộ website bằng phiên bản đã lưu.</p></div><div className="flex flex-wrap gap-2">{published ? <a className={getButtonClassName({ variant: "secondary" })} href="/site" target="_blank" rel="noreferrer">Mở website</a> : null}{canManage ? <><Button disabled={pending || dirty || version === 0} disabledReason={pending ? undefined : version === 0 ? "Lưu bản nháp lần đầu trước khi đăng." : dirty ? "Lưu thay đổi trước khi đăng." : undefined} onClick={() => setConfirmation("publish")} variant="secondary"><Globe aria-hidden="true" size={16} />Đăng phiên bản đã lưu</Button>{published ? <Button disabled={pending} onClick={() => setConfirmation("unpublish")} variant="danger-outline">Ngừng công khai</Button> : null}</> : null}</div>
        {confirmation ? <div className="w-full rounded-lg border border-border-strong p-4" role="alert"><p>{confirmation === "publish" ? "Mọi trang trong bản nháp đã lưu sẽ được công khai, gồm nội dung, hình ảnh và thông tin liên hệ. Anh xác nhận đăng?" : "Người ngoài sẽ không xem được website cho đến khi đăng lại. Bản nháp vẫn được giữ."}</p><div className="mt-3 flex gap-2"><Button onClick={() => run(confirmation)} variant={confirmation === "unpublish" ? "danger-outline" : "secondary"}>Xác nhận</Button><Button onClick={() => setConfirmation(null)} variant="ghost">Hủy</Button></div></div> : null}
        {publishResult ? <ResultBanner className="w-full" description={publishResult.ok ? undefined : publishResult.message} title={publishResult.ok ? publishResult.message : "Chưa thực hiện được."} tone={publishResult.ok ? "success" : "danger"} /> : null}
      </section>
      <fieldset disabled={locked} className="grid gap-6">
        <section className="brand-panel"><h3>Thông tin hiển thị công khai</h3><div className="grid gap-3 md:grid-cols-2"><Field label="Tên website" value={site.title} onChange={title => edit({ title })} /><Field label="Email liên hệ công khai" value={site.contactEmail} onChange={contactEmail => edit({ contactEmail })} /><Field label="Điện thoại công khai" value={site.contactPhone} onChange={contactPhone => edit({ contactPhone })} /><Field label="Địa chỉ công khai" value={site.address} onChange={address => edit({ address })} /></div><div className="mt-4 flex flex-wrap gap-4"><label className="brand-field">Kiểu chữ<select value={site.font} onChange={e => edit({ font: e.target.value as Website["font"] })}><option value="modern">Hiện đại · Be Vietnam Pro</option><option value="classic">Cổ điển · Tiêu đề serif</option></select></label><label className="brand-field">Hiệu ứng<select value={site.motion} onChange={e => edit({ motion: e.target.value as Website["motion"] })}><option value="none">Không chuyển động</option><option value="gentle">Hiện ra nhẹ nhàng</option></select></label></div></section>
        <section className="brand-panel"><div className="flex items-center justify-between gap-3"><h3>Các trang và khối nội dung</h3><button className="brand-choice" type="button" disabled={site.pages.length >= 12} onClick={addPage}><Plus size={18} />Thêm trang</button></div><label className="brand-field">Trang đang chỉnh<select value={page.id} onChange={e => setSelected(e.target.value)}>{site.pages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><div className="grid gap-3 md:grid-cols-2"><Field label="Tên trang" value={page.title} onChange={title => editPage({ title })} /><Field label="Địa chỉ sau /site/" value={page.slug} onChange={slug => editPage({ slug })} /></div><label className="my-4 flex gap-2"><input type="checkbox" checked={page.inMenu} onChange={e => editPage({ inMenu: e.target.checked })} />Hiện trang trong menu</label><p className="mb-4 text-sm text-text-muted">Ẩn khỏi menu không làm trang riêng tư. Chỉ đăng các trang dành cho công chúng.</p>
          <div className="grid gap-4">{page.blocks.map((b, i) => <section className="rounded-xl border border-border-subtle p-4" key={b.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong>Khối {i + 1} · {blockLabels[b.type]}</strong><div className="flex gap-1"><button type="button" className="brand-choice" aria-label={`Đưa khối ${i + 1} lên`} disabled={i === 0} onClick={() => moveBlock(i, -1)}><ArrowUp size={16} /></button><button type="button" className="brand-choice" aria-label={`Đưa khối ${i + 1} xuống`} disabled={i === page.blocks.length - 1} onClick={() => moveBlock(i, 1)}><ArrowDown size={16} /></button><button type="button" className="brand-choice" aria-label={`Bỏ khối ${i + 1} khỏi bản nháp`} disabled={page.blocks.length === 1} onClick={() => editPage({ blocks: page.blocks.filter(x => x.id !== b.id) })}><Trash2 size={16} /></button></div></div><Field label="Tiêu đề khối" value={b.title} onChange={title => editBlock(b.id, { title })} /><Field label="Nội dung" value={b.body} onChange={body => editBlock(b.id, { body })} multiline /><div className="my-4"><ImageInput label="Hình ảnh khối" onChange={image => editBlock(b.id, { image })} resetSignal={resetSignal} value={b.image} /></div><div className="grid gap-3 md:grid-cols-2"><Field label="Chữ trên nút liên kết" value={b.linkLabel} onChange={linkLabel => editBlock(b.id, { linkLabel })} /><Field label="Liên kết HTTPS" value={b.linkUrl} onChange={linkUrl => editBlock(b.id, { linkUrl })} /></div>{b.type === "contact" ? <p className="mt-2 text-sm text-text-muted">Khối này dùng thông tin liên hệ công khai đã nhập phía trên.</p> : null}</section>)}</div>
          <div className="mt-4 flex flex-wrap gap-2">{Object.entries(blockLabels).map(([type, label]) => <button className="brand-choice" type="button" disabled={page.blocks.length >= 20} key={type} onClick={() => editPage({ blocks: [...page.blocks, { id: crypto.randomUUID(), type: type as SiteBlock["type"], title: label, body: "", image: "", linkUrl: "", linkLabel: "" }] })}><Plus size={16} />{label}</button>)}</div>
          <button type="button" className="brand-choice mt-4" disabled={site.pages.length === 1} onClick={() => { const pages = site.pages.filter(p => p.id !== page.id); edit({ pages }); setSelected(pages[0].id); }}>Bỏ trang này khỏi bản nháp</button>
        </section>
        <section className="brand-panel"><h3>Liên kết menu và mạng xã hội</h3>{site.links.map((link, i) => <div className="mb-4 grid items-end gap-3 md:grid-cols-[1fr_2fr_1fr_auto]" key={i}><Field label="Chữ hiển thị" value={link.label} onChange={label => edit({ links: site.links.map((l, j) => i === j ? { ...l, label } : l) })} /><Field label="Địa chỉ HTTPS" value={link.url} onChange={url => edit({ links: site.links.map((l, j) => i === j ? { ...l, url } : l) })} /><label className="brand-field">Vị trí<select value={link.placement} onChange={e => edit({ links: site.links.map((l, j) => i === j ? { ...l, placement: e.target.value as typeof link.placement } : l) })}><option value="both">Đầu và cuối trang</option><option value="header">Đầu trang</option><option value="footer">Cuối trang</option></select></label><button className="brand-choice" type="button" onClick={() => edit({ links: site.links.filter((_, j) => i !== j) })}>Bỏ liên kết {i + 1}</button></div>)}<button className="brand-choice" disabled={site.links.length >= 10} type="button" onClick={() => edit({ links: [...site.links, { label: "Liên hệ", url: "", placement: "both" }] })}>Thêm liên kết</button></section>
      </fieldset>
    </>}
    {canManage ? <StickySaveBar
      changedLabels={changedLabels}
      cleanLabel={version === 0 ? "Chưa lưu lần nào" : undefined}
      dirtyCount={changedLabels.length}
      error={saveError ? <ResultBanner description={saveError} title="Chưa lưu được." tone="danger" /> : null}
      isSaving={pending}
      onCancel={cancel}
      onSave={() => run("save")}
      saveDisabled={pending || (!dirty && version > 0)}
      saveLabel="Lưu thay đổi"
      savingLabel="Đang xử lý…"
      statusMessage={saveMessage}
    /> : null}
  </div>;
}
const blockLabels: Record<SiteBlock["type"], string> = { hero: "Giới thiệu nổi bật", text: "Nội dung", image: "Hình ảnh", contact: "Liên hệ" };
function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) { return <label className="brand-field">{label}{multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} /> : <input value={value} onChange={e => onChange(e.target.value)} />}</label>; }

function TextInputField({ className, hint, label, onChange, value }: { className?: string; hint?: string; label: string; onChange: (value: string) => void; value: string }) {
  const id = useId();
  return <div className={cn("grid content-start gap-1.5", className)}>
    <label className="text-label font-medium text-text-strong" htmlFor={id}>{label}</label>
    <input aria-describedby={hint ? `${id}-hint` : undefined} className={controlClassName} id={id} onChange={e => onChange(e.target.value)} value={value} />
    {hint ? <p className="text-caption text-text-muted" id={`${id}-hint`}>{hint}</p> : null}
  </div>;
}

function TextAreaField({ className, hint, label, onChange, value }: { className?: string; hint?: string; label: string; onChange: (value: string) => void; value: string }) {
  const id = useId();
  return <div className={cn("grid content-start gap-1.5", className)}>
    <label className="text-label font-medium text-text-strong" htmlFor={id}>{label}</label>
    <textarea aria-describedby={hint ? `${id}-hint` : undefined} className={cn(controlClassName, "min-h-24 py-2")} id={id} maxLength={1000} onChange={e => onChange(e.target.value)} rows={4} value={value} />
    {hint ? <p className="text-caption text-text-muted" id={`${id}-hint`}>{hint}</p> : null}
  </div>;
}

/**
 * Logo, favicon and block images: PNG/JPEG/WebP up to 250 KB, kept inline with the draft.
 * `resetSignal` changes on Hủy: reads still in flight are dropped and the error clears.
 */
function ImageInput({ label, onChange, resetSignal, value }: { label: string; onChange: (value: string) => void; resetSignal: number; value: string }) {
  const id = useId();
  // The error belongs to the reset round it was raised in; Hủy hides it.
  const [errorState, setErrorState] = useState<{ message: string; round: number } | null>(null);
  const error = errorState?.round === resetSignal ? errorState.message : null;
  const setError = (message: string | null) => setErrorState(message ? { message, round: resetSignal } : null);
  // Each pick (or removal) starts a new request; a slower earlier read never lands after it.
  const requestRef = useRef(0);
  const roundRef = useRef(resetSignal);
  useEffect(() => {
    if (roundRef.current === resetSignal) return;
    roundRef.current = resetSignal;
    requestRef.current += 1;
  }, [resetSignal]);
  return <div className="grid content-start gap-1.5">
    <span className="text-label font-medium text-text-strong" id={`${id}-label`}>{label}</span>
    <div className="flex flex-wrap items-center gap-3">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-sunken text-text-subtle">
        {value ? <img alt={`Xem trước ${label}`} className="h-full w-full object-contain" src={value} /> : <ImageIcon aria-hidden="true" size={20} />}
      </div>
      <label className={cn(getButtonClassName({ variant: "secondary" }), "max-md:h-11 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus")}>
        {value ? "Chọn ảnh khác" : "Chọn ảnh"}
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          aria-labelledby={`${id}-label`}
          className="sr-only"
          onChange={e => {
            const file = e.currentTarget.files?.[0];
            // Clear at once so picking the same file again (after Bỏ ảnh or Hủy) fires a new change.
            e.currentTarget.value = "";
            if (!file) return;
            const request = ++requestRef.current;
            setError(null);
            if (file.size > 250 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Chọn PNG, JPEG hoặc WebP tối đa 250 KB."); return; }
            const reader = new FileReader();
            reader.onload = () => { if (request === requestRef.current) onChange(String(reader.result)); };
            reader.onerror = () => { if (request === requestRef.current) setError("Không đọc được ảnh. Hãy chọn lại."); };
            reader.readAsDataURL(file);
          }}
          type="file"
        />
      </label>
      {value ? <Button onClick={() => { requestRef.current += 1; onChange(""); }} variant="ghost">Bỏ ảnh</Button> : null}
    </div>
    <p className="text-caption text-text-muted" id={`${id}-hint`}>PNG, JPEG, WebP · tối đa 250 KB. Ảnh được lưu cùng nội dung, không cần dịch vụ ngoài.</p>
    {error ? <p className="text-caption text-danger" id={`${id}-error`} role="alert">{error}</p> : null}
  </div>;
}

/**
 * "Màu nhấn": the ERP accent (`appPalette`) for every staff member, one of the approved presets.
 * A radiogroup, not a nested fieldset (a second disabled fieldset would dim it twice).
 */
function AccentPicker({ onChange, value }: { onChange: (value: Palette) => void; value: Palette }) {
  const name = useId();
  return <div className="grid min-w-0 content-start gap-2">
    <span className="mb-1.5 text-label font-medium text-text-strong" id={`${name}-label`}>Màu nhấn</span>
    <div aria-labelledby={`${name}-label`} className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
      {(Object.keys(palettePresets) as Palette[]).map(key => <label
        className="flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border-strong px-3 text-body text-text-strong transition-colors duration-150 hover:bg-interactive-hover has-[:checked]:border-2 has-[:checked]:border-action-primary has-[:checked]:bg-action-primary-soft has-[:checked]:px-[11px] has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus"
        key={key}
      >
        <input checked={value === key} className="m-0 h-4 w-4 shrink-0 accent-[var(--action-primary)]" name={name} onChange={() => onChange(key)} type="radio" value={key} />
        <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-[6px]" style={{ background: palettePresets[key] }} />
        <span className="min-w-0 truncate">{paletteLabels[key]}</span>
        <span className="ml-auto text-caption tabular-nums text-text-muted">{palettePresets[key]}</span>
      </label>)}
    </div>
    <p className="text-caption text-text-muted">Màu trạng thái (thành công, cảnh báo, lỗi, thông tin) không đổi theo màu nhấn.</p>
  </div>;
}

/** "Bo góc": the existing `rounded` boolean as two named options. */
function RadiusPicker({ onChange, value }: { onChange: (value: boolean) => void; value: boolean }) {
  const name = useId();
  const options = [{ label: "Chuẩn", rounded: false }, { label: "Mềm", rounded: true }];
  return <div className="grid min-w-0 content-start gap-2">
    <span className="mb-1.5 text-label font-medium text-text-strong" id={`${name}-label`}>Bo góc</span>
    <div aria-labelledby={`${name}-label`} className="inline-flex justify-self-start overflow-hidden rounded-md border border-border-strong" role="radiogroup">
      {options.map((option, index) => <label
        className={cn(
          "flex h-11 cursor-pointer items-center px-4 text-body text-text-default transition-colors duration-150 hover:bg-interactive-hover has-[:checked]:bg-action-primary-soft has-[:checked]:font-semibold has-[:checked]:text-action-primary has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-border-focus md:h-10",
          index > 0 && "border-l border-border-strong",
        )}
        key={option.label}
      >
        <input checked={value === option.rounded} className="sr-only" name={name} onChange={() => onChange(option.rounded)} type="radio" />
        {option.label}
      </label>)}
    </div>
    <p className="text-caption text-text-muted">Chuẩn: góc 4/6/8 px. Mềm: góc 6/10/12 px. Cũng đổi kiểu bo góc của website công khai.</p>
  </div>;
}

/**
 * Live sample of the chosen accent and corners. The tokens are overridden on
 * this container only; the rest of the app changes after saving.
 */
function ErpAppearancePreview({ className, palette, rounded }: { className?: string; palette: Palette; rounded: boolean }) {
  const accent = palettePresets[palette];
  const style = {
    "--action-primary": accent,
    "--action-primary-hover": `color-mix(in srgb, ${accent} 85%, black)`,
    "--action-primary-soft": `color-mix(in srgb, ${accent} 8%, var(--surface-base))`,
    "--action-primary-soft-border": `color-mix(in srgb, ${accent} 24%, var(--surface-base))`,
    "--action-primary-shadow": `0 1px 2px color-mix(in srgb, ${accent} 18%, transparent)`,
    "--radius-sm": rounded ? "6px" : "4px",
    "--radius-md": rounded ? "10px" : "6px",
    "--radius-lg": rounded ? "12px" : "8px",
  } as CSSProperties;
  return <div className={cn("min-w-0 overflow-hidden rounded-lg border border-border-subtle", className)} style={style}>
    <p className="bg-surface-sunken px-3 py-2 text-caption font-semibold text-text-muted">Xem trước · cập nhật theo lựa chọn, chưa lưu</p>
    <div aria-hidden="true" className="flex flex-wrap items-center gap-4 bg-surface-canvas p-4">
      <div className="grid w-[200px] gap-0.5 rounded-[var(--radius-lg)] border border-border-subtle bg-surface-base p-2">
        <span className="flex h-9 items-center rounded-[var(--radius-md)] px-2 text-secondary text-text-default">Tổng quan</span>
        <span className="flex h-9 items-center rounded-[var(--radius-md)] bg-action-primary-soft px-2 text-secondary font-semibold text-action-primary shadow-[inset_3px_0_0_var(--action-primary)]">Học vụ</span>
        <span className="flex h-9 items-center rounded-[var(--radius-md)] px-2 text-secondary text-text-default">Tài chính</span>
      </div>
      <div className="grid gap-2">
        <span className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-action-primary px-[18px] text-body font-medium text-text-on-primary shadow-[var(--action-primary-shadow)]">Nút chính</span>
        <span className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-border-strong bg-surface-base px-[18px] text-body font-medium text-text-strong">Nút phụ</span>
      </div>
      <div className="grid justify-items-start gap-2">
        <Badge className="rounded-[var(--radius-sm)]" tone="success">Đã khóa</Badge>
        <Badge className="rounded-[var(--radius-sm)]" tone="warning">Chờ khóa</Badge>
        <Badge className="rounded-[var(--radius-sm)]" tone="danger">Quá hạn</Badge>
      </div>
      <div className="w-[280px] max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-surface-base text-secondary">
        <p className="bg-table-header px-3 py-2 text-caption font-semibold text-text-muted">Học sinh</p>
        <p className="flex h-10 items-center justify-between border-t border-border-row px-3"><span>Nguyễn Minh Anh</span><span className="font-semibold tabular-nums text-danger">2.400.000 ₫</span></p>
        <p className="flex h-10 items-center justify-between border-t border-border-row bg-action-primary-soft px-3"><span>Trần Gia Bảo</span><span className="tabular-nums">0 ₫</span></p>
      </div>
    </div>
  </div>;
}

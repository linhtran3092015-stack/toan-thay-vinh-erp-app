import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPublishedWebsite } from "@/features/website/data";
import { PublicSite } from "@/features/website/public-site";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await readPublishedWebsite();
  if (!result.success) return { title: "Trang chưa công khai", robots: { index: false, follow: false } };
  const page = result.data.pages.find(p => p.slug === slug);
  if (!page) return { title: "Không tìm thấy trang", robots: { index: false, follow: false } };
  return { title: `${page.title} | ${result.data.title}`, description: result.data.branding.description, icons: result.data.branding.favicon ? { icon: result.data.branding.favicon } : undefined };
}
export default async function PublicWebsitePage({ params }: Props) {
  const { slug } = await params;
  const result = await readPublishedWebsite();
  if (!result.success) notFound();
  const page = result.data.pages.find(p => p.slug === slug);
  if (!page) notFound();
  return <PublicSite site={result.data} pageId={page.id} />;
}

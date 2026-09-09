import { notFound, redirect } from "next/navigation";
import { readPublishedWebsite } from "@/features/website/data";
export const dynamic = "force-dynamic";
export default async function WebsiteHome() {
  const result = await readPublishedWebsite();
  if (!result.success) notFound();
  redirect(`/site/${result.data.pages[0].slug}`);
}

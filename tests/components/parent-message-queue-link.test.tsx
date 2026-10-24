// Value: protects=the queue shows the way to /parent-messages/groups only to staff who can link groups, and the not-connected banner points there;
// fails_when=the link shows for a send-only TA or the banner loses its link; why_new=testing review: ParentMessageQueue had no test for the new permission-bound UI;
// seam=none; no_claim=the page's own canLinkGroups derivation
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParentMessageQueue } from "@/features/parent-messages/components/parent-message-queue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/parent-messages/actions", () => ({
  sendParentMessageAction: vi.fn(),
  skipParentMessageAction: vi.fn(),
  updateParentMessageContentAction: vi.fn(),
}));

afterEach(cleanup);

describe("ParentMessageQueue group link", () => {
  it("shows the link and banner action only with canLinkGroups", () => {
    render(<ParentMessageQueue canLinkGroups canSend configured={false} items={[]} status="queued" />);
    const links = screen.getAllByRole("link", { name: /Liên kết nhóm Zalo/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/parent-messages/groups", "/parent-messages/groups"]);
    cleanup();

    render(<ParentMessageQueue canSend configured={false} items={[]} status="queued" />);
    expect(screen.queryByRole("link", { name: /Liên kết nhóm Zalo/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Đặt ZALOCRM_BASE_URL và ZALOCRM_API_KEY/)).toBeInTheDocument();
  });
});

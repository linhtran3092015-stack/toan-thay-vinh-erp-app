// Value: protects=the "Xuất CSV" dialog keeps the export route's field contract (a GET to the export href with ONLY dateFrom/dateTo: no hidden input, no named submit, so the route never answers 400 for an extra key), blocks an inverted range in the browser with one described field error (no alert, focus on "Đến ngày", no submit), lets a valid or blank range submit natively and then closes with focus back on the trigger, says the shared 1.000 cap, and in preview mode never submits but announces the notice;
// fails_when=a field is renamed or a hidden/named control is added, an inverted range reaches the route (raw JSON page), the error becomes an alert or loses aria-describedby, a valid submit is prevented (no download) or the form unmounts inside its own submit event, the copy drifts from SESSION_EXPORT_LIMIT, or the preview notice lets the form submit;
// why_new=step 14d (R4) replaces the inline form with this dialog; seam=a document-level submit listener records whether the dialog prevented the submit, then cancels it (jsdom cannot navigate); no_claim=what the route does with the query (reports-export-route.test.ts) or which cards show the trigger (reports-page.test.tsx)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SESSION_EXPORT_LIMIT } from "@/features/reports/catalog";
import { SessionExportDialog } from "@/features/reports/components/session-export-dialog";

const EXPORT_HREF = "/reports/export/sessions";
const NOTICE = "Bản xem trước không xuất dữ liệu.";
const INVERTED = "Đến ngày phải bằng hoặc sau Từ ngày.";

/** For each submit that reached the document: whether the dialog had prevented it. */
let submits: boolean[] = [];
function recordSubmit(event: Event) {
  submits.push(event.defaultPrevented);
  event.preventDefault();
}

beforeEach(() => {
  submits = [];
  document.addEventListener("submit", recordSubmit);
});

afterEach(() => {
  document.removeEventListener("submit", recordSubmit);
  cleanup();
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Xuất CSV: Danh sách buổi học" }));
  return screen.getByRole("dialog", { name: "Xuất danh sách buổi học" });
}

function setDates(dialog: HTMLElement, from: string, to: string) {
  fireEvent.change(within(dialog).getByLabelText("Từ ngày"), { target: { value: from } });
  fireEvent.change(within(dialog).getByLabelText("Đến ngày"), { target: { value: to } });
}

describe("SessionExportDialog", () => {
  it("opens from a secondary trigger into a GET form holding only dateFrom and dateTo", () => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} reportTitle="Danh sách buổi học" />);

    const trigger = screen.getByRole("button", { name: "Xuất CSV: Danh sách buổi học" });
    expect(trigger).toHaveTextContent("Xuất CSV");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).not.toHaveClass("bg-action-primary");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = openDialog();
    const form = dialog.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", EXPORT_HREF);

    const named = Array.from(form?.elements ?? []).filter((element) => element.getAttribute("name"));
    expect(named.map((element) => element.getAttribute("name"))).toEqual(["dateFrom", "dateTo"]);
    expect(within(dialog).getByLabelText("Từ ngày")).toHaveAttribute("type", "date");
    expect(within(dialog).getByLabelText("Đến ngày")).toHaveAttribute("type", "date");
    expect(form?.querySelector('input[type="hidden"]')).toBeNull();
    const submit = within(dialog).getByRole("button", { name: "Tải CSV" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).not.toHaveAttribute("name");
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toHaveAttribute("type", "button");
  });

  it("states the shared export cap and the file format", () => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} reportTitle="Danh sách buổi học" />);
    const dialog = openDialog();

    expect(SESSION_EXPORT_LIMIT).toBe(1000);
    expect(dialog).toHaveAccessibleDescription(
      "Tối đa 1.000 buổi có ngày mới nhất trong khoảng đã chọn. Để trống cả hai ngày: 1.000 buổi mới nhất, có thể gồm buổi đã lên lịch.",
    );
    expect(within(dialog).getByText("File CSV UTF-8, mở được bằng Excel.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("300");
  });

  it("blocks an inverted range with one described field error, focuses Đến ngày and never submits", async () => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} reportTitle="Danh sách buổi học" />);
    const dialog = openDialog();
    setDates(dialog, "2026-10-10", "2026-10-01");

    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));

    expect(submits).toEqual([true]);
    const dateTo = within(dialog).getByLabelText("Đến ngày");
    const error = within(dialog).getByText(INVERTED);
    expect(error.tagName).toBe("P");
    expect(error).not.toHaveAttribute("role");
    expect(dateTo).toHaveAttribute("aria-invalid", "true");
    expect(dateTo).toHaveAttribute("aria-describedby", error.id);
    expect(dateTo).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Correcting the range clears the error; the same day on both ends is valid.
    fireEvent.change(dateTo, { target: { value: "2026-10-10" } });
    expect(within(dialog).queryByText(INVERTED)).not.toBeInTheDocument();
    expect(dateTo).not.toHaveAttribute("aria-invalid");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));
    expect(submits).toEqual([true, false]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it.each([
    ["a full range", "2026-10-01", "2026-10-31"],
    ["a blank range", "", ""],
    ["only a start date", "2026-10-01", ""],
  ])("lets %s submit natively, then closes and returns focus to the trigger", async (_label, from, to) => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} reportTitle="Danh sách buổi học" />);
    const trigger = screen.getByRole("button", { name: "Xuất CSV: Danh sách buổi học" });
    const dialog = openDialog();
    setDates(dialog, from, to);
    const form = dialog.querySelector("form") as HTMLFormElement;

    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));

    expect(submits).toEqual([false]);
    // Still mounted right after the event: unmounting during submit would cancel the download.
    expect(form.isConnected).toBe(true);
    expect(Object.fromEntries(new FormData(form))).toEqual({ dateFrom: from, dateTo: to });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("closes from Đóng without submitting and opens again with empty fields", () => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} reportTitle="Danh sách buổi học" />);
    let dialog = openDialog();
    setDates(dialog, "2026-10-10", "2026-10-01");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submits).toEqual([true]);

    dialog = openDialog();
    expect(within(dialog).getByLabelText("Từ ngày")).toHaveValue("");
    expect(within(dialog).getByLabelText("Đến ngày")).toHaveValue("");
    expect(within(dialog).queryByText(INVERTED)).not.toBeInTheDocument();
  });

  it("in preview mode validates, then announces the notice instead of submitting", async () => {
    render(<SessionExportDialog exportHref={EXPORT_HREF} previewNotice={NOTICE} reportTitle="Danh sách buổi học" />);
    const dialog = openDialog();
    const status = within(dialog).getByRole("status");
    expect(status).toBeEmptyDOMElement();

    setDates(dialog, "2026-10-10", "2026-10-01");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));
    expect(within(dialog).getByText(INVERTED)).toBeInTheDocument();
    expect(status).toBeEmptyDOMElement();

    fireEvent.change(within(dialog).getByLabelText("Đến ngày"), { target: { value: "2026-10-31" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tải CSV" }));

    expect(submits).toEqual([true, true]);
    expect(status).toHaveTextContent(NOTICE);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

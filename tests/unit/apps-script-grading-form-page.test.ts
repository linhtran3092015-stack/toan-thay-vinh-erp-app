// Value: protects=the student name list on the Apps Script form (FormHocSinh.html): one list per birth year however many loads overlap;
// fails_when=a second answer for the same year (the saved-progress restore reloading a year the student already picked, or switching years while a load is pending) adds the names again after "Tên con không có trong danh sách", or a stale answer for another year replaces the list;
// why_new=duplicate list reported on 23/10/2026; seam=google.script.run stand-in whose answers the test releases one by one; no_claim=Code.gs (apps-script-grading-form.test.ts) and the real Apps Script runtime
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const HTML = readFileSync(path.join(process.cwd(), "integrations/apps-script/grading-form/FormHocSinh.html"), "utf8");

interface PendingCall {
  args: unknown[];
  failure?: (error: unknown) => void;
  name: string;
  success?: (value: unknown) => void;
}

function roster(names: string[]) {
  return { source: "erp", students: names.map((label, index) => ({ code: `TV-${label}-${index}`, label })) };
}

const opened: JSDOM[] = [];

afterEach(() => {
  for (const dom of opened.splice(0)) dom.window.close();
});

/** Loads the real form page with a google.script.run whose answers stay pending until the test sends them. */
async function openForm() {
  const pending: PendingCall[] = [];
  const runner = (success?: PendingCall["success"], failure?: PendingCall["failure"]): object =>
    new Proxy(
      {},
      {
        get(_target, name) {
          if (name === "withSuccessHandler") return (fn: PendingCall["success"]) => runner(fn, failure);
          if (name === "withFailureHandler") return (fn: PendingCall["failure"]) => runner(success, fn);
          return (...args: unknown[]) => pending.push({ args, failure, name: String(name), success });
        },
      },
    );
  const dom = new JSDOM(HTML, {
    beforeParse(window) {
      Object.defineProperty(window, "google", { value: { script: { get run() { return runner(); } } } });
    },
    pretendToBeVisual: true,
    runScripts: "dangerously",
    url: "https://script.google.com/macros/s/test/exec",
  });
  opened.push(dom);
  await new Promise((resolve) => (dom.window.document.readyState === "complete" ? resolve(null) : dom.window.addEventListener("load", resolve)));

  const document = dom.window.document;
  const take = (name: string, arg?: unknown) => {
    const index = pending.findIndex((call) => call.name === name && (arg === undefined || call.args[0] === arg));
    if (index < 0) throw new Error(`no pending ${name}(${String(arg ?? "")})`);
    return pending.splice(index, 1)[0];
  };
  return {
    answer(name: string, value: unknown, arg?: unknown) {
      take(name, arg).success?.(value);
    },
    count(name: string) {
      return pending.filter((call) => call.name === name).length;
    },
    names() {
      return [...(document.getElementById("hoTen") as HTMLSelectElement).options].map((option) => option.textContent);
    },
    pickYear(year: string) {
      const select = document.getElementById("namSinh") as HTMLSelectElement;
      select.value = year;
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    },
  };
}

const NOT_LISTED = "➕ Tên con không có trong danh sách";

describe("Apps Script form name list (FormHocSinh.html)", () => {
  it("shows the list once when the student picks a year before the birth years arrive", async () => {
    const form = await openForm();
    form.pickYear("2016");
    // The birth years arrive next; restoring the progress just saved asks for 2016 again.
    form.answer("getBirthYears", [2016, 2015]);
    expect(form.count("getStudentsByBirthYear")).toBe(2);
    form.answer("getStudentsByBirthYear", roster(["Mỹ Anh", "Bách", "Uyên"]), "2016");
    form.answer("getStudentsByBirthYear", roster(["Mỹ Anh", "Bách", "Uyên"]), "2016");
    expect(form.names()).toEqual(["-- Chọn họ tên --", "Mỹ Anh", "Bách", "Uyên", NOT_LISTED]);
  });

  it("keeps only the year picked last when the student switches years while a list is loading", async () => {
    const form = await openForm();
    form.answer("getBirthYears", [2016, 2015]);
    form.pickYear("2016");
    form.pickYear("2015");
    form.pickYear("2016");
    form.answer("getStudentsByBirthYear", roster(["Khải"]), "2015");
    form.answer("getStudentsByBirthYear", roster(["Mỹ Anh", "Bách"]), "2016");
    form.answer("getStudentsByBirthYear", roster(["Mỹ Anh", "Bách"]), "2016");
    expect(form.names()).toEqual(["-- Chọn họ tên --", "Mỹ Anh", "Bách", NOT_LISTED]);
  });

  it("uses the saved list when the student comes back to a year, without asking again", async () => {
    const form = await openForm();
    form.answer("getBirthYears", [2016, 2015]);
    form.pickYear("2016");
    form.answer("getStudentsByBirthYear", roster(["Mỹ Anh"]), "2016");
    form.pickYear("2015");
    form.answer("getStudentsByBirthYear", roster(["Khải"]), "2015");
    form.pickYear("2016");
    expect(form.count("getStudentsByBirthYear")).toBe(0);
    expect(form.names()).toEqual(["-- Chọn họ tên --", "Mỹ Anh", NOT_LISTED]);
  });
});

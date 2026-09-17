import { describe,it,expect } from "vitest";
import { careCommandSchema,careFilterSchema,careIsStale,careRuleLabels } from "@/features/student-care/models";
import { getVisibleNavigationDomains } from "@/config/navigation";

describe("student care contracts",()=>{
 it("keeps the latest-scored-test rule explicit in the interface",()=>{
  expect(careRuleLabels.low_test_streak).toBe("Hai bài có điểm gần nhất dưới 6");
 });
 it("does not treat missing or delayed worker results as a healthy empty list",()=>{
  expect(careIsStale(null)).toBe(true);
  const now=Date.parse("2026-09-17T10:00:00Z");
  expect(careIsStale("2026-09-17T09:54:59Z",now)).toBe(true);
  expect(careIsStale("2026-09-17T09:59:59Z",now)).toBe(false);
 });
 it("normalizes invalid list navigation without sending invalid dates/ids to SQL",()=>{
  expect(careFilterSchema.parse({page:"-5",month:"2026-13-01",student_id:"bad",kind:"unknown"})).toEqual({page:1});
 });
 it("requires a UUID request key and rejects unbounded contact notes",()=>{
  expect(careCommandSchema.safeParse({op:"claim",request_id:"bad"}).success).toBe(false);
  expect(careCommandSchema.safeParse({op:"contact",request_id:"11111111-1111-4111-8111-111111111111",note:"a".repeat(4001)}).success).toBe(false);
 });
 it("uses exact care permissions for navigation",()=>{
  expect(getVisibleNavigationDomains(["student_care.view"]).flatMap(d=>d.items).map(i=>i.href)).toEqual(["/student-care"]);
  expect(getVisibleNavigationDomains(["coaching.view"]).flatMap(d=>d.items).some(i=>i.href==="/student-care")).toBe(false);
 });
});

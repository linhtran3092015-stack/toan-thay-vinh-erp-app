"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { listZaloAccountsAction } from "@/features/parent-messages/actions";
import type { ZaloCrmAccount } from "@/lib/zalo-crm";

/** Picks the center's Zalo nick from ZaloCRM; stores id + display name as form fields. */
export function ZaloAccountPicker({ initialId, initialName }: { initialId: string; initialName: string }) {
  const [accounts, setAccounts] = useState<ZaloCrmAccount[] | null>(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedName, setSelectedName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    setError(null);
    startTransition(async () => {
      const result = await listZaloAccountsAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccounts(result.accounts);
    });
  };

  return (
    <div className="grid gap-1 text-sm md:col-span-2">
      <span className="font-medium">Nick trung tâm gửi tin</span>
      <input name="zaloCenterAccountId" type="hidden" value={selectedId} />
      <input name="zaloCenterAccountName" type="hidden" value={selectedName} />
      {accounts ? (
        <Select
          className="max-w-md"
          onChange={(event) => {
            const account = accounts.find((item) => item.id === event.target.value);
            setSelectedId(event.target.value);
            setSelectedName(account ? `${account.displayName ?? "Nick"}${account.phone ? ` (${account.phone})` : ""}` : "");
          }}
          value={selectedId}
        >
          <option value="">— Chưa chọn —</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName ?? "Nick"}
              {account.phone ? ` (${account.phone})` : ""} · {account.status === "connected" ? "đang kết nối" : account.status}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">{selectedName || (selectedId ? selectedId : "Chưa chọn nick")}</span>
          <Button disabled={isPending} isLoading={isPending} onClick={load} size="sm" type="button" variant="outline">
            Tải danh sách nick từ ZaloCRM
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <p className="text-xs text-ink-muted">Nick này phải có mặt trong các nhóm sổ liên lạc. Mỗi học sinh có thể dùng nick khác khi liên kết nhóm.</p>
    </div>
  );
}

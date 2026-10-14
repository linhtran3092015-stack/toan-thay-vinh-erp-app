"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { listZaloAccountsAction } from "@/features/parent-messages/actions";
import type { ZaloCrmAccount } from "@/lib/zalo-crm";

const LABEL = "Nick trung tâm gửi tin";
/** Shown when the list call itself fails (network, server crash) instead of answering. */
const CONNECTION_ERROR = "Không thể kết nối ZaloCRM.";

/**
 * Picks the center's Zalo nick from ZaloCRM; stores id + display name as form fields.
 * `listAccounts` replaces the ZaloCRM call (the /dev/settings preview passes a fixture).
 */
export function ZaloAccountPicker({
  initialId,
  initialName,
  listAccounts = listZaloAccountsAction,
}: {
  initialId: string;
  initialName: string;
  listAccounts?: typeof listZaloAccountsAction;
}) {
  const id = useId();
  const selectId = `${id}-select`;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [accounts, setAccounts] = useState<ZaloCrmAccount[] | null>(null);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedName, setSelectedName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const describedBy = error ? `${errorId} ${hintId}` : hintId;

  const load = () => {
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof listAccounts>>;
      try {
        result = await listAccounts();
      } catch {
        // A rejected call must not reach the error boundary: the form keeps what was typed.
        result = { message: CONNECTION_ERROR, ok: false };
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAccounts(result.accounts);
    });
  };

  return (
    <div className="grid gap-1.5 md:col-span-2">
      {accounts ? (
        <Label htmlFor={selectId} id={labelId}>{LABEL}</Label>
      ) : (
        <span className="text-label font-medium text-text-strong" id={labelId}>{LABEL}</span>
      )}
      <input name="zaloCenterAccountId" type="hidden" value={selectedId} />
      <input name="zaloCenterAccountName" type="hidden" value={selectedName} />
      {accounts ? (
        <Select
          aria-describedby={describedBy}
          className="max-w-md"
          id={selectId}
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
        <div aria-labelledby={labelId} className="flex flex-wrap items-center gap-2" role="group">
          <span className="text-body text-text-muted">{selectedName || (selectedId ? selectedId : "Chưa chọn nick")}</span>
          <Button aria-describedby={describedBy} disabled={isPending} isLoading={isPending} onClick={load} size="sm" type="button" variant="outline">
            Tải danh sách nick từ ZaloCRM
          </Button>
        </div>
      )}
      {error ? <p className="text-caption text-danger" id={errorId} role="alert">{error}</p> : null}
      <p className="text-caption text-text-muted" id={hintId}>Nick này phải có mặt trong các nhóm sổ liên lạc. Mỗi học sinh có thể dùng nick khác khi liên kết nhóm.</p>
    </div>
  );
}

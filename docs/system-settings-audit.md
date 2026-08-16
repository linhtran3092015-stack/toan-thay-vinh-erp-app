# System Settings audit — Wave C

Wave C deliberately exposes only safe, operational display/default values through a
typed registry. It is not a generic policy or secret-management system.

| Candidate | Current location | Class | Wave C action | Rationale |
| --- | --- | --- | --- | --- |
| Center/teacher display name, contact phone, email, address | UI literals and future display surfaces | A | `system_settings` typed values | Safe operational identity; no financial history changes. |
| Default public Coaching link expiry | `CoachingPublicLinkPanel` (7 days) | A | Typed setting and link-form default | Suggestion only; issued links retain their expiry. |
| Tuition notice title, announcement, footer and branding snapshot | `tuition_receipt_template_versions` | B | Keep versioned template ownership | Locked notices must reproduce their historical template. |
| Student tuition rates, tuition billing, session chargeability and credit | Wave A version/RPC model | B/D | Keep in their existing contracts | They affect immutable financial meaning. |
| Finance order cost, payroll, commission and refund formulae | Finance/payroll modules | B | Keep versioned/domain-owned | Not safe generic settings. |
| SePay receiving accounts | `sepay_receiving_account_versions` | B/C | Keep effective-dated catalog | Canonical account purpose identity, never a generic setting. |
| OAuth, Supabase service role, SePay API/webhook credentials | Environment/integration configuration | C | Excluded | Secrets must never enter database settings. |
| RBAC, RLS, token hashing, public route boundary, accounting timezone | Database/application contracts | D | Excluded | Security and integrity invariants. |
| Current class/session/ledger totals | Derived data | E | Excluded | Must be computed from canonical records. |

The registry accepts only known scalar keys. There is no arbitrary key creation,
raw JSON editor, public table access, or secret field.

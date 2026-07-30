interface ProcessRefundDialogProps {
  students: { id: string; name: string; publicCode: string }[];
}

// Kept as a compatibility boundary while the direct refund workflow is disabled.
export function ProcessRefundDialog(_props: ProcessRefundDialogProps) {
  void _props;
  return null;
}

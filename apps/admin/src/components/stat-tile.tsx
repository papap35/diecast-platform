import type { ReactNode } from 'react';

/** stat tile：標籤（句首大寫、無冒號）、數值（半粗體、比例數字）、補充說明 */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-1 p-5">
      <p className="text-xs font-medium text-mute">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="text-xs text-mute">{detail}</p> : null}
    </div>
  );
}

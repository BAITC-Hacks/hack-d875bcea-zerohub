import type { District } from "../types/simulation";
export function DistrictSelector({
  districts,
  selected,
  onChange,
  disabled,
}: {
  districts: District[];
  selected: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="field district-select">
      Target district
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

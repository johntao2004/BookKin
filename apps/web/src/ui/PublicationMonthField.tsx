import { useId } from "react";
import AntDatePicker from "antd/es/date-picker";
import dayjs from "dayjs";
import { formatPublicationDate, publicationMonth } from "../domain/publication-date";
import { InputActionGroup } from "./forms";
import { Button } from "./buttons";

const monthValue = (month: string) => dayjs().date(1).year(Number(month.slice(0, 4))).month(Number(month.slice(5, 7)) - 1);

/** Month precision without inventing a month for older year-only metadata. */
export function PublicationMonthField({ value, onChange, disabled, label = "出版日期" }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const month = publicationMonth(value);
  const legacyValue = Boolean(value.trim() && !month);
  const year = /^(\d{4})$/.exec(value.trim())?.[1];
  return <div className="bk-field">
    <label htmlFor={id} className="bk-field-label">{label}</label>
    <InputActionGroup>
      <AntDatePicker id={id} aria-label={label} picker="month" format={["YYYY年MM月", "YYYY-MM"]}
        value={month ? monthValue(month) : null} disabled={disabled} allowClear
        defaultPickerValue={year && Number(year) > 0 ? monthValue(`${year}-01`) : undefined}
        placeholder={legacyValue ? formatPublicationDate(value) : "请选择年月"}
        style={{ flex: "1 1 0", minWidth: 0 }}
        onChange={next => onChange(next ? next.format("YYYY-MM") : "")} />
      {legacyValue && <Button type="button" disabled={disabled} aria-label={`清除${label}`} onClick={() => onChange("")}>清除</Button>}
    </InputActionGroup>
  </div>;
}

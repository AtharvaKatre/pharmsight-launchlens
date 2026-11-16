import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { InputField, YearInput } from "../../api/types";
import { cellKey, formatFieldValue, INPUT_FIELDS, UNIT_LABEL, type FieldUnit } from "./fields";
import { normalizeInput, sameValue, validateValue } from "./validation";

interface InputGridProps {
  years: YearInput[];
  /** Last saved values, used to highlight edited cells. */
  saved: YearInput[];
  errors: Record<string, string>;
  readOnly: boolean;
  onChange: (yearIndex: number, field: InputField, value: string) => void;
}

const GROUPS = [...new Set(INPUT_FIELDS.map((f) => f.group))];

export function InputGrid({ years, saved, errors, readOnly, onChange }: InputGridProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  function focusCell(row: number, col: number) {
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)?.focus();
  }

  return (
    <div className="grid-scroll">
      <table className="input-grid" ref={tableRef}>
        <thead>
          <tr>
            <th scope="col" className="input-grid__corner">
              Assumption
            </th>
            {/* Two clocks: the calendar year (population, price, gross-to-net) and the year since
                launch (uptake). Years are sorted and 2027 is launch year 1. */}
            {years.map((y, col) => (
              <th scope="col" key={y.year} className="num">
                <span className="input-grid__year">{y.year}</span>
                <span className="input-grid__launch-year" aria-hidden="true" title={`Launch year ${col + 1}`}>
                  Y{col + 1}
                </span>
                <span className="sr-only"> (launch year {col + 1})</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <Fragment key={group}>
              <tr className="input-grid__group">
                <th scope="rowgroup" colSpan={years.length + 1}>
                  <span className="input-grid__group-label">{group}</span>
                </th>
              </tr>
              {INPUT_FIELDS.filter((f) => f.group === group).map((field) => {
                const row = INPUT_FIELDS.indexOf(field);
                return (
                  <tr key={field.key}>
                    <th scope="row" className="input-grid__label" title={field.help}>
                      <span>{field.label}</span>
                      {UNIT_LABEL[field.unit] && <span className="input-grid__unit">{UNIT_LABEL[field.unit]}</span>}
                    </th>
                    {years.map((y, col) => {
                      const key = cellKey(y.year, field.key);
                      return (
                        <td key={key}>
                          <GridCell
                            value={y[field.key]}
                            changed={!sameValue(y[field.key], saved[col]?.[field.key])}
                            unit={field.unit}
                            error={errors[key]}
                            readOnly={readOnly}
                            label={`${field.label}, ${y.year}`}
                            row={row}
                            col={col}
                            onChange={(value) => onChange(col, field.key, value)}
                            onNavigate={focusCell}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GridCellProps {
  value: string;
  changed: boolean;
  unit: FieldUnit;
  error?: string;
  readOnly: boolean;
  label: string;
  row: number;
  col: number;
  onChange: (value: string) => void;
  onNavigate: (row: number, col: number) => void;
}

function GridCell({ value, changed, unit, error, readOnly, label, row, col, onChange, onNavigate }: GridCellProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = validateValue(unit, value) === null;

  // Formatted when idle; the exact raw value while editing (or when it can't be formatted).
  const display = focused || !valid ? value : formatFieldValue(unit, value);
  const exact = normalizeInput(value);
  const title = error ?? (valid && !focused && display.replace(/[,$%]/g, "") !== exact ? `Exact value: ${exact}` : undefined);

  useEffect(() => {
    if (focused) inputRef.current?.select();
  }, [focused]);

  if (readOnly) {
    return (
      <span className="grid-cell grid-cell--readonly" title={title}>
        {display}
      </span>
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      onNavigate(row + (event.shiftKey && event.key === "Enter" ? -1 : 1), col);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onNavigate(row - 1, col);
    }
  }

  const className = ["grid-cell", changed && "is-changed", error && "is-invalid"].filter(Boolean).join(" ");

  return (
    <>
      <input
        ref={inputRef}
        className={className}
        value={display}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={title}
        data-row={row}
        data-col={col}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
    </>
  );
}

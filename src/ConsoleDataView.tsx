import { useState } from "react";
import type { ConsoleData } from "./preview-document";

const isRecord = (value: ConsoleData): value is Record<string, ConsoleData> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function ConsoleJsonNode({
  value,
  label,
  expanded = false,
}: {
  value: ConsoleData;
  label?: string;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(expanded);
  const [limit, setLimit] = useState(24);
  const name =
    label === undefined ? null : (
      <span className="console-json-key">{label}: </span>
    );
  if (value === null || typeof value !== "object") {
    return (
      <code
        className="console-json-value"
        data-kind={value === null ? "null" : typeof value}
      >
        {name}
        {JSON.stringify(value)}
      </code>
    );
  }
  const entries = Object.entries(value);
  const summary = `${Array.isArray(value) ? "Array" : "Object"} (${entries.length})`;
  if (!entries.length)
    return (
      <code>
        {name}
        {summary}
      </code>
    );
  return (
    <details
      className="console-json-node"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {name}
        <span>{summary}</span>
      </summary>
      {open && (
        <div className="console-json-children">
          {entries.slice(0, limit).map(([key, item]) => (
            <div key={key}>
              <ConsoleJsonNode value={item} label={key} />
            </div>
          ))}
          {entries.length > limit && (
            <button
              className="console-show-more"
              onClick={() => setLimit((count) => count + 50)}
            >
              Show {Math.min(50, entries.length - limit)} more
            </button>
          )}
        </div>
      )}
    </details>
  );
}

export function ConsoleTable({
  data,
}: {
  data: ConsoleData[] | Record<string, ConsoleData>;
}) {
  const [limit, setLimit] = useState(50);
  const entries = Object.entries(data);
  const rows = entries.slice(0, limit);
  const columns = [
    ...new Set(
      rows.flatMap(([, row]) => (isRecord(row) ? Object.keys(row) : [])),
    ),
  ].slice(0, 16);
  const showValue = !columns.length || rows.some(([, row]) => !isRecord(row));
  if (!rows.length) return <code>No rows.</code>;
  return (
    <div
      className="console-table-scroll"
      tabIndex={0}
      aria-label="Scrollable console table"
    >
      <table className="console-data-table" aria-label="Console data">
        <thead>
          <tr>
            <th scope="col">{Array.isArray(data) ? "Index" : "Key"}</th>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
            {showValue && <th scope="col">Value</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, row]) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              {columns.map((column) => (
                <td key={column}>
                  {isRecord(row) && Object.hasOwn(row, column) && (
                    <ConsoleJsonNode value={row[column]} />
                  )}
                </td>
              ))}
              {showValue && (
                <td>
                  {(!isRecord(row) || !columns.length) && (
                    <ConsoleJsonNode value={row} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length > limit && (
        <button
          className="console-show-more"
          onClick={() => setLimit((count) => count + 50)}
        >
          Show {Math.min(50, entries.length - limit)} more rows
        </button>
      )}
    </div>
  );
}

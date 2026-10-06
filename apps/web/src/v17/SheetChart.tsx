import {
  rangeCells,
  columnName,
  sheetEvaluator,
  type Sheet,
  type SheetChart,
} from "../../../../packages/product/src/sheet";
export default function Chart({
  sheet,
  chart,
}: {
  sheet: Sheet;
  chart: SheetChart;
}) {
  const range = rangeCells(sheet, chart.range),
    value = sheetEvaluator(sheet);
  const data = Array.from({ length: range.bottom - range.top }, (_, i) => {
    const row = range.top + i + 2;
    return {
      label: String(value(columnName(range.left) + row)),
      value: value(columnName(range.left + 1) + row),
    };
  }).filter(
    (d): d is { label: string; value: number } => typeof d.value === "number",
  );
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value))),
    total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const colors = ["#8b7bd8", "#5a9ac2", "#59ac96", "#df9c63", "#ce80aa"];
  let angle = 0;
  return (
    <figure className="sheet-chart">
      <figcaption>{chart.title}</figcaption>
      {!data.length ? (
        <p>Nessun valore numerico nell’intervallo.</p>
      ) : (
        <svg
          viewBox="0 0 600 260"
          role="img"
          aria-label={`${chart.title}, grafico ${chart.type}`}
        >
          {chart.type === "pie" ? (
            data.map((d, i) => {
              if (d.value <= 0 || !total) return null;
              const start = angle;
              angle += (d.value / total) * Math.PI * 2;
              const x = (a: number) => 180 + 100 * Math.cos(a),
                y = (a: number) => 130 + 100 * Math.sin(a);
              return d.value === total ? (
                <circle key={i} cx="180" cy="130" r="100" fill={colors[i % 5]}>
                  <title>
                    {d.label}: {d.value}
                  </title>
                </circle>
              ) : (
                <path
                  key={i}
                  d={`M180 130 L${x(start)} ${y(start)} A100 100 0 ${angle - start > Math.PI ? 1 : 0} 1 ${x(angle)} ${y(angle)} Z`}
                  fill={colors[i % 5]}
                >
                  <title>
                    {d.label}: {d.value}
                  </title>
                </path>
              );
            })
          ) : (
            <>
              <line x1="30" y1="130" x2="580" y2="130" stroke="currentColor" />
              {chart.type === "line" && (
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  points={data
                    .map(
                      (d, i) =>
                        `${40 + (i * 530) / Math.max(1, data.length - 1)},${130 - (d.value / max) * 100}`,
                    )
                    .join(" ")}
                />
              )}
              {data.map((d, i) => {
                const x =
                    40 +
                    (i * 530) /
                      (chart.type === "bar"
                        ? data.length
                        : Math.max(1, data.length - 1)),
                  y = 130 - (d.value / max) * 100;
                return (
                  <g key={i}>
                    {chart.type === "bar" ? (
                      <rect
                        x={x}
                        y={Math.min(130, y)}
                        width={Math.max(1, 430 / data.length)}
                        height={Math.abs(y - 130)}
                        fill={colors[i % 5]}
                      />
                    ) : (
                      <circle cx={x} cy={y} r="4" fill="var(--accent)" />
                    )}
                    <title>
                      {d.label}: {d.value}
                    </title>
                    {data.length <= 12 && (
                      <text x={x} y="250" fontSize="12" fill="currentColor">
                        {d.label.slice(0, 14)}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </svg>
      )}
      <details>
        <summary>Dati del grafico</summary>
        <table>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <th>{d.label}</th>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

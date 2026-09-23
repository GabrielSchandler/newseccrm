/**
 * Graficos SVG leves, sem biblioteca externa — mesma linha do resto do
 * shell novo (ver dashboards-workspace.tsx). So visual, sem interacao.
 */

export function MiniLineChart({
  valores,
  rotulos,
  width = 300,
  height = 90,
}: {
  valores: number[];
  rotulos: string[];
  width?: number;
  height?: number;
}) {
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const range = max - min || 1;
  const passoX = width / Math.max(valores.length - 1, 1);
  const pontos = valores.map((valor, index) => {
    const x = index * passoX;
    const y = height - ((valor - min) / range) * (height - 12) - 6;
    return { x, y };
  });
  const linha = pontos.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${height} ${linha} ${width},${height}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <polygon points={area} fill="var(--ns-primary)" opacity="0.12" />
        <polyline points={linha} fill="none" stroke="var(--ns-primary)" strokeWidth="2" />
        {pontos.map((p, index) => (
          <circle key={index} cx={p.x} cy={p.y} r="2.5" fill="var(--ns-primary)" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--ns-text-secondary)]">
        {rotulos.map((rotulo) => (
          <span key={rotulo}>{rotulo}</span>
        ))}
      </div>
    </div>
  );
}

export function MiniBarChart({
  valores,
  rotulos,
  height = 90,
}: {
  valores: number[];
  rotulos: string[];
  height?: number;
}) {
  const max = Math.max(...valores, 1);

  return (
    <div className="flex items-end gap-2" style={{ height: height + 18 }}>
      {valores.map((valor, index) => (
        <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-[var(--ns-primary)]"
            style={{ height: `${Math.max((valor / max) * height, 3)}px` }}
          />
          <span className="text-[10px] text-[var(--ns-text-secondary)]">{rotulos[index]}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniDonutChart({
  percentual,
  tamanho = 84,
  espessura = 10,
}: {
  percentual: number;
  tamanho?: number;
  espessura?: number;
}) {
  const raio = (tamanho - espessura) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = (percentual / 100) * circunferencia;

  return (
    <svg viewBox={`0 0 ${tamanho} ${tamanho}`} width={tamanho} height={tamanho}>
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        stroke="var(--ns-surface-hover)"
        strokeWidth={espessura}
      />
      <circle
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        fill="none"
        stroke="var(--ns-primary)"
        strokeWidth={espessura}
        strokeDasharray={`${preenchido} ${circunferencia - preenchido}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="600"
        fill="var(--ns-text)"
      >
        {percentual}%
      </text>
    </svg>
  );
}

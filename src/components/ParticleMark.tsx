export function ParticleMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? 'particle-mark compact' : 'particle-mark'} aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => <i key={index} />)}
    </span>
  );
}

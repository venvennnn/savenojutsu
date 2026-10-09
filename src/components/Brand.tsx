export function LeafMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#234D3C" />
      <path
        d="M32 12c10 12 18 26 10 38-10 14-28 10-30-4 12 0 22-14 20-34z"
        fill="#8BBF62"
      />
      <path d="M31 18c1 14 2 24 8 32" stroke="#FBF8F0" strokeWidth="2" fill="none" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LeafMark className={compact ? "h-8 w-8" : "h-11 w-11"} />
      <div>
        <p className="font-serif text-xl text-forest">Save no Jutsu</p>
        {!compact ? (
          <p className="text-sm text-muted">The hidden art of understanding what you save.</p>
        ) : null}
      </div>
    </div>
  );
}

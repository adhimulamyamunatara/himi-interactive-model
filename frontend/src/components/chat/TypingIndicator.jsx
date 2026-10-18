export default function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-sm text-slate-500">HIMI is typing</span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.24s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.12s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" />
      </span>
    </div>
  );
}
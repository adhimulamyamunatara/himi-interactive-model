export default function AssistantAvatar() {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-400 shadow-soft">
      <div className="absolute inset-3 rounded-[1.5rem] border border-white/30 bg-white/10" />
      <div className="relative flex flex-col items-center text-white">
        <span className="text-4xl font-black tracking-tight">H</span>
        <span className="mt-1 text-xs uppercase tracking-[0.35em]">HIMI</span>
      </div>
    </div>
  );
}
export default function ChatMessage({ role = 'assistant', text }) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? 'bg-slate-900 text-white'
            : 'border border-slate-200 bg-white text-slate-700'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
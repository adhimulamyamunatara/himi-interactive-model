/**
 * Numbered grid showing which questions are answered. Clicking a number jumps to that question.
 */
export default function QuizNavigator({ questions, answers, currentIndex, onSelect }) {
  return (
    <nav aria-label="Question navigator">
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((question, index) => {
          const answered = Number.isInteger(answers[question.id]);
          const current = index === currentIndex;

          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={current ? 'step' : undefined}
                aria-label={`Question ${index + 1}, ${answered ? 'answered' : 'not answered'}${current ? ', current question' : ''}`}
                className={`flex h-10 w-full items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${
                  answered
                    ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-dashed border-slate-300 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                } ${current ? 'ring-2 ring-violet-500 ring-offset-2' : ''}`}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

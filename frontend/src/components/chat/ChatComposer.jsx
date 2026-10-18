import Button from '../common/Button';
import Input from '../common/Input';
import { FiMic, FiSend } from 'react-icons/fi';

export default function ChatComposer() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Input placeholder="Ask HIMI anything about engineering topics..." aria-label="Message" />
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 lg:flex-none">
            <FiMic /> Voice
          </Button>
          <Button className="flex-1 lg:flex-none">
            Send <FiSend />
          </Button>
        </div>
      </div>
    </div>
  );
}
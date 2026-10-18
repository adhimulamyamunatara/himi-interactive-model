import { useState } from 'react';
import { FiEdit3, FiMail, FiSave, FiUser } from 'react-icons/fi';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Textarea from '../components/common/Textarea';
import { useUser } from '../context/UserContext';

export default function Profile() {
  const { user, updateProfile } = useUser();
  const [name, setName] = useState(user?.name || 'Bhargav');
  const [email, setEmail] = useState(user?.email || 'student@himi.ai');
  const [college, setCollege] = useState(user?.college || '');
  const [branch, setBranch] = useState(user?.branch || '');
  const [semester, setSemester] = useState(user?.semester || '');
  const [learningGoal, setLearningGoal] = useState(user?.learningGoal || '');

  const handleSave = (event) => {
    event.preventDefault();
    updateProfile({ name, email, college, branch, semester, learningGoal });
  };

  return (
    <section className="section-shell py-10 lg:py-14">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center text-center">
          <Avatar name={name} size="xl" />
          <h1 className="mt-6 text-3xl font-bold text-slate-950">{name}</h1>
          <p className="mt-2 text-sm text-slate-500">Editable profile shell</p>
          <div className="mt-8 w-full space-y-3 text-left text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Student account</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Local storage only</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">No backend persistence</div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-xl text-blue-600">
              <FiEdit3 />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">Profile</p>
              <h2 className="text-2xl font-bold text-slate-950">Editable student details</h2>
            </div>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSave}>
            <div className="grid gap-5 md:grid-cols-2">
              <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} icon={FiUser} />
              <Input
                label="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                icon={FiMail}
                type="email"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Input label="College" value={college} onChange={(event) => setCollege(event.target.value)} />
              <Input label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Select label="Semester" value={semester} onChange={(event) => setSemester(event.target.value)}>
                <option value="">Select semester</option>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((item) => (
                  <option key={item} value={item}>
                    Semester {item}
                  </option>
                ))}
              </Select>
              <Input
                label="Learning Goal"
                value={learningGoal}
                onChange={(event) => setLearningGoal(event.target.value)}
              />
            </div>

            <Textarea
              label="Bio"
              rows={5}
              value={`Focused on ${learningGoal || 'structured learning'} with HIMI.`}
              readOnly
            />

            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                <FiSave /> Save Profile
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => updateProfile({ name, email, college, branch, semester, learningGoal })}
              >
                Save Locally
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </section>
  );
}

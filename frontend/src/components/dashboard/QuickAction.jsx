import Button from '../common/Button';

export default function QuickAction({ icon, label }) {
  return (
    <Button variant="secondary" className="justify-start">
      {icon}
      {label}
    </Button>
  );
}
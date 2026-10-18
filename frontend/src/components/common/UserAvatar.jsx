import { useUser } from '../../context/UserContext';
import Avatar from './Avatar';

/** The signed-in student's avatar. Every page uses this so a photo or colour change shows up everywhere at once. */
export default function UserAvatar({ size = 'md', className = '' }) {
  const { user } = useUser();

  return <Avatar name={user?.name} image={user?.avatarImage} color={user?.avatarColor} size={size} className={className} />;
}

import { useContext } from 'react';
import { ProfileContext } from '../context/ProfileContext';

const useAuth = () => {
  const { profile, setProfile, fetchProfile } = useContext(ProfileContext);
  return {
    user: profile,
    profile,
    setProfile,
    fetchProfile
  };
};

export default useAuth;

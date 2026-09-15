import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function RankingAdmin() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/archypage#tab=countries&section=ranking', { replace: true });
  }, [navigate]);

  return <div className="flex min-h-screen items-center justify-center bg-paper"><Loader2 className="animate-spin text-emerald-600" size={28} /></div>;
}

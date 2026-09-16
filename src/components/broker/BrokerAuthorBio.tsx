import type { TeamMember } from '../../lib/team';
import Monogram from '../Monogram';

interface Props {
  reviewer: TeamMember;
}

export default function BrokerAuthorBio({ reviewer }: Props) {
  return (
    <section className="mt-8 rounded-3xl border border-line bg-white p-6 sm:p-8" aria-labelledby="broker-author-bio">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Monogram name={reviewer.penName} color={reviewer.color} size={56} className="shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Reviewed by</p>
          <h2 id="broker-author-bio" className="mt-1 font-display text-xl font-bold text-ink-900">{reviewer.penName}</h2>
          <p className="mt-0.5 text-sm font-semibold text-emerald-700">{reviewer.role}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">{reviewer.bio}</p>
        </div>
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import { avatarUrl, type Artist, type Booking } from '../../api';
import { Avatar, StatusPill } from '../../ui';
import { dayNum, duration, monthShort, WEEKDAYS_SHORT, weekdayOf } from '../../util';

export function RatingText({ artist }: { artist: Artist }) {
  if (!artist.rating) return <span className="text-sm font-medium text-muted">Novo no app</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-base text-ink">
      <Star size={18} className="text-accent" fill="currentColor" />
      {artist.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
      <span className="text-muted">({artist.reviewsCount})</span>
    </span>
  );
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link to={`/artistas/${artist.id}`} className="card flex items-center gap-3 p-4 transition active:scale-[0.99] min-[380px]:gap-4 min-[380px]:p-5">
      <Avatar name={artist.name} size="lg" src={avatarUrl(artist)} />
      <div className="min-w-0 flex-1">
        <p className="break-words text-lg font-bold leading-snug">{artist.name}</p>
        <p className="break-words text-base text-muted">
          {artist.style}
          {artist.years > 0 && ` · ${artist.years} ${artist.years === 1 ? 'ano' : 'anos'}`}
        </p>
        <div className="mt-1">
          {artist.available ? <RatingText artist={artist} /> : <span className="text-sm font-medium text-warn">{artist.unavailableNote || 'Indisponível'}</span>}
        </div>
      </div>
      <ChevronRight className="shrink-0 text-soft" />
    </Link>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Link to={`/agenda/${booking.id}`} className="card flex items-center gap-3 p-4 transition active:scale-[0.99] min-[380px]:gap-4">
      <div className="flex w-[3.75rem] shrink-0 flex-col items-center rounded-2xl bg-surface2 py-2.5">
        <span className="text-sm text-muted">{WEEKDAYS_SHORT[weekdayOf(booking.date)]}</span>
        <span className="font-display text-3xl font-extrabold leading-none">{dayNum(booking.date)}</span>
        <span className="text-sm uppercase text-muted">{monthShort(booking.date)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-lg font-bold">{booking.service.name}</p>
        <p className="break-words text-base text-muted">
          {booking.artist.name} · {booking.time} · {duration(booking.durationMin)}
        </p>
        <div className="mt-2">
          <StatusPill status={booking.status} />
        </div>
      </div>
    </Link>
  );
}

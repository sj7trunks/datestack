import { format, isToday, isTomorrow, isYesterday } from 'date-fns'
import type { CalendarEvent, AgendaItem } from '../api/client'
import AgendaList from './AgendaList'
import EventCard from './EventCard'

interface CalendarViewProps {
  date: Date
  events: CalendarEvent[]
  agendaItems: AgendaItem[]
  timezone: string
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE')
}

export default function CalendarView({ date, events, agendaItems, timezone }: CalendarViewProps) {
  const dateLabel = getDateLabel(date)
  const dateFormatted = format(date, 'MMM d')
  const today = isToday(date)

  return (
    <div className={`rounded-lg ${today ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
      {/* Date header */}
      <div className={`px-4 py-3 border-b ${today ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-semibold ${today ? 'text-blue-900 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
            {dateLabel}
          </span>
          <span className={`text-sm ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {dateFormatted}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Agenda items first */}
        {agendaItems.length > 0 && (
          <div>
            <AgendaList items={agendaItems} date={format(date, 'yyyy-MM-dd')} />
          </div>
        )}

        {/* Events */}
        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} timezone={timezone} />
            ))}
          </div>
        ) : agendaItems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No events</p>
        ) : null}
      </div>
    </div>
  )
}

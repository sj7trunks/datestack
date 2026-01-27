import { useState } from 'react'
import { parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import type { CalendarEvent } from '../api/client'

interface EventCardProps {
  event: CalendarEvent
  timezone: string
}

export default function EventCard({ event, timezone }: EventCardProps) {
  const [expanded, setExpanded] = useState(false)

  const startTime = parseISO(event.start_time)
  const endTime = event.end_time ? parseISO(event.end_time) : null

  const formatTime = (date: Date) => formatInTimeZone(date, timezone, 'h:mm a')

  const timeDisplay = event.all_day
    ? 'All day'
    : endTime
      ? `${formatTime(startTime)} - ${formatTime(endTime)}`
      : formatTime(startTime)

  const hasDetails = event.location || event.notes

  return (
    <div
      className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
      style={{ borderLeftColor: event.source_color, borderLeftWidth: '4px' }}
    >
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full text-left px-3 py-2 ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''}`}
        disabled={!hasDetails}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-600 dark:text-gray-400">{timeDisplay}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {event.calendar_name || event.source_name}
              </span>
            </div>
          </div>
          {hasDetails && (
            <svg
              className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {expanded && hasDetails && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-2">
          {event.location && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-300">{event.location}</span>
            </div>
          )}
          {event.notes && (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <div
                className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: event.notes }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

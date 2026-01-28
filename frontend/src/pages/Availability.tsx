import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { getPublicAvailability } from '../api/client'

export default function Availability() {
  const { token } = useParams<{ token: string }>()

  const { data: availability, isLoading, error } = useQuery({
    queryKey: ['publicAvailability', token],
    queryFn: () => getPublicAvailability(token!),
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !availability) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Availability Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This availability link is invalid or has been disabled.
          </p>
        </div>
      </div>
    )
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEEE')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Availability</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Working hours: {formatHour(availability.start_hour)} - {formatHour(availability.end_hour)}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {availability.days.map((day) => (
            <div
              key={day.date}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {getDateLabel(day.date)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {format(parseISO(day.date), 'MMM d')}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex gap-2 overflow-x-auto">
                  {(() => {
                    const hourGroups: Record<string, typeof day.slots> = {}
                    day.slots.forEach((slot) => {
                      const slotTime = parseISO(slot.start)
                      const hourKey = format(slotTime, 'h a')
                      if (!hourGroups[hourKey]) hourGroups[hourKey] = []
                      hourGroups[hourKey].push(slot)
                    })
                    return Object.entries(hourGroups).map(([hour, slots]) => (
                      <div key={hour} className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{hour}</span>
                        {slots.map((slot, i) => {
                          const slotTime = parseISO(slot.start)
                          const timeLabel = format(slotTime, 'h:mm')
                          return (
                            <div
                              key={i}
                              className={`px-2 py-1.5 text-xs rounded text-center min-w-[3.5rem] ${
                                slot.status === 'free'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              }`}
                              title={slot.status === 'free' ? 'Available' : 'Busy'}
                            >
                              {timeLabel}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30"></div>
                    <span>Busy</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Powered by DateStack
        </div>
      </main>
    </div>
  )
}

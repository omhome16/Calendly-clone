import { format, parseISO } from 'date-fns'

export const formatDisplayDate = (isoStr) => {
  return format(parseISO(isoStr), 'EEEE, d MMMM yyyy')
}

export const formatTime = (isoStr) => {
  return format(parseISO(isoStr), 'h:mm a')
}

export const formatTimeRange = (startIso, endIso) => {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`
}

export const toDateString = (date) => format(date, 'yyyy-MM-dd')

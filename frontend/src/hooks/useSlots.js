import { useQuery } from '@tanstack/react-query'
import { slotsApi } from '../api'

export function useSlots(slug, date) {
  return useQuery({
    queryKey: ['slots', slug, date],
    queryFn: () => slotsApi.getSlots(slug, date),
    enabled: !!slug && !!date,
  })
}

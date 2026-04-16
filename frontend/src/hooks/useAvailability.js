import { useQuery } from '@tanstack/react-query'
import { availabilityApi } from '../api'

export function useAvailability() {
  return useQuery({
    queryKey: ['availability'],
    queryFn: availabilityApi.get,
  })
}

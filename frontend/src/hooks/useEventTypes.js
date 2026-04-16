import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '../api'

export function useEventTypes() {
  return useQuery({
    queryKey: ['event-types'],
    queryFn: eventTypesApi.list,
    staleTime: 1000 * 60,
  })
}

export function useCreateEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: eventTypesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-types'] }),
  })
}

export function useUpdateEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => eventTypesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-types'] }),
  })
}

export function useDeleteEventType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: eventTypesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-types'] }),
  })
}

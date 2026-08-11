import { OrderStatus } from "@workspace/api-client-react"

export const getStatusColor = (status: OrderStatus) => {
  switch (status) {
    case 'NEW':
      return 'info'
    case 'WAITING_PHOTOGRAPHY':
    case 'WAITING_EDITING':
    case 'WAITING_PRINT':
      return 'warning'
    case 'IN_PHOTOGRAPHY':
    case 'EDITING':
    case 'PRINTING':
      return 'secondary'
    case 'READY_FOR_DELIVERY':
      return 'success'
    case 'DELIVERED':
      return 'default'
    case 'CANCELLED':
      return 'destructive'
    default:
      return 'default'
  }
}

export const formatCurrency = (amount: number | string) => {
  return `${parseFloat(String(amount)).toFixed(2)} EGP`
}

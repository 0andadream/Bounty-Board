import { sendHubPayment } from './hub.ts'
import { sendMiniAppPayment, shouldUseMiniApp } from './nimiq.ts'

export async function sendBountyPayment(input: {
  recipient: string
  valueLuna: number
  bountyId: string
  sender?: string
}): Promise<string> {
  if (shouldUseMiniApp()) {
    return sendMiniAppPayment(input)
  }
  return sendHubPayment(input)
}

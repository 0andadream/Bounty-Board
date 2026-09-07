import HubApi from '@nimiq/hub-api'
import { formatNimiqAddress, isValidEthAddress, isValidNimiqAddress, normalizeEthAddress } from '@shared/address.ts'
import { paymentMemo } from '@shared/money.ts'
import { AppError, classifyWalletError } from '../lib/errors.ts'

const APP_NAME = 'Board'
const HUB_ENDPOINT = 'https://hub.nimiq.com'

let hub: HubApi | null = null

function getHub(): HubApi {
  if (!hub) hub = new HubApi(HUB_ENDPOINT)
  return hub
}

export async function chooseHubAddress(): Promise<{ nimiq: string; eth: string | null }> {
  try {
    const result = await getHub().chooseAddress({
      appName: APP_NAME,
      returnUsdcAddress: true,
    })
    if (!result?.address || !isValidNimiqAddress(result.address)) {
      throw new AppError('wallet_disconnected', 'No Nimiq address was selected.', true)
    }
    const eth =
      typeof result.usdcAddress === 'string' && isValidEthAddress(result.usdcAddress)
        ? normalizeEthAddress(result.usdcAddress)
        : null
    return { nimiq: formatNimiqAddress(result.address), eth }
  } catch (error) {
    throw classifyWalletError(error)
  }
}

export async function sendHubPayment(input: {
  recipient: string
  valueLuna: number
  bountyId: string
  sender?: string
}): Promise<string> {
  if (!Number.isInteger(input.valueLuna) || input.valueLuna <= 0) {
    throw new AppError('bad_request', 'Invalid NIM amount.', false)
  }
  try {
    const result = await getHub().checkout({
      appName: APP_NAME,
      recipient: formatNimiqAddress(input.recipient),
      value: input.valueLuna,
      extraData: paymentMemo(input.bountyId),
      sender: input.sender ? formatNimiqAddress(input.sender) : undefined,
      forceSender: Boolean(input.sender),
    })
    if (!result || typeof result !== 'object' || !('hash' in result) || typeof result.hash !== 'string') {
      throw new AppError(
        'tx_failed',
        'The wallet did not return a transaction hash. The bounty was not marked paid.',
        true,
      )
    }
    return result.hash
  } catch (error) {
    if (error instanceof AppError) throw error
    throw classifyWalletError(error)
  }
}

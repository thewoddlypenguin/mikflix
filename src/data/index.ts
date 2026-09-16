import inventoryRaw from './generated/titles.json'
import { adaptGeneratedTitles } from './adapter'

/** The real collection: generated physical-inventory bundle → app titles. */
export const allTitles = adaptGeneratedTitles(inventoryRaw)

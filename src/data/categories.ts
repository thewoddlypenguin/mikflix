import type { SmartList } from './types'

export interface HomeCategory {
  id: string
  label: string
  description: string
  titleIds: string[]
  /** preset key understood by the Library screen's "View More" route */
  preset?: string
}

/** The featured hero title on Home */
export const featuredTitleId = 'fellowship'

export const homeCategories: HomeCategory[] = [
  {
    id: 'family-night',
    label: 'Family Night',
    description: 'Crowd-pleasers the whole household agrees on (a minor miracle).',
    titleIds: ['lion-king', 'brother-bear', 'harry-potter-1', 'the-incredibles', 'beauty-beast', 'spirited-away'],
    preset: 'family-night',
  },
  {
    id: 'recently-added',
    label: 'Recently Added',
    description: 'Fresh on the shelf — logged within the last few months.',
    titleIds: ['smallville', 'eyes-wide-shut', 'hans-zimmer-live', 'voltron'],
    preset: 'recently-added',
  },
  {
    id: 'tv-complete',
    label: 'TV Complete Series',
    description: 'Start to finish, no waiting for the next season.',
    titleIds: ['smallville', 'game-of-thrones', 'voltron', 'lost'],
    preset: 'tv-complete',
  },
  {
    id: 'disney-favorites',
    label: 'Disney Favorites',
    description: 'The animated canon, as claimed by the kids.',
    titleIds: ['lion-king', 'brother-bear', 'the-incredibles', 'beauty-beast'],
    preset: 'disney',
  },
  {
    id: 'box-sets',
    label: 'Box Sets',
    description: 'Multi-disc monuments. Heavy, proud, and hard to store.',
    titleIds: ['harry-potter-1', 'fellowship', 'game-of-thrones', 'smallville', 'lost'],
    preset: 'box-sets',
  },
  {
    id: 'wishlist-row',
    label: 'Wishlist / Wanted Back',
    description: 'Titles we’re hunting for — or trying to lure home again.',
    titleIds: ['spirited-away', 'jurassic-park', 'matrix', 'fellowship', 'two-towers'],
    preset: 'wishlist',
  },
  {
    id: 'loose-discs',
    label: 'Loose Discs Needing Upgrade',
    description: 'Binder discs that deserve a real case on a real shelf.',
    titleIds: ['shaun-dead', 'two-towers', 'fellowship', 'hamlet'],
    preset: 'loose-discs',
  },
]

/** Quick-jump smart lists surfaced in the header / home intro */
export const smartLists: SmartList[] = [
  {
    id: 'films',
    label: 'Films',
    description: 'Every feature film on the shelf',
    icon: 'clapperboard',
    href: '/library?type=film',
  },
  {
    id: 'tv',
    label: 'TV Series',
    description: 'Seasons, volumes & complete runs',
    icon: 'tv',
    href: '/library?type=tv',
  },
  {
    id: 'music',
    label: 'Music & Concerts',
    description: 'Concert films and stage recordings',
    icon: 'disc-3',
    href: '/library?type=music',
  },
  {
    id: 'box-sets',
    label: 'Box Sets',
    description: 'The heavy artillery',
    icon: 'archive',
    href: '/library?flag=box-set',
  },
  {
    id: 'wishlist',
    label: 'Wishlist',
    description: 'Wanted, missed & upgrade targets',
    icon: 'binoculars',
    href: '/wishlist',
  },
]
/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as reviewRequest } from './review-request.tsx'
import { template as teamInvitation } from './team-invitation.tsx'
import { template as lowRatingAlert } from './low-rating-alert.tsx'
import { template as weeklyDigest } from './weekly-digest.tsx'
import { template as adminAlertDigest } from './admin-alert-digest.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'review-request': reviewRequest,
  'team-invitation': teamInvitation,
  'low-rating-alert': lowRatingAlert,
  'weekly-digest': weeklyDigest,
  'admin-alert-digest': adminAlertDigest,
}
